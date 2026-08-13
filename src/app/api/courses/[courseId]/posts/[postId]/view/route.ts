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

/** 조회수 +1 — 게시글을 펼쳐볼 때 호출. { viewCount } 반환. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ courseId: string; postId: string }> }) {
  const { courseId, postId } = await params;
  const s = await sessionFromReq(request);
  if (!s) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!(await canEnterClassroom(courseId, s))) return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });

  try {
    const updated = await prisma.coursePost.update({ where: { id: postId }, data: { viewCount: { increment: 1 } }, select: { viewCount: true } });
    return NextResponse.json({ viewCount: updated.viewCount });
  } catch {
    return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
  }
}
