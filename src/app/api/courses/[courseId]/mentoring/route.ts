import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { getCourse } from "@/lib/course/content";
import { isStaffRole } from "@/lib/course/access";
import { isUserEnrolled } from "@/lib/enrollment-store";
import {
  loadRoom, saveReport, setReportFile, saveBooks,
  addTextMessage, addFileMessage, editMessage, deleteMessage, getMessage,
  addNotice, editNotice, deleteNotice, getNotice,
  addAssignment, deleteAssignment, getAssignment, saveSete, slotHasAssignment,
  markPeerReviewsDeleted, repointPeerReviews,
  FIELD_KEYS, type Book, type Report, type UploadFile,
} from "@/lib/mentoring-store";
import { publishMentoring } from "@/lib/mentoring-bus";
import { pingUser, pingCourseStaff } from "@/lib/inbox-bus";
import { notifyCourseStaff, createNotifications, notifyMentoringRoom, approvedParentIds } from "@/lib/notification-store";
import { prisma } from "@/lib/prisma";

const MAX_FIELD = 20000;
const MAX_BOOK_FIELD = 2000;
const MAX_TEXT = 2000;
const MAX_NOTICE = 3000;
const MAX_FILE_DATAURL = 28 * 1024 * 1024; // base64 기준 ≈ 20MB 파일(보고서·채팅 첨부)

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
    name?: unknown; size?: unknown; mime?: unknown; key?: unknown; column?: unknown;
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
        if (f === "invalid") return NextResponse.json({ error: "파일이 올바르지 않거나 용량이 너무 큽니다. (최대 20MB)" }, { status: 413 });
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
      if (f === "invalid") return NextResponse.json({ error: "파일이 올바르지 않거나 용량이 너무 큽니다. (최대 20MB)" }, { status: 413 });
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
    /* 과목별 세부능력 특기사항(세특) — 관리자·퍼실만 작성 */
    case "sete": {
      if (!g.staff) return forbidden("세특은 관리자·퍼실리테이터만 작성할 수 있습니다.");
      const t = typeof body.body === "string" ? body.body.slice(0, 5000) : "";
      await saveSete(courseId, studentId, t);
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
      const column = typeof body.column === "number" && body.column >= 0 && body.column <= 4 ? Math.floor(body.column) : -1;
      if (column < 0) return NextResponse.json({ error: "과제 번호가 올바르지 않습니다." }, { status: 400 });
      if (!name || !key || !key.startsWith(`mentoring/${courseId}/${studentId}/assignment/`)) return NextResponse.json({ error: "잘못된 업로드입니다." }, { status: 400 });
      const lower = name.toLowerCase();
      const isPdf = mime === "application/pdf" || lower.endsWith(".pdf");
      const okVideo = [".mp4", ".m4v", ".webm", ".mov"].some((e) => lower.endsWith(e)) || ["video/mp4", "video/webm", "video/quicktime", "video/x-m4v"].includes(mime);
      if (!isPdf && !okVideo) return NextResponse.json({ error: "PDF 또는 지원되는 동영상(MP4·WebM·MOV)만 업로드할 수 있습니다." }, { status: 400 });
      if (await slotHasAssignment(courseId, studentId, column)) return NextResponse.json({ error: "이미 업로드된 과제가 있습니다. 삭제 후 다시 올려주세요." }, { status: 409 });
      const newAssignmentId = await addAssignment(courseId, studentId, g.session.userId, column, { name, size, mime, key });
      {
        const stu = await prisma.user.findUnique({ where: { id: studentId }, select: { email: true, studentProfile: { select: { realName: true } } } });
        const who = stu?.studentProfile?.realName || stu?.email || "학생";
        await notifyCourseStaff(courseId, g.session.userId, { kind: "assignment", title: `${who} · 과제 업로드`, body: name, href: `/course/${courseId}/status` });
        // 재제출: 이 학생의 같은 슬롯(column) '삭제됨' 피어리뷰만 새 과제로 재연결 → 배정받은 학생들에게 반영·알림
        const affected = await repointPeerReviews(courseId, studentId, newAssignmentId, name, column);
        for (const rid of affected) {
          try { publishMentoring(courseId, rid, await loadRoom(courseId, rid)); } catch { /* 무시 */ }
          pingUser(rid);
        }
        if (affected.length) {
          await createNotifications(affected.map((uid) => ({ userId: uid, kind: "peer", title: "배정된 과제가 다시 제출되었어요", body: `${who} 학생이 새 파일을 올렸습니다.`, href: `/course/${courseId}/mentoring` })));
          await notifyCourseStaff(courseId, g.session.userId, { kind: "peer", title: "피어리뷰 과제 재제출", body: `${who} 학생 과제 재제출 → ${affected.length}명에게 반영`, href: `/course/${courseId}/status` });
        }
      }
      break;
    }
    case "assignmentDelete": {
      const id = typeof body.id === "string" ? body.id : "";
      const a = id ? await getAssignment(id) : null;
      if (!a || a.courseId !== courseId || a.studentId !== studentId) return NextResponse.json({ error: "과제를 찾을 수 없습니다." }, { status: 404 });
      if (a.studentId !== g.session.userId && !g.staff) return forbidden("본인이 올린 과제만 삭제할 수 있습니다.");
      await deleteAssignment(id);
      {
        // 이 과제를 피어리뷰로 받은 학생들에게 '삭제됨' 반영·알림 (작성자·파일명 스탬프 → 재업로드 매칭 보장)
        const affected = await markPeerReviewsDeleted(courseId, id, a.studentId, a.name);
        for (const rid of affected) {
          try { publishMentoring(courseId, rid, await loadRoom(courseId, rid)); } catch { /* 무시 */ }
          pingUser(rid);
        }
        if (affected.length) {
          const stu = await prisma.user.findUnique({ where: { id: a.studentId }, select: { email: true, studentProfile: { select: { realName: true } } } });
          const who = stu?.studentProfile?.realName || stu?.email || "학생";
          await createNotifications(affected.map((uid) => ({ userId: uid, kind: "peer", title: "배정된 과제가 삭제되었어요", body: "작성자가 과제를 회수했습니다. 다시 업로드될 때까지 기다려주세요.", href: `/course/${courseId}/mentoring` })));
          await notifyCourseStaff(courseId, g.session.userId, { kind: "peer", title: "피어리뷰 과제 삭제", body: `${who} 학생 과제 삭제 → ${affected.length}명에게 반영`, href: `/course/${courseId}/status` });
        }
      }
      break;
    }
    default:
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  publishMentoring(courseId, studentId, await loadRoom(courseId, studentId));

  // 알림(best-effort) — 실패해도 저장된 변경엔 영향 없음
  try {
    if (body.action === "chat" || body.action === "chatFile") {
      // 1:1 채팅 → 채팅 알람(실시간 배지). 학생·스태프 + 학부모 모두.
      if (senderRole === "teacher") pingUser(studentId);
      else pingCourseStaff(courseId);
      for (const pid of await approvedParentIds(studentId)) if (pid !== g.session.userId) pingUser(pid);
    } else {
      // 그 외 모든 변동(공지·세특·보고서·독서·과제) → 학생·학부모(+담당 퍼실) 알림
      const NOTICES: Record<string, { kind: string; title: string; includeStaff: boolean }> = {
        sete: { kind: "notice", title: "세특(세부능력 특기사항)이 업데이트되었어요", includeStaff: true },
        notice: { kind: "notice", title: "새 개별 공지가 등록되었어요", includeStaff: true },
        editNotice: { kind: "notice", title: "개별 공지가 수정되었어요", includeStaff: true },
        deleteNotice: { kind: "notice", title: "개별 공지가 삭제되었어요", includeStaff: true },
        report: { kind: "notice", title: "탐구 보고서가 업데이트되었어요", includeStaff: true },
        reportFile: { kind: "notice", title: "탐구 보고서 파일이 변경되었어요", includeStaff: true },
        books: { kind: "notice", title: "독서활동상황이 업데이트되었어요", includeStaff: true },
        assignmentAdd: { kind: "assignment", title: "새 과제가 업로드되었어요", includeStaff: false },
        assignmentDelete: { kind: "assignment", title: "과제가 삭제되었어요", includeStaff: false },
      };
      const cn = NOTICES[body.action ?? ""];
      if (cn) {
        await notifyMentoringRoom(courseId, studentId, g.session.userId, { kind: cn.kind, title: cn.title, body: "탐구활동 멘토링에서 확인하세요.", href: `/course/${courseId}/mentoring` }, { includeStaff: cn.includeStaff });
      }
    }
  } catch {
    /* 알림 실패는 무시 */
  }
  return NextResponse.json({ ok: true });
}
