import { prisma } from "@/lib/prisma";

/**
 * 자동 채점 — 객관식은 선택번호==정답, 주관식은 정규화 문자열 일치.
 * 주관식 채점은 완벽하지 않으니(단위·표기 차이) 교사가 리뷰에서 확인·조정한다.
 */

export type GradeQuestion = { number: number; type: string; points: number; answerKey: string };
export type GradeAnswer = { questionNo: number; choice: number | null; textAnswer: string | null };

export type QuestionResult = {
  number: number;
  type: string;
  points: number;
  correct: boolean;
  studentChoice: number | null;
  studentText: string | null;
  answerKey: string;
};
export type GradeResult = { score: number; total: number; correctCount: number; per: QuestionResult[] };

const CIRCLED: Record<string, string> = { "①": "1", "②": "2", "③": "3", "④": "4", "⑤": "5", "⑥": "6", "⑦": "7", "⑧": "8", "⑨": "9", "⑩": "10" };

/** 주관식/정답 비교용 정규화: 전각→반각, 공백 제거, 동그라미숫자→숫자, 소문자, 끝 마침표/쉼표 제거. */
function norm(s: string): string {
  return (s ?? "")
    .normalize("NFKC")
    .replace(/[①②③④⑤⑥⑦⑧⑨⑩]/g, (c) => CIRCLED[c] ?? c)
    .replace(/\s+/g, "")
    .replace(/[.,]$/, "")
    .toLowerCase();
}

/** 문항+답안으로 채점(순수 함수). */
export function gradeExam(questions: GradeQuestion[], answers: GradeAnswer[]): GradeResult {
  const byNo = new Map(answers.map((a) => [a.questionNo, a]));
  let score = 0;
  let total = 0;
  let correctCount = 0;
  const per: QuestionResult[] = questions
    .slice()
    .sort((a, b) => a.number - b.number)
    .map((q) => {
      total += q.points;
      const a = byNo.get(q.number);
      const key = norm(q.answerKey);
      let correct = false;
      if (key !== "") {
        if (q.type === "mcq") {
          correct = a?.choice != null && norm(String(a.choice)) === key;
        } else {
          correct = !!(a?.textAnswer && a.textAnswer.trim()) && norm(a.textAnswer ?? "") === key;
        }
      }
      if (correct) { score += q.points; correctCount += 1; }
      return {
        number: q.number,
        type: q.type,
        points: q.points,
        correct,
        studentChoice: a?.choice ?? null,
        studentText: a?.textAnswer ?? null,
        answerKey: q.answerKey,
      };
    });
  return { score: Math.round(score * 100) / 100, total: Math.round(total * 100) / 100, correctCount, per };
}

/** examId+studentId 로 데이터 로드 후 채점. attempt 없으면 null. */
export async function loadAndGrade(examId: string, studentId: string): Promise<GradeResult | null> {
  const attempt = await prisma.examAttempt.findUnique({ where: { examId_studentId: { examId, studentId } }, select: { id: true } });
  if (!attempt) return null;
  const [questions, answers] = await Promise.all([
    prisma.examQuestion.findMany({ where: { examId }, select: { number: true, type: true, points: true, answerKey: true } }),
    prisma.examAnswer.findMany({ where: { attemptId: attempt.id }, select: { questionNo: true, choice: true, textAnswer: true } }),
  ]);
  return gradeExam(questions, answers);
}
