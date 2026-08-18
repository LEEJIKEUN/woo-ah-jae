import { NextRequest } from "next/server";
import { subscribeEnrollment } from "@/lib/enrollment-bus";
import { getApplied } from "@/lib/enrollment-store";
import { effectiveCapacity } from "@/lib/course/meta-store";

export const dynamic = "force-dynamic";

/** 수강신청 현황 SSE 스트림: 접속 시 현재값 + 변경마다 즉시 푸시 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const capacity = await effectiveCapacity(courseId);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      const send = (payload: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          /* 스트림이 이미 닫힘 */
        }
      };

      // 최초 현황 즉시 전송
      const applied = await getApplied(courseId);
      send({ applied, capacity, full: applied >= capacity });

      // 변경 구독(POST 신청 시 즉시 푸시)
      const unsubscribe = subscribeEnrollment(courseId, (payload) => send(payload));

      // 연결 유지용 heartbeat (주석 이벤트)
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
