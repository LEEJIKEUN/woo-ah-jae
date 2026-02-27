import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);

    const latest = await prisma.verificationSubmission.findFirst({
      where: { userId: auth.userId },
      orderBy: { submittedAt: "desc" },
      select: {
        id: true,
        status: true,
        docType: true,
        submittedAt: true,
        reviewedAt: true,
        rejectReasonCode: true,
        rejectReasonText: true,
      },
    });

    return NextResponse.json({
      submission: latest,
      status: latest?.status ?? "NOT_SUBMITTED",
    });
  } catch (error) {
    return jsonError(error);
  }
}
