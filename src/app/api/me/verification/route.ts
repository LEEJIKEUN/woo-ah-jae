import { VerificationDocType, VerificationStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { savePrivateFile, validateUpload } from "@/lib/upload";

const VALID_DOC_TYPE = new Set(Object.values(VerificationDocType));

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);
    const form = await request.formData();

    const docTypeRaw = form.get("docType");
    const file = form.get("file");

    if (typeof docTypeRaw !== "string" || !(file instanceof File)) {
      return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    }

    if (!VALID_DOC_TYPE.has(docTypeRaw as VerificationDocType)) {
      return NextResponse.json({ error: "Invalid docType" }, { status: 400 });
    }

    validateUpload(file);
    const fileKey = await savePrivateFile(file);

    const submission = await prisma.verificationSubmission.create({
      data: {
        userId: auth.userId,
        status: VerificationStatus.PENDING_REVIEW,
        docType: docTypeRaw as VerificationDocType,
        fileKey,
        originalFilename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      },
      select: {
        id: true,
        status: true,
        docType: true,
        submittedAt: true,
      },
    });

    return NextResponse.json({ submission }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unsupported file type" || error.message === "File too large") {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }
    return jsonError(error);
  }
}
