import { prisma } from "@/lib/prisma";
import { gradeExam, type GradeAnswer, type GradeQuestion } from "@/lib/exam/grade";
import type { DossierTable } from "@/lib/mentoring/dossier";

/**
 * 활동 정리 '시험 결과' 섹션 — 강의실 '시험' 탭에서 학생에게 배정된 시험의 응시 상태·자동채점 점수·오답 문항 번호.
 * - formatExamSection: 텍스트(AI 입력·폴백). 시험마다 항목별 줄바꿈으로 구조를 드러낸다.
 * - examSectionTable: PDF 표(머리글 + 시험 1행).
 * 정답(answerKey)은 본문에 쓰지 않는다(점수·번호만). 주관식 자동채점은 표기 차이로 오채점될 수 있어 참고용.
 */
export type ExamRow = {
  title: string;
  subject: string;
  opensAt: Date | null;
  closesAt: Date | null;
  examStatus: string; // draft | published | closed
  attempt: { status: string; startedAt: Date; deadlineAt: Date; submittedAt: Date | null } | null;
  questions: GradeQuestion[];
  answers: GradeAnswer[];
};

/** 시험 1건의 정돈된 요약(텍스트·표 공용). */
export type ExamSummaryItem = {
  name: string; // 제목 (과목)
  period: string; // "11/1 23:24 ~ 11/11 23:24" | ""
  status: string; // 제출 | 시간 만료 자동 제출 | 응시 중 (미제출) | 미응시 (마감) | 미응시 (응시 가능)
  when: string; // 제출 시각 | ""
  score: string; // "70 / 100점" | ""
  correct: string; // "7/10문항" | "답안 작성 1/5문항" | ""
  wrong: string; // "8, 9, 10" | "없음(전부 정답)" | ""
  taken: boolean; // 제출·만료(채점 대상)
  scoreValue: number | null;
};

/** KST "M/D HH:mm" */
function fmtDT(d: Date): string {
  try {
    const p = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
    const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
    const hh = g("hour") === "24" ? "00" : g("hour");
    return `${g("month")}/${g("day")} ${hh}:${g("minute")}`;
  } catch {
    return "";
  }
}
const r1 = (n: number) => Math.round(n * 10) / 10;

export function summarizeExamRows(rows: ExamRow[], now: Date = new Date()): ExamSummaryItem[] {
  return rows.map((r) => {
    const name = `${r.title}${r.subject ? ` (${r.subject})` : ""}`;
    const period = r.opensAt || r.closesAt ? `${r.opensAt ? fmtDT(r.opensAt) : ""} ~ ${r.closesAt ? fmtDT(r.closesAt) : ""}`.trim() : "";
    const closed = (!!r.closesAt && now > r.closesAt) || r.examStatus === "closed";
    const total = r1(r.questions.reduce((s, q) => s + q.points, 0));
    if (!r.attempt) {
      return closed
        ? { name, period, status: "미응시 (마감)", when: "", score: `0 / ${total}점`, correct: "", wrong: "", taken: false, scoreValue: null }
        : { name, period, status: "미응시 (응시 가능)", when: "", score: "", correct: "", wrong: "", taken: false, scoreValue: null };
    }
    if (r.attempt.status === "in_progress") {
      const answered = r.answers.filter((a) => a.choice != null || !!(a.textAnswer && a.textAnswer.trim())).length;
      return { name, period, status: "응시 중 (미제출)", when: fmtDT(r.attempt.startedAt), score: "", correct: `답안 작성 ${answered}/${r.questions.length}문항`, wrong: "", taken: false, scoreValue: null };
    }
    const g = gradeExam(r.questions, r.answers);
    const wrong = g.per.filter((p) => !p.correct).map((p) => p.number);
    return {
      name,
      period,
      status: r.attempt.status === "expired" ? "시간 만료 자동 제출" : "제출",
      when: fmtDT(r.attempt.submittedAt ?? r.attempt.deadlineAt),
      score: `${g.score} / ${g.total}점`,
      correct: `${g.correctCount}/${r.questions.length}문항`,
      wrong: wrong.length ? `${wrong.slice(0, 40).join(", ")}${wrong.length > 40 ? " …" : ""}` : "없음(전부 정답)",
      taken: true,
      scoreValue: g.score,
    };
  });
}

/** 요약 한 줄: "배정 3회 · 응시(제출) 2회 · 평균 35점" */
export function examSummaryHead(items: ExamSummaryItem[]): string {
  const taken = items.filter((i) => i.taken);
  const avg = taken.length ? r1(taken.reduce((s, i) => s + (i.scoreValue ?? 0), 0) / taken.length) : null;
  return `배정 ${items.length}회 · 응시(제출) ${taken.length}회${avg !== null ? ` · 평균 ${avg}점` : ""}`;
}

/** 순수 함수 — 텍스트 본문(AI 입력·폴백). 배정된 시험이 없으면 "". */
export function formatExamSection(rows: ExamRow[], now: Date = new Date()): string {
  if (!rows.length) return "";
  const items = summarizeExamRows(rows, now);
  const blocks = items.map((it) => {
    const lines = [`■ ${it.name}`];
    if (it.period) lines.push(`  - 응시 기간: ${it.period}`);
    lines.push(`  - 상태: ${it.status}${it.when ? ` (${it.when})` : ""}`);
    if (it.score) lines.push(`  - 점수: ${it.score}${it.correct && it.taken ? ` · 정답 ${it.correct}` : ""}`);
    else if (it.correct) lines.push(`  - 진행: ${it.correct}`);
    if (it.wrong) lines.push(`  - 오답 문항: ${it.wrong}`);
    return lines.join("\n");
  });
  return [`요약: ${examSummaryHead(items)}`, "", ...blocks].join("\n");
}

/** PDF 표. 배정된 시험이 없으면 null. */
export function examSectionTable(rows: ExamRow[], now: Date = new Date()): DossierTable | null {
  if (!rows.length) return null;
  const items = summarizeExamRows(rows, now);
  return {
    caption: `요약: ${examSummaryHead(items)}`,
    columns: ["시험", "응시 기간", "상태", "점수", "정답", "오답 문항"],
    widths: [2.9, 2.3, 1.9, 1.5, 1.2, 1.8],
    // 응시 기간은 시작/끝을 두 줄로, 상태는 상태/시각을 두 줄로(셀 내 줄바꿈)
    rows: items.map((it) => [it.name, it.period ? it.period.replace(" ~ ", " ~\n") : "-", it.when ? `${it.status}\n${it.when}` : it.status, it.score || "-", it.correct || "-", it.wrong || "-"]),
  };
}

/** 학생에게 배정됐거나 응시 기록이 있는 시험(초안 제외)을 로드. 시험 기능을 안 쓰면 []. */
export async function loadExamRows(courseId: string, studentId: string): Promise<ExamRow[]> {
  const exams = await prisma.exam.findMany({ where: { courseId, status: { not: "draft" } }, orderBy: { createdAt: "asc" }, select: { id: true, title: true, subject: true, opensAt: true, closesAt: true, status: true } });
  if (!exams.length) return [];
  const ids = exams.map((e) => e.id);
  const [assigns, attempts, questions] = await Promise.all([
    prisma.examAssignment.findMany({ where: { examId: { in: ids }, studentId }, select: { examId: true } }),
    prisma.examAttempt.findMany({ where: { examId: { in: ids }, studentId }, select: { id: true, examId: true, status: true, startedAt: true, deadlineAt: true, submittedAt: true } }),
    prisma.examQuestion.findMany({ where: { examId: { in: ids } }, select: { examId: true, number: true, type: true, points: true, answerKey: true } }),
  ]);
  const answers = attempts.length
    ? await prisma.examAnswer.findMany({ where: { attemptId: { in: attempts.map((a) => a.id) } }, select: { attemptId: true, questionNo: true, choice: true, textAnswer: true } })
    : [];
  const assigned = new Set(assigns.map((a) => a.examId));
  const attemptBy = new Map(attempts.map((a) => [a.examId, a]));
  const qBy = new Map<string, GradeQuestion[]>();
  for (const q of questions) qBy.set(q.examId, [...(qBy.get(q.examId) ?? []), { number: q.number, type: q.type, points: q.points, answerKey: q.answerKey }]);
  const ansBy = new Map<string, GradeAnswer[]>();
  for (const a of answers) ansBy.set(a.attemptId, [...(ansBy.get(a.attemptId) ?? []), { questionNo: a.questionNo, choice: a.choice, textAnswer: a.textAnswer }]);
  return exams
    .filter((e) => assigned.has(e.id) || attemptBy.has(e.id))
    .map((e) => {
      const at = attemptBy.get(e.id);
      return {
        title: e.title,
        subject: e.subject,
        opensAt: e.opensAt,
        closesAt: e.closesAt,
        examStatus: e.status,
        attempt: at ? { status: at.status, startedAt: at.startedAt, deadlineAt: at.deadlineAt, submittedAt: at.submittedAt } : null,
        questions: qBy.get(e.id) ?? [],
        answers: at ? ansBy.get(at.id) ?? [] : [],
      };
    });
}
