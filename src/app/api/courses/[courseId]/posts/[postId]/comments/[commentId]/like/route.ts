import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { canEnterClassroom } from "@/lib/course/access";
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

/** 댓글 좋아요 토글 — 강의실 접근 가능한 사용자. { liked, likeCount } 반환. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ courseId: string; postId: string; commentId: string }> }) {
  const { courseId, postId, commentId } = await params;
  const s = await sessionFromReq(request);
  if (!s) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!(await canEnterClassroom(courseId, s))) return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });

  const c = await prisma.coursePostComment.findFirst({ where: { id: commentId, postId, post: { courseId } }, select: { id: true } });
  if (!c) return NextResponse.json({ error: "댓글을 찾을 수 없습니다." }, { status: 404 });

  const existing = await prisma.coursePostCommentLike.findUnique({ where: { commentId_userId: { commentId, userId: s.userId } }, select: { commentId: true } });
  let liked: boolean;
  if (existing) {
    await prisma.coursePostCommentLike.delete({ where: { commentId_userId: { commentId, userId: s.userId } } });
    liked = false;
  } else {
    await prisma.coursePostCommentLike.create({ data: { commentId, userId: s.userId } });
    liked = true;
  }
  const likeCount = await prisma.coursePostCommentLike.count({ where: { commentId } });
  return NextResponse.json({ liked, likeCount });
}
