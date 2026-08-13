import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { getCourse } from "@/lib/course/content";
import { canEnterClassroom, isStaffRole } from "@/lib/course/access";
import { isUserEnrolled } from "@/lib/enrollment-store";
import { createNotifications, courseStaffIds, notifyMentions, type NotificationInput } from "@/lib/notification-store";
import { storeUploadDataUrl } from "@/lib/private-file";
import { prisma } from "@/lib/prisma";

const MAX_COMMENT_FILE = 10 * 1024 * 1024; // 10MB

/**
 * 게시글 댓글 목록/작성(대댓글 지원).
 * - 조회: 강의실 접근 가능한 사용자
 * - 작성: 스태프 or 수강 학생(학부모 제외)
 */
async function sessionFromReq(request: NextRequest) {
  try {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string; postId: string }> }) {
  const { courseId, postId } = await params;
  if (!getCourse(courseId)) return NextResponse.json({ error: "강좌를 찾을 수 없습니다." }, { status: 404 });
  const s = await sessionFromReq(request);
  if (!s) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!(await canEnterClassroom(courseId, s))) return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });

  const comments = await prisma.coursePostComment.findMany({
    where: { postId, post: { courseId } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      body: true,
      parentCommentId: true,
      createdAt: true,
      authorId: true,
      fileName: true,
      fileMime: true,
      fileSize: true,
      author: { select: { role: true, studentProfile: { select: { realName: true } } } },
    },
  });

  return NextResponse.json({
    comments: comments.map((c) => ({
      id: c.id,
      body: c.body,
      parentCommentId: c.parentCommentId,
      createdAt: c.createdAt,
      authorId: c.authorId,
      authorName: c.author.studentProfile?.realName ?? "사용자",
      authorRole: c.author.role,
      file: c.fileName ? { name: c.fileName, size: c.fileSize ?? 0, mime: c.fileMime ?? "application/octet-stream" } : null,
    })),
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ courseId: string; postId: string }> }) {
  const { courseId, postId } = await params;
  if (!getCourse(courseId)) return NextResponse.json({ error: "강좌를 찾을 수 없습니다." }, { status: 404 });
  const s = await sessionFromReq(request);
  if (!s) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const staff = isStaffRole(s.role);
  const enrolledStudent = !staff && s.role === "STUDENT" && (await isUserEnrolled(courseId, s.userId));
  if (!staff && !enrolledStudent) {
    return NextResponse.json({ error: "댓글 작성 권한이 없습니다." }, { status: 403 });
  }

  const post = await prisma.coursePost.findFirst({ where: { id: postId, courseId }, select: { id: true, authorId: true, kind: true, title: true } });
  if (!post) return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });

  const raw = (await request.json().catch(() => null)) as { body?: unknown; parentCommentId?: unknown; file?: unknown } | null;
  const text = String(typeof raw?.body === "string" ? raw.body : "").trim().slice(0, 5000);
  const rawFile = raw?.file as { name?: unknown; size?: unknown; mime?: unknown; dataUrl?: unknown } | undefined;
  const hasFile = !!rawFile && typeof rawFile.dataUrl === "string" && typeof rawFile.name === "string";
  if (!text && !hasFile) return NextResponse.json({ error: "내용을 입력해 주세요." }, { status: 400 });
  if (hasFile && typeof rawFile!.size === "number" && rawFile!.size > MAX_COMMENT_FILE) {
    return NextResponse.json({ error: "파일이 너무 큽니다. (최대 10MB)" }, { status: 400 });
  }

  let parentCommentId = typeof raw?.parentCommentId === "string" ? raw.parentCommentId : null;
  let parentAuthorId: string | null = null;
  if (parentCommentId) {
    const parent = await prisma.coursePostComment.findFirst({ where: { id: parentCommentId, postId }, select: { id: true, authorId: true } });
    if (!parent) parentCommentId = null;
    else parentAuthorId = parent.authorId;
  }

  let fileData: { fileName: string; fileMime: string; fileSize: number; fileKey: string | null; fileData: string | null } | null = null;
  if (hasFile) {
    const name = String(rawFile!.name).slice(0, 200);
    const mime = typeof rawFile!.mime === "string" ? rawFile!.mime.slice(0, 120) : "application/octet-stream";
    const size = typeof rawFile!.size === "number" ? rawFile!.size : 0;
    const ref = await storeUploadDataUrl(`board/${courseId}/${postId}`, name, mime, String(rawFile!.dataUrl));
    fileData = { fileName: name, fileMime: mime, fileSize: size, fileKey: ref.key, fileData: ref.data };
  }

  const c = await prisma.coursePostComment.create({ data: { postId, authorId: s.userId, body: text, parentCommentId, ...(fileData ?? {}) } });

  // 알림: 글쓴이(+답글이면 부모 댓글 작성자) + 강좌 스태프 전원 — 본인 제외, 중복 제외
  const href = `/course/${courseId}/${post.kind === "NOTICE" ? "notices" : "board"}`;
  const notify: NotificationInput[] = [];
  const done = new Set<string>([s.userId]);
  const add = (uid: string | null | undefined, title: string) => {
    if (uid && !done.has(uid)) {
      done.add(uid);
      notify.push({ userId: uid, kind: "comment", title, body: text || "📎 파일", href });
    }
  };
  add(post.authorId, `내 글에 새 댓글 · ${post.title}`);
  add(parentAuthorId, "내 댓글에 답글이 달렸어요");
  for (const st of await courseStaffIds(courseId)) add(st, `새 댓글 · ${post.title}`);
  await createNotifications(notify);
  // @이름 멘션 → 해당 학생(+학부모) 알림
  await notifyMentions(courseId, text, { actorUserId: s.userId, href, context: "댓글" });

  return NextResponse.json({ ok: true, id: c.id }, { status: 201 });
}
