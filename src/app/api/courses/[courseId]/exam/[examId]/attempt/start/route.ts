import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { startAttempt } from "@/lib/exam/store";
import { notifyExamProgress } from "@/lib/exam/exam-bus";

export const dynamic = "force-dynamic";

/** ISO → "8월 14일 22:01" (한국시간) */
function fmtKst(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** 응시 시작(또는 기존 세션 반환) — 학생 전용. 타이머는 이 시점의 deadlineAt(서버 고정) 기준. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ courseId: string; examId: string }> }) {
  try {
    const { courseId, examId } = await params;
    const auth = await getAuthFromRequest(request);
    if (auth.role !== "STUDENT") return NextResponse.json({ error: "학생 계정만 응시할 수 있습니다." }, { status: 403 });

    const res = await startAttempt(courseId, examId, auth.userId);
    switch (res.code) {
      case "NOT_FOUND":
        return NextResponse.json({ error: "시험을 찾을 수 없습니다." }, { status: 404 });
      case "NOT_ASSIGNED":
        return NextResponse.json({ error: "배정된 시험이 아닙니다." }, { status: 403 });
      case "NOT_OPEN":
        return NextResponse.json({ code: "NOT_OPEN", opensAt: res.opensAt, error: `아직 응시 시작 전입니다. 응시 시작 시각(${fmtKst(res.opensAt)}, 한국시간)부터 응시할 수 있어요.` }, { status: 403 });
      case "CLOSED":
        return NextResponse.json(
          {
            code: "CLOSED",
            error: res.reason === "closed_time"
              ? `응시 마감 시각(${fmtKst(res.closesAt)}, 한국시간)이 지났습니다. 미응시로 0점 처리되며, 문제지·해설지는 시험 목록에서 내려받아 확인할 수 있어요.`
              : "아직 공개되지 않았거나 마감된 시험입니다. 담당 선생님께 문의해 주세요.",
          },
          { status: 403 }
        );
      case "OK":
        // 응시 시작 시 명렬표를 '응시중(진행 0)'으로 즉시 전환
        void notifyExamProgress(courseId, examId, auth.userId);
        return NextResponse.json(res.data);
    }
  } catch (error) {
    return jsonError(error);
  }
}
