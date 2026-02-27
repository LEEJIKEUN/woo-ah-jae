import { VerificationStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { decideLocalSignup, isDbConnectionError } from "@/lib/local-signup-store";
import { jsonError, requireAdmin } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

const bodySchema = z.discriminatedUnion("decision", [
  z.object({
    decision: z.literal("APPROVE"),
  }),
  z.object({
    decision: z.literal("REJECT"),
    rejectReasonCode: z.string().min(1),
    rejectReasonText: z.string().min(1),
  }),
]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(request);
    const { id } = await params;
    const body = bodySchema.parse(await request.json());

    if (id.startsWith("local_")) {
      const localResult = await decideLocalSignup(
        id,
        body.decision,
        admin.userId,
        body.decision === "REJECT" ? body.rejectReasonCode : undefined,
        body.decision === "REJECT" ? body.rejectReasonText : undefined
      );

      if (!localResult) {
        return NextResponse.json({ error: "Submission not found" }, { status: 404 });
      }
      if ("error" in localResult) {
        return NextResponse.json({ error: localResult.error }, { status: 409 });
      }

      return NextResponse.json({ id: localResult.item.id, status: localResult.item.status, source: "local" });
    }

    try {
      const submission = await prisma.verificationSubmission.findUnique({
        where: { id },
        select: { id: true, userId: true, status: true },
      });

      if (!submission) {
        return NextResponse.json({ error: "Submission not found" }, { status: 404 });
      }

      if (submission.status !== VerificationStatus.PENDING_REVIEW) {
        return NextResponse.json({ error: "Submission already processed" }, { status: 409 });
      }

      const nextStatus =
        body.decision === "APPROVE"
          ? VerificationStatus.VERIFIED
          : VerificationStatus.REJECTED;

      const updated = await prisma.$transaction(async (tx) => {
        const changed = await tx.verificationSubmission.update({
          where: { id: submission.id },
          data: {
            status: nextStatus,
            reviewedAt: new Date(),
            reviewedBy: admin.userId,
            rejectReasonCode: body.decision === "REJECT" ? body.rejectReasonCode : null,
            rejectReasonText: body.decision === "REJECT" ? body.rejectReasonText : null,
          },
        });

        await tx.auditLog.create({
          data: {
            actorUserId: admin.userId,
            actionType:
              body.decision === "APPROVE"
                ? "VERIFICATION_APPROVED"
                : "VERIFICATION_REJECTED",
            targetType: "VerificationSubmission",
            targetId: submission.id,
            metadataJson: {
              submissionId: submission.id,
              userId: submission.userId,
              decision: body.decision,
              rejectReasonCode:
                body.decision === "REJECT" ? body.rejectReasonCode : null,
            },
          },
        });

        return changed;
      });

      return NextResponse.json({ id: updated.id, status: updated.status, source: "db" });
    } catch (dbError) {
      if (!isDbConnectionError(dbError)) throw dbError;
      return NextResponse.json(
        { error: "DB 연결이 없어 로컬 신청 건만 처리할 수 있습니다." },
        { status: 503 }
      );
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2003"
    ) {
      return NextResponse.json(
        { error: "세션 정보가 만료되었습니다. 다시 로그인 후 승인/거절을 진행해주세요." },
        { status: 401 }
      );
    }
    return jsonError(error);
  }
}
