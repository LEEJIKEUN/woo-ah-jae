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

// 게시글 수정 — 작성자 본인만
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ courseId: string; postId: string }> }) {
  const { courseId, postId } = await params;
  const s = await sessionFromReq(request);
  if (!s) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const post = await prisma.coursePost.findFirst({ where: { id: postId, courseId }, select: { authorId: true } });
  if (!post) return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
  if (post.authorId !== s.userId) return NextResponse.json({ error: "본인이 작성한 글만 수정할 수 있습니다." }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { title?: unknown; body?: unknown } | null;
  const data: { title?: string; body?: string } = {};
  if (typeof body?.title === "string") {
    const t = body.title.trim();
    if (!t) return NextResponse.json({ error: "제목을 입력하세요." }, { status: 400 });
    data.title = t.slice(0, 200);
  }
  if (typeof body?.body === "string") data.body = body.body.slice(0, 20000);
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "수정할 내용이 없습니다." }, { status: 400 });

  const updated = await prisma.coursePost.update({ where: { id: postId }, data, select: { id: true, title: true, body: true } });
  return NextResponse.json({ ok: true, post: updated });
}

// 게시글 삭제 — 작성자 본인 또는 스태프(관리자·퍼실리테이터)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ courseId: string; postId: string }> }) {
  const { courseId, postId } = await params;
  const s = await sessionFromReq(request);
  if (!s) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const post = await prisma.coursePost.findFirst({ where: { id: postId, courseId }, select: { authorId: true } });
  if (!post) return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
  if (post.authorId !== s.userId && !isStaffRole(s.role)) {
    return NextResponse.json({ error: "삭제 권한이 없습니다." }, { status: 403 });
  }
  await prisma.coursePost.delete({ where: { id: postId } });
  return NextResponse.json({ ok: true });
}
