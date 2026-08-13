import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { clearEmailCode, isEmailVerified } from "@/lib/email-code-store";
import { prisma } from "@/lib/prisma";

/**
 * 회원 탈퇴 — 본인 계정을 완전(하드) 삭제. 이메일 인증(6자리 코드) 완료 후에만 허용.
 * FK Restrict 관계(공지·프로젝트·게시글·댓글)를 먼저 지우고 user 삭제(나머지는 cascade).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);
    const id = auth.userId;

    const me = await prisma.user.findUnique({ where: { id }, select: { email: true } });
    if (!me) return NextResponse.json({ error: "계정을 찾을 수 없습니다." }, { status: 404 });
    if (!(await isEmailVerified(me.email))) {
      return NextResponse.json({ error: "이메일 인증을 먼저 완료해 주세요." }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.comment.deleteMany({ where: { createdBy: id } });
      await tx.post.deleteMany({ where: { createdBy: id } });
      await tx.announcement.deleteMany({ where: { createdBy: id } });
      await tx.auditLog.deleteMany({ where: { actorUserId: id } });
      await tx.project.deleteMany({ where: { ownerId: id } });
      await tx.facilitatorCourse.deleteMany({ where: { facilitatorUserId: id } });
      await tx.user.delete({ where: { id } });
    });
    await clearEmailCode(me.email);

    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0, sameSite: "lax" });
    return res;
  } catch (error) {
    return jsonError(error);
  }
}
