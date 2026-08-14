import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { saveAnswers, type AnswerInput } from "@/lib/exam/store";

export const dynamic = "force-dynamic";

/** 입력 배열을 안전하게 파싱(문항번호 정수 + choice/textAnswer). */
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
 * 답안 자동저장 — 학생 전용. 변경 문항만 upsert(빈 배열이면 heartbeat 로 lastSavedAt 만 갱신).
 * 마감+유예 초과면 잠금(status:'expired', rejected). 제출/만료된 세션은 immutable.
 * (탭 숨김/이탈 시 fetch keepalive 로도 호출됨)
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ courseId: string; examId: string }> }) {
  try {
    const { courseId, examId } = await params;
    const auth = await getAuthFromRequest(request);
    if (auth.role !== "STUDENT") return NextResponse.json({ error: "학생 계정만 응시할 수 있습니다." }, { status: 403 });

    const body = (await request.json().catch(() => null)) as { answers?: unknown } | null;
    const answers = parseAnswers(body?.answers);

    const res = await saveAnswers(courseId, examId, auth.userId, answers);
    switch (res.code) {
      case "NOT_FOUND":
        return NextResponse.json({ error: "시험을 찾을 수 없습니다." }, { status: 404 });
      case "NO_ATTEMPT":
        return NextResponse.json({ error: "응시 세션이 없습니다." }, { status: 409 });
      case "LOCKED":
        // 시간 종료/제출됨 — 오류가 아니라 상태를 알려 클라가 읽기전용 전환하도록 200 으로 반환
        return NextResponse.json({ rejected: true, status: res.status });
      case "OK":
        return NextResponse.json({ ok: true, serverNow: res.serverNow, status: res.status, lastSavedAt: res.lastSavedAt, savedCount: res.savedCount });
    }
  } catch (error) {
    return jsonError(error);
  }
}
