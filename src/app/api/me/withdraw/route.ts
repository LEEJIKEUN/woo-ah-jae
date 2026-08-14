import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { clearEmailCode, isEmailVerified } from "@/lib/email-code-store";
import { collectUserCleanup, purgeUserRelations, deleteUserFiles } from "@/lib/user-purge";
import { prisma } from "@/lib/prisma";

/**
 * 회원 탈퇴 — 본인 계정을 완전(하드) 삭제. 이메일 인증(6자리 코드) 완료 후에만 허용.
 * FK Restrict 관계 + FK 없는 흔적(멘토링·피어리뷰·시험·알림 등)까지 모두 정리한 뒤 user 삭제.
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

    const { r2Keys, attemptIds } = await collectUserCleanup(id);

    await prisma.$transaction(
      async (tx) => {
        // FK Restrict 관계(작성 콘텐츠·감사로그·소유 프로젝트) 먼저
        await tx.comment.deleteMany({ where: { createdBy: id } });
        await tx.post.deleteMany({ where: { createdBy: id } });
        await tx.announcement.deleteMany({ where: { createdBy: id } });
        await tx.auditLog.deleteMany({ where: { actorUserId: id } });
        await tx.project.deleteMany({ where: { ownerId: id } });
        await tx.facilitatorCourse.deleteMany({ where: { facilitatorUserId: id } });
        // FK 없는 흔적 정리
        await purgeUserRelations(tx, id, attemptIds);
        await tx.user.delete({ where: { id } });
      },
      { timeout: 20000 }
    );
    await clearEmailCode(me.email);
    await deleteUserFiles(r2Keys);

    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0, sameSite: "lax" });
    return res;
  } catch (error) {
    return jsonError(error);
  }
}
