import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { deleteLocalSignup, isDbConnectionError } from "@/lib/local-signup-store";
import { HttpError, jsonError, requireSuperAdmin } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  action: z.enum(["WITHDRAW", "CANCEL_SIGNUP"]),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireSuperAdmin(request);
    const { id } = await params;
    const { action } = bodySchema.parse(await request.json());

    const normalizedAction = action === "CANCEL_SIGNUP" ? "WITHDRAW" : action;

    if (
      normalizedAction === "WITHDRAW" &&
      process.env.NODE_ENV === "production" &&
      process.env.ALLOW_MEMBER_WITHDRAW_IN_PROD !== "true"
    ) {
      throw new HttpError(
        403,
        "운영 환경에서 강제 탈퇴는 잠겨 있습니다. 허용 시 ALLOW_MEMBER_WITHDRAW_IN_PROD=true를 설정하세요."
      );
    }

    if (id.startsWith("local_")) {
      if (normalizedAction === "WITHDRAW") {
        const removed = await deleteLocalSignup(id);
        if (!removed) {
          return NextResponse.json({ error: "Member not found" }, { status: 404 });
        }
      }

      return NextResponse.json({ ok: true, source: "local" });
    }

    try {
      const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
      if (!user) {
        return NextResponse.json({ error: "Member not found" }, { status: 404 });
      }

      await prisma.$transaction(async (tx) => {
        if (normalizedAction === "WITHDRAW") {
          await tx.projectMember.deleteMany({ where: { userId: id } });
          await tx.application.deleteMany({ where: { applicantId: id } });
          await tx.groupMember.deleteMany({ where: { userId: id } });
          await tx.comment.deleteMany({ where: { createdBy: id } });
          await tx.post.deleteMany({ where: { createdBy: id } });
          await tx.group.deleteMany({ where: { project: { ownerId: id } } });
          await tx.project.deleteMany({ where: { ownerId: id } });
          await tx.verificationSubmission.deleteMany({ where: { userId: id } });
          await tx.studentProfile.deleteMany({ where: { userId: id } });
          await tx.entitlement.deleteMany({ where: { userId: id } });
          await tx.auditLog.deleteMany({ where: { actorUserId: id } });
          await tx.user.delete({ where: { id } });

          await tx.auditLog.create({
            data: {
              actorUserId: admin.userId,
              actionType: "MEMBER_WITHDRAWN",
              targetType: "UserDeletion",
              targetId: id,
              metadataJson: { action: normalizedAction },
            },
          });
        }

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
