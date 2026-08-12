import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { addChat, getRoom, saveBooks, saveReport, type Book, type Report } from "@/lib/mentoring-store";
import { publishMentoring } from "@/lib/mentoring-bus";

async function sessionFromReq(request: NextRequest) {
  try {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

function nowLabel() {
  try {
    return new Date().toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

// 방 조회 (+ 내 역할)
export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const s = await sessionFromReq(request);
  if (!s) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const room = await getRoom(courseId);
  return NextResponse.json({ ...room, role: s.role === "ADMIN" ? "teacher" : "student" });
}

// 저장/전송 (report | chat | books) → 저장 후 방을 모든 구독자에게 즉시 푸시
export async function POST(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const s = await sessionFromReq(request);
  if (!s) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const body = (await request.json()) as { action?: string; report?: Report; text?: string; books?: Book[] };

  let room;
  if (body.action === "report" && body.report) {
    room = await saveReport(courseId, body.report);
  } else if (body.action === "chat" && typeof body.text === "string" && body.text.trim()) {
    const from = s.role === "ADMIN" ? "teacher" : "student";
    room = await addChat(courseId, { from, text: body.text.trim().slice(0, 2000), at: nowLabel() });
  } else if (body.action === "books" && Array.isArray(body.books)) {
    room = await saveBooks(courseId, body.books);
  } else {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  publishMentoring(courseId, room);
  return NextResponse.json({ ok: true, ...room });
}
