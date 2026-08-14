import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { UserLifecycleStatus } from "@prisma/client";
import { deleteLocalSignup, findLocalSignupByEmail, isDbConnectionError } from "@/lib/local-signup-store";
import { HttpError, jsonError, requireSuperAdmin } from "@/lib/guards";
import { collectUserCleanup, purgeUserRelations, deleteUserFiles } from "@/lib/user-purge";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  action: z.enum(["WITHDRAW", "CANCEL_SIGNUP", "MOVE_DELETED", "MOVE_ACHIEVED", "RESTORE_ACTIVE"]),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireSuperAdmin(request);
    const { id } = await params;
    const { action } = bodySchema.parse(await request.json());

    const normalizedAction =
      action === "WITHDRAW" || action === "CANCEL_SIGNUP" ? "MOVE_DELETED" : action;

    if (id.startsWith("local_")) {
      if (normalizedAction === "MOVE_DELETED") {
        const removed = await deleteLocalSignup(id);
        if (!removed) {
          return NextResponse.json({ error: "Member not found" }, { status: 404 });
        }
      } else {
        throw new HttpError(400, "로컬 가입자는 삭제 전용 처리만 가능합니다.");
      }

      return NextResponse.json({ ok: true, source: "local" });
    }

    try {
      const user = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true } });
      if (!user) {
        return NextResponse.json({ error: "Member not found" }, { status: 404 });
      }

      // ── 완전 삭제(하드 삭제) ─────────────────────────────
      if (normalizedAction === "MOVE_DELETED") {
        const { r2Keys, attemptIds } = await collectUserCleanup(id);
        await prisma.$transaction(async (tx) => {
          // 삭제를 막는 Restrict FK 대상(작성 콘텐츠·감사로그·소유 프로젝트)을 먼저 정리
          await tx.comment.deleteMany({ where: { createdBy: id } });
          await tx.post.deleteMany({ where: { createdBy: id } });
          await tx.announcement.deleteMany({ where: { createdBy: id } });
          await tx.auditLog.deleteMany({ where: { actorUserId: id } });
          await tx.project.deleteMany({ where: { ownerId: id } });

          // FK 없이 String userId 로만 연결된 흔적(멘토링·피어리뷰·시험·알림 등)도 정리
          await purgeUserRelations(tx, id, attemptIds);

          // 계정 삭제 — 나머지 연관(프로필·인증·토큰·게시판·멤버십 등)은 Cascade 로 함께 삭제
          await tx.user.delete({ where: { id } });

          await tx.auditLog.create({
            data: {
              actorUserId: admin.userId,
              actionType: "MEMBER_HARD_DELETED",
              targetType: "User",
              targetId: id,
              metadataJson: { action: normalizedAction, hardDelete: true, email: user.email },
            },
          });
        });
        await deleteUserFiles(r2Keys); // R2 첨부 파일 실삭제(best-effort)

        // 로컬 가입 캐시(DB 다운 폴백)에 같은 이메일이 남아 있으면 제거 → 이메일 즉시 재사용 가능
        const localDup = await findLocalSignupByEmail(user.email);
        if (localDup) await deleteLocalSignup(localDup.id);

        return NextResponse.json({ ok: true, source: "db", hardDeleted: true });
      }

      // ── 상태 변경(성취/복구) ─────────────────────────────
      await prisma.$transaction(async (tx) => {
        const nextStatus =
          normalizedAction === "MOVE_ACHIEVED"
            ? UserLifecycleStatus.ACHIEVED
            : UserLifecycleStatus.ACTIVE;

        await tx.user.update({
          where: { id },
          data: {
            lifecycleStatus: nextStatus,
            deletedAt: null,
            achievedAt: nextStatus === UserLifecycleStatus.ACHIEVED ? new Date() : null,
          },
        });

        await tx.auditLog.create({
          data: {
            actorUserId: admin.userId,
            actionType:
              normalizedAction === "MOVE_ACHIEVED" ? "MEMBER_MOVED_ACHIEVED" : "MEMBER_RESTORED_ACTIVE",
            targetType: "UserLifecycle",
            targetId: id,
            metadataJson: { action: normalizedAction },
          },
        });
      });

      return NextResponse.json({ ok: true, source: "db" });
    } catch (dbError) {
      if (!isDbConnectionError(dbError)) throw dbError;
      return NextResponse.json({ error: "DB 연결 없음" }, { status: 503 });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    return jsonError(error);
  }
}
