import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

/**
 * 회원 탈퇴 — 본인 계정을 완전(하드) 삭제. 같은 이메일로 즉시 재가입 가능.
 * FK Restrict 관계(공지·프로젝트·게시글·댓글)를 먼저 지우고 user 삭제(나머지는 cascade).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);
    const id = auth.userId;

    await prisma.$transaction(async (tx) => {
      await tx.comment.deleteMany({ where: { createdBy: id } });
      await tx.post.deleteMany({ where: { createdBy: id } });
      await tx.announcement.deleteMany({ where: { createdBy: id } });
      await tx.auditLog.deleteMany({ where: { actorUserId: id } });
      await tx.project.deleteMany({ where: { ownerId: id } });
      await tx.facilitatorCourse.deleteMany({ where: { facilitatorUserId: id } });
      await tx.user.delete({ where: { id } });
    });

    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0, sameSite: "lax" });
    return res;
  } catch (error) {
    return jsonError(error);
  }
}
