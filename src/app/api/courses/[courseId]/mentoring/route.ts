import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { getCourse } from "@/lib/course/content";
import { isStaffRole } from "@/lib/course/access";
import { isUserEnrolled } from "@/lib/enrollment-store";
import { addChat, getRoom, saveBooks, saveReport, type Book, type Report } from "@/lib/mentoring-store";
import { publishMentoring } from "@/lib/mentoring-bus";

const FIELD_KEYS = ["topic", "motive", "process", "result", "difficulty", "overcome", "learned", "standard", "references"] as const;
const MAX_FIELD = 20000;
const MAX_BOOK_FIELD = 2000;

async function sessionFromReq(request: NextRequest) {
  try {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

/** 강좌 존재 + 로그인 + (스태프 or 수강신청) 게이트 */
async function gate(request: NextRequest, courseId: string) {
  if (!getCourse(courseId)) return { error: NextResponse.json({ error: "강좌를 찾을 수 없습니다." }, { status: 404 }) };
  const session = await sessionFromReq(request);
  if (!session) return { error: NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }) };
  if (!isStaffRole(session.role) && !(await isUserEnrolled(courseId, session.userId))) {
    return { error: NextResponse.json({ error: "수강신청이 필요합니다." }, { status: 403 }) };
  }
  return { session };
}

function nowLabel() {
  try {
    return new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}
function sanitizeReport(r: unknown): Report {
  const src = (r ?? {}) as Record<string, unknown>;
  const out = {} as Report;
  for (const k of FIELD_KEYS) out[k] = typeof src[k] === "string" ? (src[k] as string).slice(0, MAX_FIELD) : "";
  return out;
}
function sanitizeBooks(bs: unknown): Book[] {
  if (!Array.isArray(bs)) return [];
  return bs.slice(0, 5).map((raw) => {
    const b = (raw ?? {}) as Record<string, unknown>;
    const s = (v: unknown) => String(typeof v === "string" ? v : "").slice(0, MAX_BOOK_FIELD);
    return { book: s(b.book), author: s(b.author), motive: s(b.motive), review: s(b.review), influence: s(b.influence) };
  });
}

// 방 조회 (+ 내 역할: 스태프=교사, 그 외=학생)
export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const g = await gate(request, courseId);
  if ("error" in g) return g.error;
  const room = await getRoom(courseId);
  return NextResponse.json({ ...room, role: isStaffRole(g.session.role) ? "teacher" : "student" });
}

// 저장/전송 (report | chat | books)
export async function POST(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const g = await gate(request, courseId);
  if ("error" in g) return g.error;
  const s = g.session;

  const body = (await request.json()) as { action?: string; report?: unknown; text?: string; books?: unknown };
  let room;
  if (body.action === "report") {
    room = await saveReport(courseId, sanitizeReport(body.report));
  } else if (body.action === "chat" && typeof body.text === "string" && body.text.trim()) {
    const from = isStaffRole(s.role) ? "teacher" : "student";
    room = await addChat(courseId, { from, text: body.text.trim().slice(0, 2000), at: nowLabel() });
  } else if (body.action === "books") {
    room = await saveBooks(courseId, sanitizeBooks(body.books));
  } else {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  publishMentoring(courseId, room);
  return NextResponse.json({ ok: true, ...room });
}
