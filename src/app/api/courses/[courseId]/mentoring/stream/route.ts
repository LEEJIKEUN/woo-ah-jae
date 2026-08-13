import { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { getCourse } from "@/lib/course/content";
import { isStaffRole } from "@/lib/course/access";
import { isUserEnrolled } from "@/lib/enrollment-store";
import { loadRoom } from "@/lib/mentoring-store";
import { subscribeMentoring } from "@/lib/mentoring-bus";
import { prisma } from "@/lib/prisma";

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

/** 멘토링 방 SSE 스트림: 접속 시 현재 방(메타) + 변경마다 즉시 푸시. 파일 바이트는 흘리지 않음. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  if (!getCourse(courseId)) return new Response("Not found", { status: 404 });
  const s = await sessionFromReq(request);
  if (!s) return new Response("Unauthorized", { status: 401 });
  const staff = isStaffRole(s.role);
  const enrolled = !staff && s.role === "STUDENT" && (await isUserEnrolled(courseId, s.userId));
  const isParent = !staff && !enrolled && s.role === "PARENT";
  if (!staff && !enrolled && !isParent) return new Response("Forbidden", { status: 403 });

  // 대상 학생(방 주인): 학생=본인 / 스태프=선택 학생 / 학부모=승인된 자녀
  let studentId = "";
  if (enrolled) {
    studentId = s.userId;
  } else {
    const requested = new URL(request.url).searchParams.get("studentId") ?? "";
    if (!requested || !(await isUserEnrolled(courseId, requested))) return new Response("Bad request", { status: 400 });
    if (staff) {
      studentId = requested;
    } else {
      const link = await prisma.parentChildLink.findFirst({ where: { parentUserId: s.userId, childUserId: requested, status: "APPROVED" }, select: { id: true } });
      if (!link) return new Response("Forbidden", { status: 403 });
      studentId = requested;
    }
  }

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

      // 최초 방 전송(메타데이터 — loadRoom 은 파일 바이트를 포함하지 않음)
      send(await loadRoom(courseId, studentId));

      const unsubscribe = subscribeMentoring(courseId, studentId, (room) => send(room));

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
