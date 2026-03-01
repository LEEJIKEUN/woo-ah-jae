import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { UserLifecycleStatus } from "@prisma/client";
import { deleteLocalSignup, isDbConnectionError } from "@/lib/local-signup-store";
import { HttpError, jsonError, requireSuperAdmin } from "@/lib/guards";
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
      const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
      if (!user) {
        return NextResponse.json({ error: "Member not found" }, { status: 404 });
      }

      await prisma.$transaction(async (tx) => {
        const nextStatus =
          normalizedAction === "MOVE_DELETED"
            ? UserLifecycleStatus.DELETED
            : normalizedAction === "MOVE_ACHIEVED"
              ? UserLifecycleStatus.ACHIEVED
              : UserLifecycleStatus.ACTIVE;

        await tx.user.update({
          where: { id },
          data: {
            lifecycleStatus: nextStatus,
            deletedAt: nextStatus === UserLifecycleStatus.DELETED ? new Date() : null,
            achievedAt: nextStatus === UserLifecycleStatus.ACHIEVED ? new Date() : null,
          },
        });

        await tx.auditLog.create({
          data: {
            actorUserId: admin.userId,
            actionType:
              normalizedAction === "MOVE_DELETED"
                ? "MEMBER_MOVED_DELETED"
                : normalizedAction === "MOVE_ACHIEVED"
                  ? "MEMBER_MOVED_ACHIEVED"
                  : "MEMBER_RESTORED_ACTIVE",
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
