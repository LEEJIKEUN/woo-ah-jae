import { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { getCourse } from "@/lib/course/content";
import { isStaffRole, isParentOfEnrolledChild } from "@/lib/course/access";
import { isUserEnrolled } from "@/lib/enrollment-store";
import { getRoom } from "@/lib/mentoring-store";
import { subscribeMentoring } from "@/lib/mentoring-bus";

export const dynamic = "force-dynamic";

async function sessionFromReq(request: NextRequest) {
  try {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

/** 멘토링 방 SSE 스트림: 접속 시 현재 방 + 변경마다 즉시 푸시 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  if (!getCourse(courseId)) return new Response("Not found", { status: 404 });
  const s = await sessionFromReq(request);
  if (!s) return new Response("Unauthorized", { status: 401 });
  const staff = isStaffRole(s.role);
  const enrolled = !staff && (await isUserEnrolled(courseId, s.userId));
  const parent = !staff && !enrolled && s.role === "PARENT" && (await isParentOfEnrolledChild(courseId, s.userId));
  if (!staff && !enrolled && !parent) return new Response("Forbidden", { status: 403 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (payload: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          /* 닫힘 */
        }
      };
      // 파일 dataUrl(수 MB)은 SSE 로 흘리지 않고 메타만 전송 → 다운로드는 GET 으로.
      const sanitize = (room: Awaited<ReturnType<typeof getRoom>>) => ({
        ...room,
        file: room.file ? { name: room.file.name, size: room.file.size } : null,
      });

      // 최초 방 전송
      send(sanitize(await getRoom(courseId)));

      const unsubscribe = subscribeMentoring(courseId, (room) => send(sanitize(room)));

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
