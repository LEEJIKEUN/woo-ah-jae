import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { getCourse } from "@/lib/course/content";
import { isStaffRole } from "@/lib/course/access";
import { isUserEnrolled } from "@/lib/enrollment-store";
import { addChat, getRoom, saveBooks, saveFile, saveReport, type Book, type MentoringFile, type Report } from "@/lib/mentoring-store";
import { publishMentoring } from "@/lib/mentoring-bus";
import { prisma } from "@/lib/prisma";

const FIELD_KEYS = ["topic", "motive", "process", "result", "difficulty", "overcome", "learned", "standard", "references"] as const;
const MAX_FIELD = 20000;
const MAX_BOOK_FIELD = 2000;
const MAX_FILE_DATAURL = 9 * 1024 * 1024;

async function sessionFromReq(request: NextRequest) {
  try {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

type Gate = { session: { userId: string; role: string }; staff: boolean; enrolledStudent: boolean; isParent: boolean };

async function baseGate(request: NextRequest, courseId: string): Promise<Gate | { error: NextResponse }> {
  if (!getCourse(courseId)) return { error: NextResponse.json({ error: "강좌를 찾을 수 없습니다." }, { status: 404 }) };
  const session = await sessionFromReq(request);
  if (!session) return { error: NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }) };
  const staff = isStaffRole(session.role);
  const enrolledStudent = !staff && session.role === "STUDENT" && (await isUserEnrolled(courseId, session.userId));
  const isParent = !staff && !enrolledStudent && session.role === "PARENT";
  if (!staff && !enrolledStudent && !isParent) return { error: NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 }) };
  return { session, staff, enrolledStudent, isParent };
}

/** 대상 학생(방 주인) 결정: 학생=본인 / 스태프=선택 학생 / 학부모=승인된 자녀. */
async function resolveStudent(courseId: string, g: Gate, requested: unknown): Promise<{ studentId: string } | { error: NextResponse }> {
  if (g.enrolledStudent) return { studentId: g.session.userId };
  const sid = typeof requested === "string" ? requested : "";
  if (!sid) return { error: NextResponse.json({ error: "학생을 선택해 주세요." }, { status: 400 }) };
  if (!(await isUserEnrolled(courseId, sid))) return { error: NextResponse.json({ error: "수강생이 아닙니다." }, { status: 400 }) };
  if (g.staff) return { studentId: sid };
  const link = await prisma.parentChildLink.findFirst({ where: { parentUserId: g.session.userId, childUserId: sid, status: "APPROVED" }, select: { id: true } });
  if (!link) return { error: NextResponse.json({ error: "권한이 없습니다." }, { status: 403 }) };
  return { studentId: sid };
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
function sanitizeFile(f: unknown): MentoringFile | null | "invalid" {
  if (!f || typeof f !== "object") return "invalid";
  const o = f as Record<string, unknown>;
  const dataUrl = typeof o.dataUrl === "string" ? o.dataUrl : "";
  if (!dataUrl.startsWith("data:") || dataUrl.length > MAX_FILE_DATAURL) return "invalid";
  return {
    name: String(typeof o.name === "string" ? o.name : "file").slice(0, 200),
    size: typeof o.size === "number" ? o.size : 0,
    dataUrl,
  };
}

// 방 조회 (?studentId=). 파일 dataUrl 포함(다운로드용).
export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const g = await baseGate(request, courseId);
  if ("error" in g) return g.error;
  const r = await resolveStudent(courseId, g, new URL(request.url).searchParams.get("studentId"));
  if ("error" in r) return r.error;
  const room = await getRoom(courseId, r.studentId);
  return NextResponse.json({ ...room, role: g.staff ? "teacher" : "student", studentId: r.studentId });
}

// 저장/전송. report·books·file = 방 주인(학생 본인)만 / chat = 학생 본인 + 스태프
export async function POST(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const g = await baseGate(request, courseId);
  if ("error" in g) return g.error;

  const body = (await request.json()) as { action?: string; report?: unknown; text?: string; books?: unknown; file?: unknown; studentId?: unknown };
  const r = await resolveStudent(courseId, g, body.studentId);
  if ("error" in r) return r.error;
  const studentId = r.studentId;
  const isOwnerStudent = g.enrolledStudent; // 학생은 본인 방만 접근

  let room;
  if (body.action === "report") {
    if (!isOwnerStudent) return NextResponse.json({ error: "보고서는 학생 본인만 작성할 수 있습니다." }, { status: 403 });
    room = await saveReport(courseId, studentId, sanitizeReport(body.report));
  } else if (body.action === "books") {
    if (!isOwnerStudent) return NextResponse.json({ error: "독서활동상황은 학생 본인만 작성할 수 있습니다." }, { status: 403 });
    room = await saveBooks(courseId, studentId, sanitizeBooks(body.books));
  } else if (body.action === "file") {
    if (!isOwnerStudent) return NextResponse.json({ error: "파일은 학생 본인만 업로드할 수 있습니다." }, { status: 403 });
    if (body.file === null) {
      room = await saveFile(courseId, studentId, null);
    } else {
      const f = sanitizeFile(body.file);
      if (f === "invalid") return NextResponse.json({ error: "PDF 파일이 올바르지 않거나 용량이 너무 큽니다. (최대 6MB)" }, { status: 413 });
      room = await saveFile(courseId, studentId, f);
    }
  } else if (body.action === "chat" && typeof body.text === "string" && body.text.trim()) {
    if (!g.staff && !isOwnerStudent) return NextResponse.json({ error: "채팅 권한이 없습니다." }, { status: 403 });
    const from = g.staff ? "teacher" : "student";
    room = await addChat(courseId, studentId, { from, text: body.text.trim().slice(0, 2000), at: nowLabel() });
  } else {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  publishMentoring(courseId, studentId, room);
  return NextResponse.json({ ok: true });
}
