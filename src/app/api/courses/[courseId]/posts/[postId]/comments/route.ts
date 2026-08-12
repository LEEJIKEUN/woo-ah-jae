import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { getCourse } from "@/lib/course/content";
import { canEnterClassroom, isStaffRole } from "@/lib/course/access";
import { isUserEnrolled } from "@/lib/enrollment-store";
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

  const post = await prisma.coursePost.findFirst({ where: { id: postId, courseId }, select: { id: true } });
  if (!post) return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });

  const raw = (await request.json().catch(() => null)) as { body?: unknown; parentCommentId?: unknown } | null;
  const text = String(typeof raw?.body === "string" ? raw.body : "").trim().slice(0, 5000);
  if (!text) return NextResponse.json({ error: "내용을 입력해 주세요." }, { status: 400 });

  let parentCommentId = typeof raw?.parentCommentId === "string" ? raw.parentCommentId : null;
  if (parentCommentId) {
    const parent = await prisma.coursePostComment.findFirst({ where: { id: parentCommentId, postId }, select: { id: true } });
    if (!parent) parentCommentId = null;
  }

  const c = await prisma.coursePostComment.create({ data: { postId, authorId: s.userId, body: text, parentCommentId } });
  return NextResponse.json({ ok: true, id: c.id }, { status: 201 });
}
