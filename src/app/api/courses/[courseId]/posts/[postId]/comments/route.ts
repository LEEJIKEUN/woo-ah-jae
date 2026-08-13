import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { getCourse } from "@/lib/course/content";
import { canEnterClassroom, isStaffRole } from "@/lib/course/access";
import { isUserEnrolled } from "@/lib/enrollment-store";
import { createNotifications, type NotificationInput } from "@/lib/notification-store";
import { prisma } from "@/lib/prisma";

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

  const raw = (await request.json().catch(() => null)) as { body?: unknown; parentCommentId?: unknown } | null;
  const text = String(typeof raw?.body === "string" ? raw.body : "").trim().slice(0, 5000);
  if (!text) return NextResponse.json({ error: "내용을 입력해 주세요." }, { status: 400 });

  let parentCommentId = typeof raw?.parentCommentId === "string" ? raw.parentCommentId : null;
  let parentAuthorId: string | null = null;
  if (parentCommentId) {
    const parent = await prisma.coursePostComment.findFirst({ where: { id: parentCommentId, postId }, select: { id: true, authorId: true } });
    if (!parent) parentCommentId = null;
    else parentAuthorId = parent.authorId;
  }

  const c = await prisma.coursePostComment.create({ data: { postId, authorId: s.userId, body: text, parentCommentId } });

  // 알림: 글쓴이(+답글이면 부모 댓글 작성자)에게 — 본인 제외, 중복 제외
  const href = `/course/${courseId}/${post.kind === "NOTICE" ? "notices" : "board"}`;
  const notify: NotificationInput[] = [];
  if (post.authorId !== s.userId) notify.push({ userId: post.authorId, kind: "comment", title: `내 글에 새 댓글 · ${post.title}`, body: text, href });
  if (parentAuthorId && parentAuthorId !== s.userId && parentAuthorId !== post.authorId) notify.push({ userId: parentAuthorId, kind: "comment", title: "내 댓글에 답글이 달렸어요", body: text, href });
  await createNotifications(notify);

  return NextResponse.json({ ok: true, id: c.id }, { status: 201 });
}
