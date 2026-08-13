import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { isStaffRole } from "@/lib/course/access";
import { prisma } from "@/lib/prisma";

async function sessionFromReq(request: NextRequest) {
  try {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

// 댓글 수정 — 작성자 본인만
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ courseId: string; postId: string; commentId: string }> }) {
  const { postId, commentId } = await params;
  const s = await sessionFromReq(request);
  if (!s) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const comment = await prisma.coursePostComment.findFirst({ where: { id: commentId, postId }, select: { authorId: true } });
  if (!comment) return NextResponse.json({ error: "댓글을 찾을 수 없습니다." }, { status: 404 });
  if (comment.authorId !== s.userId) return NextResponse.json({ error: "본인이 작성한 댓글만 수정할 수 있습니다." }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { body?: unknown } | null;
  const text = typeof body?.body === "string" ? body.body.trim() : "";
  if (!text) return NextResponse.json({ error: "댓글 내용을 입력하세요." }, { status: 400 });

  await prisma.coursePostComment.update({ where: { id: commentId }, data: { body: text.slice(0, 5000) } });
  return NextResponse.json({ ok: true });
}

// 댓글 삭제 — 작성자 본인 또는 스태프. (대댓글은 cascade 로 함께 삭제)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ courseId: string; postId: string; commentId: string }> }) {
  const { postId, commentId } = await params;
  const s = await sessionFromReq(request);
  if (!s) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const comment = await prisma.coursePostComment.findFirst({ where: { id: commentId, postId }, select: { authorId: true } });
  if (!comment) return NextResponse.json({ error: "댓글을 찾을 수 없습니다." }, { status: 404 });
  if (comment.authorId !== s.userId && !isStaffRole(s.role)) {
    return NextResponse.json({ error: "삭제 권한이 없습니다." }, { status: 403 });
  }
  await prisma.coursePostComment.delete({ where: { id: commentId } });
  return NextResponse.json({ ok: true });
}
