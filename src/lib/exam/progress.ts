import { prisma } from "@/lib/prisma";
import { gradeExam } from "./grade";

/**
 * 명렬표(응시 현황) 셀 — 실시간 진행 정보 포함.
 * - in_progress: correct(맞춘 수) · answered(체크한 수) · unanswered(미응답 수) · qCount(총 문항)
 * - 종료(submitted/expired/zero): score/total
 * answerKey 자체는 절대 클라이언트로 내보내지 않는다(맞춘 '개수'만 스태프에게 노출).
 */
export type LiveCell = {
  status: string; // unassigned | not_started | in_progress | submitted | expired | zero
  score?: number;
  total?: number;
  correct?: number;
  answered?: number;
  unanswered?: number;
  qCount?: number;
  deadlineAt?: string; // in_progress 잔여시간 표시용(서버 고정 마감시각, ISO)
};

/** examAnswer 한 행이 '응답됨'인지 — 객관식 choice 있음 or 주관식 공백 아닌 텍스트. */
export function isAnswerFilled(a: { choice: number | null; textAnswer: string | null }): boolean {
  return a.choice != null || (a.textAnswer != null && a.textAnswer.trim() !== "");
}

/** 특정 학생의 특정 시험에 대한 명렬표 셀(실시간 진행 포함)을 계산. */
export async function buildLiveCell(examId: string, studentId: string): Promise<LiveCell | null> {
  const exam = await prisma.exam.findUnique({ where: { id: examId }, select: { id: true, status: true, closesAt: true } });
  if (!exam) return null;

  const assigned = await prisma.examAssignment.findUnique({ where: { examId_studentId: { examId, studentId } }, select: { examId: true } });
  if (!assigned) return { status: "unassigned" };

  const questions = await prisma.examQuestion.findMany({ where: { examId }, select: { number: true, type: true, points: true, answerKey: true } });
  const total = Math.round(questions.reduce((s, q) => s + q.points, 0) * 100) / 100;
  const qCount = questions.length;

  const attempt = await prisma.examAttempt.findUnique({ where: { examId_studentId: { examId, studentId } }, select: { id: true, status: true, deadlineAt: true } });
  if (!attempt) {
    const now = new Date();
    const closed = (exam.closesAt && now > exam.closesAt) || exam.status === "closed";
    return closed ? { status: "zero", score: 0, total } : { status: "not_started" };
  }

  const answers = await prisma.examAnswer.findMany({ where: { attemptId: attempt.id }, select: { questionNo: true, choice: true, textAnswer: true } });

  if (attempt.status === "in_progress") {
    const g = gradeExam(questions, answers);
    const answered = answers.filter(isAnswerFilled).length;
    return { status: "in_progress", correct: g.correctCount, answered, unanswered: Math.max(0, qCount - answered), qCount, deadlineAt: attempt.deadlineAt.toISOString() };
  }

  const g = gradeExam(questions, answers);
  return { status: attempt.status, score: g.score, total };
}
