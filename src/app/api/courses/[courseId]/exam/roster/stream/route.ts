import { NextRequest } from "next/server";
import { getAuthFromRequest } from "@/lib/guards";
import { isStaffRole, isFacilitatorOfCourse } from "@/lib/course/access";
import { subscribeExamProgress } from "@/lib/exam/exam-bus";

export const dynamic = "force-dynamic";

/**
 * 시험 응시 현황 실시간 SSE(스태프 전용).
 * 학생이 답안을 저장/제출/응시시작하면 해당 셀 업데이트를 즉시 푸시한다.
 * 최초 스냅샷은 명렬표 GET 이 제공하므로, 여기서는 변경 델타만 흘려보낸다.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;

  // 권한: 관리자 전원 / 담당 퍼실리테이터만
  try {
    const auth = await getAuthFromRequest(request);
    if (!isStaffRole(auth.role)) return new Response("forbidden", { status: 403 });
    if (auth.role === "FACILITATOR" && !(await isFacilitatorOfCourse(courseId, auth.userId))) return new Response("forbidden", { status: 403 });
  } catch {
    return new Response("unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const send = (payload: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          /* 스트림이 이미 닫힘 */
        }
      };

      // 연결 확인용 초기 이벤트
      send({ type: "ready" });

      const unsubscribe = subscribeExamProgress(courseId, (payload) => send({ type: "cell", ...payload }));

      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          /* 무시 */
        }
      }, 25000);

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* 무시 */
        }
      };
      request.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
