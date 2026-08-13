import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { getCourse } from "@/lib/course/content";
import { isStaffRole } from "@/lib/course/access";
import { isUserEnrolled } from "@/lib/enrollment-store";
import {
  loadRoom, saveReport, setReportFile, saveBooks,
  addTextMessage, addFileMessage, editMessage, deleteMessage, getMessage,
  addNotice, editNotice, deleteNotice, getNotice,
  addAssignment, deleteAssignment, getAssignment,
  FIELD_KEYS, type Book, type Report, type UploadFile,
} from "@/lib/mentoring-store";
import { publishMentoring } from "@/lib/mentoring-bus";
import { prisma } from "@/lib/prisma";

const MAX_FIELD = 20000;
const MAX_BOOK_FIELD = 2000;
const MAX_TEXT = 2000;
const MAX_NOTICE = 3000;
const MAX_FILE_DATAURL = 9 * 1024 * 1024; // 약 6MB 파일

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
function sanitizeFile(f: unknown): UploadFile | "invalid" {
  if (!f || typeof f !== "object") return "invalid";
  const o = f as Record<string, unknown>;
  const dataUrl = typeof o.dataUrl === "string" ? o.dataUrl : "";
  if (!dataUrl.startsWith("data:") || dataUrl.length > MAX_FILE_DATAURL) return "invalid";
  const mimeFromUrl = dataUrl.slice(5, dataUrl.indexOf(";") > 0 ? dataUrl.indexOf(";") : 5) || "application/octet-stream";
  return {
    name: String(typeof o.name === "string" ? o.name : "file").slice(0, 200),
    size: typeof o.size === "number" ? o.size : 0,
    mime: String(typeof o.mime === "string" && o.mime ? o.mime : mimeFromUrl).slice(0, 120),
    dataUrl,
  };
}

// 방 조회(메타데이터). 파일 실제 바이트는 포함하지 않음 — 다운로드/미리보기는 /mentoring/file 라우트.
export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const g = await baseGate(request, courseId);
  if ("error" in g) return g.error;
  const r = await resolveStudent(courseId, g, new URL(request.url).searchParams.get("studentId"));
  if ("error" in r) return r.error;
  const room = await loadRoom(courseId, r.studentId);
  return NextResponse.json({ ...room, role: g.staff ? "teacher" : "student", studentId: r.studentId, viewerId: g.session.userId });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const g = await baseGate(request, courseId);
  if ("error" in g) return g.error;

  const body = (await request.json()) as {
    action?: string; report?: unknown; text?: string; books?: unknown; file?: unknown; studentId?: unknown; id?: unknown; body?: unknown;
    name?: unknown; size?: unknown; mime?: unknown; key?: unknown;
  };
  const r = await resolveStudent(courseId, g, body.studentId);
  if ("error" in r) return r.error;
  const studentId = r.studentId;
  const isOwnerStudent = g.enrolledStudent; // 학생은 본인 방만 접근
  const senderRole: "teacher" | "student" = g.staff ? "teacher" : "student";

  const forbidden = (msg: string) => NextResponse.json({ error: msg }, { status: 403 });

  switch (body.action) {
    /* 탐구 보고서 — 학생 본인만 */
    case "report": {
      if (!isOwnerStudent) return forbidden("보고서는 학생 본인만 작성할 수 있습니다.");
      await saveReport(courseId, studentId, sanitizeReport(body.report));
      break;
    }
    case "reportFile": {
      if (!isOwnerStudent) return forbidden("파일은 학생 본인만 업로드할 수 있습니다.");
      if (body.file === null) {
        await setReportFile(courseId, studentId, null);
      } else {
        const f = sanitizeFile(body.file);
        if (f === "invalid") return NextResponse.json({ error: "파일이 올바르지 않거나 용량이 너무 큽니다. (최대 6MB)" }, { status: 413 });
        await setReportFile(courseId, studentId, f);
      }
      break;
    }
    /* 독서활동상황 — 학생 본인만 */
    case "books": {
      if (!isOwnerStudent) return forbidden("독서활동상황은 학생 본인만 작성할 수 있습니다.");
      await saveBooks(courseId, studentId, sanitizeBooks(body.books));
      break;
    }
    /* 1:1 채팅 — 학생 본인 + 스태프 */
    case "chat": {
      if (!g.staff && !isOwnerStudent) return forbidden("채팅 권한이 없습니다.");
      const t = typeof body.text === "string" ? body.text.trim().slice(0, MAX_TEXT) : "";
      if (!t) return NextResponse.json({ error: "메시지를 입력하세요." }, { status: 400 });
      await addTextMessage(courseId, studentId, g.session.userId, senderRole, t);
      break;
    }
    case "chatFile": {
      if (!g.staff && !isOwnerStudent) return forbidden("파일 전송 권한이 없습니다.");
      const f = sanitizeFile(body.file);
      if (f === "invalid") return NextResponse.json({ error: "파일이 올바르지 않거나 용량이 너무 큽니다. (최대 6MB)" }, { status: 413 });
      const caption = typeof body.text === "string" ? body.text.trim().slice(0, MAX_TEXT) : "";
      await addFileMessage(courseId, studentId, g.session.userId, senderRole, f, caption);
      break;
    }
    case "editChat": {
      const id = typeof body.id === "string" ? body.id : "";
      const m = id ? await getMessage(id) : null;
      if (!m || m.courseId !== courseId || m.studentId !== studentId || m.deletedAt) return NextResponse.json({ error: "메시지를 찾을 수 없습니다." }, { status: 404 });
      if (m.senderId !== g.session.userId) return forbidden("본인이 보낸 메시지만 수정할 수 있습니다.");
      if (m.kind !== "text") return forbidden("파일 메시지는 수정할 수 없습니다.");
      const t = typeof body.text === "string" ? body.text.trim().slice(0, MAX_TEXT) : "";
      if (!t) return NextResponse.json({ error: "메시지를 입력하세요." }, { status: 400 });
      await editMessage(id, t);
      break;
    }
    case "deleteChat": {
      const id = typeof body.id === "string" ? body.id : "";
      const m = id ? await getMessage(id) : null;
      if (!m || m.courseId !== courseId || m.studentId !== studentId || m.deletedAt) return NextResponse.json({ error: "메시지를 찾을 수 없습니다." }, { status: 404 });
      if (m.senderId !== g.session.userId && !g.staff) return forbidden("본인이 보낸 메시지만 삭제할 수 있습니다.");
      await deleteMessage(id);
      break;
    }
    /* 개별 공지 — 관리자·퍼실만 */
    case "notice": {
      if (!g.staff) return forbidden("공지는 관리자·퍼실리테이터만 작성할 수 있습니다.");
      const t = typeof body.body === "string" ? body.body.trim().slice(0, MAX_NOTICE) : "";
      if (!t) return NextResponse.json({ error: "공지 내용을 입력하세요." }, { status: 400 });
      await addNotice(courseId, studentId, g.session.userId, t);
      break;
    }
    case "editNotice": {
      if (!g.staff) return forbidden("관리자·퍼실리테이터만 수정할 수 있습니다.");
      const id = typeof body.id === "string" ? body.id : "";
      const n = id ? await getNotice(id) : null;
      if (!n || n.courseId !== courseId || n.studentId !== studentId) return NextResponse.json({ error: "공지를 찾을 수 없습니다." }, { status: 404 });
      const t = typeof body.body === "string" ? body.body.trim().slice(0, MAX_NOTICE) : "";
      if (!t) return NextResponse.json({ error: "공지 내용을 입력하세요." }, { status: 400 });
      await editNotice(id, t);
      break;
    }
    case "deleteNotice": {
      if (!g.staff) return forbidden("관리자·퍼실리테이터만 삭제할 수 있습니다.");
      const id = typeof body.id === "string" ? body.id : "";
      const n = id ? await getNotice(id) : null;
      if (!n || n.courseId !== courseId || n.studentId !== studentId) return NextResponse.json({ error: "공지를 찾을 수 없습니다." }, { status: 404 });
      await deleteNotice(id);
      break;
    }
    /* 과제 업로드 — 등록은 학생 본인만(R2 업로드 후 메타 등록), 삭제는 본인 또는 스태프 */
    case "assignmentAdd": {
      if (!isOwnerStudent) return forbidden("과제는 학생 본인만 업로드할 수 있습니다.");
      const name = typeof body.name === "string" ? body.name.slice(0, 200) : "";
      const size = typeof body.size === "number" ? body.size : 0;
      const mime = typeof body.mime === "string" ? body.mime.slice(0, 120) : "";
      const key = typeof body.key === "string" ? body.key : "";
      if (!name || !key || !key.startsWith(`mentoring/${courseId}/${studentId}/assignment/`)) return NextResponse.json({ error: "잘못된 업로드입니다." }, { status: 400 });
      const isPdfOrVideo = mime === "application/pdf" || name.toLowerCase().endsWith(".pdf") || mime.startsWith("video/");
      if (!isPdfOrVideo) return NextResponse.json({ error: "PDF 또는 동영상 파일만 업로드할 수 있습니다." }, { status: 400 });
      await addAssignment(courseId, studentId, g.session.userId, { name, size, mime, key });
      break;
    }
    case "assignmentDelete": {
      const id = typeof body.id === "string" ? body.id : "";
      const a = id ? await getAssignment(id) : null;
      if (!a || a.courseId !== courseId || a.studentId !== studentId) return NextResponse.json({ error: "과제를 찾을 수 없습니다." }, { status: 404 });
      if (a.studentId !== g.session.userId && !g.staff) return forbidden("본인이 올린 과제만 삭제할 수 있습니다.");
      await deleteAssignment(id);
      break;
    }
    default:
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  publishMentoring(courseId, studentId, await loadRoom(courseId, studentId));
  return NextResponse.json({ ok: true });
}
