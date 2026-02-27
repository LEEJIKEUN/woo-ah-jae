import { NextRequest, NextResponse } from "next/server";
import { findLocalSignupById, isDbConnectionError } from "@/lib/local-signup-store";
import { jsonError, requireAdmin } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { readPrivateFile } from "@/lib/upload";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request);
    const { id } = await params;

    if (id.startsWith("local_")) {
      const local = await findLocalSignupById(id);
      if (!local) {
        return NextResponse.json({ error: "Submission not found" }, { status: 404 });
      }

      const buffer = await readPrivateFile(local.fileKey);
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": local.mimeType,
          "Content-Disposition": `inline; filename=\"${local.originalFilename}\"`,
        },
      });
    }

    try {
      const submission = await prisma.verificationSubmission.findUnique({
        where: { id },
        select: {
          fileKey: true,
          mimeType: true,
          originalFilename: true,
        },
      });

      if (!submission) {
        return NextResponse.json({ error: "Submission not found" }, { status: 404 });
      }

      const buffer = await readPrivateFile(submission.fileKey);

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": submission.mimeType,
          "Content-Disposition": `inline; filename=\"${submission.originalFilename}\"`,
        },
      });
    } catch (dbError) {
      if (!isDbConnectionError(dbError)) throw dbError;
      return NextResponse.json({ error: "DB 연결 없음" }, { status: 503 });
    }
  } catch (error) {
    return jsonError(error);
  }
}
