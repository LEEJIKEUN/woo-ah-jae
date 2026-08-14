import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { submitAttempt, type AnswerInput } from "@/lib/exam/store";

export const dynamic = "force-dynamic";

function parseAnswers(raw: unknown): AnswerInput[] {
  if (!Array.isArray(raw)) return [];
  const out: AnswerInput[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const n = typeof r.questionNo === "number" ? Math.trunc(r.questionNo) : Number(r.questionNo);
    if (!Number.isFinite(n)) continue;
    out.push({
      questionNo: n,
      choice: typeof r.choice === "number" ? r.choice : r.choice === null ? null : undefined,
      textAnswer: typeof r.textAnswer === "string" ? r.textAnswer : r.textAnswer === null ? null : undefined,
    });
  }
  return out;
}

/**
 * 제출 — 학생 전용(수동 제출 + 타이머 0 자동제출 공용). 서버 시간 재검증(무유예).
 * 마감 지났으면 expired, 아니면 submitted. 최종 답안(answers)이 오면 마감+유예 이내일 때만 반영.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ courseId: string; examId: string }> }) {
  try {
    const { courseId, examId } = await params;
    const auth = await getAuthFromRequest(request);
    if (auth.role !== "STUDENT") return NextResponse.json({ error: "학생 계정만 응시할 수 있습니다." }, { status: 403 });

    const body = (await request.json().catch(() => null)) as { answers?: unknown } | null;
    const answers = parseAnswers(body?.answers);

    const res = await submitAttempt(courseId, examId, auth.userId, answers);
    switch (res.code) {
      case "NOT_FOUND":
        return NextResponse.json({ error: "시험을 찾을 수 없습니다." }, { status: 404 });
      case "NO_ATTEMPT":
        return NextResponse.json({ error: "응시 세션이 없습니다." }, { status: 409 });
      case "OK":
        return NextResponse.json({ ok: true, serverNow: res.serverNow, status: res.status, submittedAt: res.submittedAt });
    }
  } catch (error) {
    return jsonError(error);
  }
}
