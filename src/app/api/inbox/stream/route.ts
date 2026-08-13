import { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { COURSES } from "@/lib/course/content";
import { subscribeInbox } from "@/lib/inbox-bus";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** 헤더 알림·메시지 배지 실시간 스트림 — 이벤트 발생 시 'refresh' 를 보낸다(클라가 재조회). */
export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return new Response("Unauthorized", { status: 401 });
  let session: { userId: string; role: string };
  try {
    session = await verifySessionToken(token);
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  const channels = [`user:${session.userId}`];
  if (session.role === "ADMIN") {
    channels.push(...COURSES.map((c) => `course-staff:${c.id}`));
  } else if (session.role === "FACILITATOR") {
    const fc = await prisma.facilitatorCourse.findMany({ where: { facilitatorUserId: session.userId }, select: { courseId: true } });
    channels.push(...fc.map((f) => `course-staff:${f.courseId}`));
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
          /* 닫힘 */
        }
      };
      send({ type: "ready" });
      const unsubscribe = subscribeInbox(channels, () => send({ type: "refresh" }));
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
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
