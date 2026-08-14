import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * 온라인 시험 응시 핵심 로직 — 서버 권위(시간 판정은 전부 여기서 now() 기준).
 * - answerKey 는 어떤 학생 응답에도 절대 포함하지 않는다(DTO에서 제외).
 * - 답안은 문항 단위 upsert 만. delete 후 insert 금지.
 * - deadlineAt 은 최초 시작 시 고정. 재계산하지 않는다.
 */

export const SAVE_GRACE_MS = 10_000; // 저장은 마감 후 10초 유예. 제출은 무유예.
export const MAX_TEXT_LEN = 5000; // 주관식 최대 글자수

/**
 * 마감 시각이 지났는데 아직 in_progress 인 응시를 expired 로 확정(제출 못 한 채 방치된 케이스).
 * 명렬표·목록·결과 등 조회 시점에 호출해 상태 표기를 일관되게 맞춘다.
 */
export async function expireOverdueAttempts(examIds: string[]): Promise<void> {
  if (!examIds.length) return;
  await prisma.examAttempt.updateMany({
    where: { examId: { in: examIds }, status: "in_progress", deadlineAt: { lt: new Date() } },
    data: { status: "expired" },
  });
}

type AttemptStatus = "in_progress" | "submitted" | "expired";

export type AnswerInput = { questionNo: number; choice?: number | null; textAnswer?: string | null };

export type StartData = {
  serverNow: string;
  exam: { id: string; title: string; subject: string; durationSec: number; status: string; opensAt: string | null; closesAt: string | null };
  attempt: { id: string; startedAt: string; deadlineAt: string; submittedAt: string | null; lastSavedAt: string | null; status: AttemptStatus };
  questions: { number: number; type: string; choiceCount: number; points: number }[]; // answerKey 없음
  answers: { questionNo: number; choice: number | null; textAnswer: string | null; updatedAt: string }[];
};

export type StartResult =
  | { code: "NOT_FOUND" }
  | { code: "NOT_ASSIGNED" }
  | { code: "NOT_OPEN"; opensAt: string }
  | { code: "CLOSED"; reason: "not_published" | "closed_time"; closesAt: string | null }
  | { code: "OK"; data: StartData };

export type SaveResult =
  | { code: "NOT_FOUND" }
  | { code: "NO_ATTEMPT" }
  | { code: "LOCKED"; status: AttemptStatus }
  | { code: "OK"; serverNow: string; status: AttemptStatus; lastSavedAt: string; savedCount: number };

export type SubmitResult =
  | { code: "NOT_FOUND" }
  | { code: "NO_ATTEMPT" }
  | { code: "OK"; serverNow: string; status: AttemptStatus; submittedAt: string | null };

type AttemptRow = { id: string; startedAt: Date; deadlineAt: Date; submittedAt: Date | null; lastSavedAt: Date | null; status: string };
type QuestionRow = { number: number; type: string; choiceCount: number; points: number; answerKey: string };
type AnswerRow = { questionNo: number; choice: number | null; textAnswer: string | null; updatedAt: Date };

function attemptDTO(a: AttemptRow) {
  return {
    id: a.id,
    startedAt: a.startedAt.toISOString(),
    deadlineAt: a.deadlineAt.toISOString(),
    submittedAt: a.submittedAt ? a.submittedAt.toISOString() : null,
    lastSavedAt: a.lastSavedAt ? a.lastSavedAt.toISOString() : null,
    status: a.status as AttemptStatus,
  };
}
function questionDTO(q: QuestionRow) {
  // answerKey 는 절대 내려보내지 않는다.
  return { number: q.number, type: q.type, choiceCount: q.choiceCount, points: q.points };
}
function answerDTO(a: AnswerRow) {
  return { questionNo: a.questionNo, choice: a.choice, textAnswer: a.textAnswer, updatedAt: a.updatedAt.toISOString() };
}

/** 강좌에 속한 시험인지 확인 후 반환. */
async function loadCourseExam(courseId: string, examId: string) {
  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam || exam.courseId !== courseId) return null;
  return exam;
}

/** 입력 답안을 문항 타입에 맞게 정제(mcq→choice 1..choiceCount, short→textAnswer). 알 수 없는 번호는 무시. */
function sanitize(answers: AnswerInput[], questions: QuestionRow[]): { questionNo: number; choice: number | null; textAnswer: string | null }[] {
  const byNo = new Map(questions.map((q) => [q.number, q]));
  const out: { questionNo: number; choice: number | null; textAnswer: string | null }[] = [];
  for (const a of answers) {
    const q = byNo.get(a.questionNo);
    if (!q) continue;
    if (q.type === "mcq") {
      const c = typeof a.choice === "number" ? Math.trunc(a.choice) : null;
      out.push({ questionNo: q.number, choice: c && c >= 1 && c <= q.choiceCount ? c : null, textAnswer: null });
    } else {
      const t = typeof a.textAnswer === "string" ? a.textAnswer.slice(0, MAX_TEXT_LEN) : null;
      out.push({ questionNo: q.number, choice: null, textAnswer: t });
    }
  }
  return out;
}

/** 변경 문항 upsert + lastSavedAt 갱신을 한 트랜잭션으로. */
async function persistAnswers(attemptId: string, clean: ReturnType<typeof sanitize>, now: Date) {
  const ops: Prisma.PrismaPromise<unknown>[] = clean.map((a) =>
    prisma.examAnswer.upsert({
      where: { attemptId_questionNo: { attemptId, questionNo: a.questionNo } },
      create: { attemptId, questionNo: a.questionNo, choice: a.choice, textAnswer: a.textAnswer, updatedAt: now },
      update: { choice: a.choice, textAnswer: a.textAnswer, updatedAt: now },
    })
  );
  ops.push(prisma.examAttempt.update({ where: { id: attemptId }, data: { lastSavedAt: now } }));
  await prisma.$transaction(ops);
}

/**
 * 응시 시작(또는 기존 세션 반환). 최초 진입 시 attempt 생성·deadlineAt 고정,
 * 재진입 시 기존 것을 그대로 반환. 시간 지난 in_progress 는 expired 로 확정.
 */
export async function startAttempt(courseId: string, examId: string, studentId: string): Promise<StartResult> {
  const exam = await loadCourseExam(courseId, examId);
  if (!exam) return { code: "NOT_FOUND" };
  const assigned = await prisma.examAssignment.findUnique({ where: { examId_studentId: { examId, studentId } } });
  if (!assigned) return { code: "NOT_ASSIGNED" };

  const now = new Date();
  let attempt = await prisma.examAttempt.findUnique({ where: { examId_studentId: { examId, studentId } } });

  if (!attempt) {
    // 신규 시작 차단 조건(기존 attempt 가 있으면 아래 조건과 무관하게 유지)
    if (exam.status !== "published") return { code: "CLOSED", reason: "not_published", closesAt: null };
    if (exam.opensAt && now < exam.opensAt) return { code: "NOT_OPEN", opensAt: exam.opensAt.toISOString() };
    if (exam.closesAt && now > exam.closesAt) return { code: "CLOSED", reason: "closed_time", closesAt: exam.closesAt.toISOString() };
    const deadlineAt = new Date(now.getTime() + exam.durationSec * 1000);
    try {
      attempt = await prisma.examAttempt.create({ data: { examId, studentId, startedAt: now, deadlineAt, status: "in_progress" } });
    } catch (e) {
      // 동시 진입 등으로 이미 생성됐으면 기존 것 사용
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        attempt = await prisma.examAttempt.findUnique({ where: { examId_studentId: { examId, studentId } } });
      } else throw e;
    }
  }
  if (!attempt) return { code: "NOT_FOUND" };

  // 마감 시각 지난 진행중 세션 → expired 확정(읽기전용)
  if (attempt.status === "in_progress" && now.getTime() > attempt.deadlineAt.getTime()) {
    attempt = await prisma.examAttempt.update({ where: { id: attempt.id }, data: { status: "expired", submittedAt: attempt.submittedAt ?? now } });
  }

  const [questions, answers] = await Promise.all([
    prisma.examQuestion.findMany({ where: { examId }, orderBy: { number: "asc" } }),
    prisma.examAnswer.findMany({ where: { attemptId: attempt.id } }),
  ]);

  return {
    code: "OK",
    data: {
      serverNow: now.toISOString(),
      exam: {
        id: exam.id,
        title: exam.title,
        subject: exam.subject,
        durationSec: exam.durationSec,
        status: exam.status,
        opensAt: exam.opensAt ? exam.opensAt.toISOString() : null,
        closesAt: exam.closesAt ? exam.closesAt.toISOString() : null,
      },
      attempt: attemptDTO(attempt),
      questions: questions.map(questionDTO),
      answers: answers.map(answerDTO),
    },
  };
}

/** 답안 저장(변경 문항 upsert). 마감+유예 초과 시 expired 로 잠금·거부. */
export async function saveAnswers(courseId: string, examId: string, studentId: string, answers: AnswerInput[]): Promise<SaveResult> {
  const exam = await loadCourseExam(courseId, examId);
  if (!exam) return { code: "NOT_FOUND" };
  const attempt = await prisma.examAttempt.findUnique({ where: { examId_studentId: { examId, studentId } } });
  if (!attempt) return { code: "NO_ATTEMPT" };

  const now = new Date();
  if (attempt.status !== "in_progress") return { code: "LOCKED", status: attempt.status as AttemptStatus };
  if (now.getTime() > attempt.deadlineAt.getTime() + SAVE_GRACE_MS) {
    await prisma.examAttempt.update({ where: { id: attempt.id }, data: { status: "expired", submittedAt: attempt.submittedAt ?? now } });
    return { code: "LOCKED", status: "expired" };
  }

  const questions = await prisma.examQuestion.findMany({ where: { examId } });
  const clean = sanitize(answers, questions);
  await persistAnswers(attempt.id, clean, now);
  return { code: "OK", serverNow: now.toISOString(), status: "in_progress", lastSavedAt: now.toISOString(), savedCount: clean.length };
}

/** 제출(무유예). 마감 지났으면 expired, 아니면 submitted. 이미 종료면 현재 상태 반환. */
export async function submitAttempt(courseId: string, examId: string, studentId: string, answers?: AnswerInput[]): Promise<SubmitResult> {
  const exam = await loadCourseExam(courseId, examId);
  if (!exam) return { code: "NOT_FOUND" };
  const attempt = await prisma.examAttempt.findUnique({ where: { examId_studentId: { examId, studentId } } });
  if (!attempt) return { code: "NO_ATTEMPT" };

  const now = new Date();
  if (attempt.status !== "in_progress") {
    return { code: "OK", serverNow: now.toISOString(), status: attempt.status as AttemptStatus, submittedAt: attempt.submittedAt ? attempt.submittedAt.toISOString() : null };
  }

  // 최종 답안이 함께 오면 마감+유예 이내일 때만 반영(자동제출 대비)
  if (answers && answers.length && now.getTime() <= attempt.deadlineAt.getTime() + SAVE_GRACE_MS) {
    const questions = await prisma.examQuestion.findMany({ where: { examId } });
    await persistAnswers(attempt.id, sanitize(answers, questions), now);
  }

  const status: AttemptStatus = now.getTime() > attempt.deadlineAt.getTime() ? "expired" : "submitted";
  const upd = await prisma.examAttempt.update({ where: { id: attempt.id }, data: { status, submittedAt: now, lastSavedAt: now } });
  return { code: "OK", serverNow: now.toISOString(), status, submittedAt: upd.submittedAt ? upd.submittedAt.toISOString() : null };
}
