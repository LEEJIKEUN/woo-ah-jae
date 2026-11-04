import { prisma } from "@/lib/prisma";
import { gradeExam, type GradeAnswer, type GradeQuestion } from "@/lib/exam/grade";

/**
 * 활동 정리 '시험 결과' 섹션 — 강의실 '시험' 탭에서 학생에게 배정된 시험의 응시 상태·자동채점 점수·오답 문항 번호.
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

/** 순수 함수 — 시험 행들을 정리 본문으로. 배정된 시험이 없으면 "". */
export function formatExamSection(rows: ExamRow[], now: Date = new Date()): string {
  if (!rows.length) return "";
  const lines: string[] = [];
  let taken = 0;
  let scoreSum = 0;
  for (const r of rows) {
    const label = `${r.title}${r.subject ? ` (${r.subject})` : ""}`;
    const period = r.opensAt || r.closesAt ? ` · 응시기간 ${r.opensAt ? fmtDT(r.opensAt) : ""}~${r.closesAt ? fmtDT(r.closesAt) : ""}` : "";
    const closed = (!!r.closesAt && now > r.closesAt) || r.examStatus === "closed";
    const total = r1(r.questions.reduce((s, q) => s + q.points, 0));
    if (!r.attempt) {
      lines.push(`- ${label}${period} · ${closed ? `미응시(마감) · 0/${total}점` : "미응시(응시 가능)"}`);
      continue;
    }
    if (r.attempt.status === "in_progress") {
      const answered = r.answers.filter((a) => a.choice != null || !!(a.textAnswer && a.textAnswer.trim())).length;
      lines.push(`- ${label}${period} · 응시 중(미제출) · 답안 작성 ${answered}/${r.questions.length}문항`);
      continue;
    }
    const g = gradeExam(r.questions, r.answers);
    taken += 1;
    scoreSum += g.score;
    const wrong = g.per.filter((p) => !p.correct).map((p) => p.number);
    const when = r.attempt.submittedAt ?? r.attempt.deadlineAt;
    const wrongText = wrong.length ? `오답 문항 ${wrong.slice(0, 40).join(", ")}${wrong.length > 40 ? " …" : ""}` : "전부 정답";
    lines.push(`- ${label}${period} · ${r.attempt.status === "expired" ? "시간 만료 자동 제출" : "제출"} ${fmtDT(when)} · 점수 ${g.score}/${g.total}점 · 정답 ${g.correctCount}/${r.questions.length}문항 · ${wrongText}`);
  }
  const head = `요약: 배정 ${rows.length}회 · 응시(제출) ${taken}회${taken ? ` · 평균 ${r1(scoreSum / taken)}점` : ""}`;
  return [head, ...lines].join("\n");
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
