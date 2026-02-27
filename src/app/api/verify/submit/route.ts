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

    const realName = form.get("realName");
    const schoolName = form.get("schoolName");
    const grade = form.get("grade");
    const className = form.get("className");
    const number = form.get("number");
    const docTypeRaw = form.get("docType");
    const file = form.get("file");

    if (
      typeof realName !== "string" ||
      typeof schoolName !== "string" ||
      typeof grade !== "string" ||
      typeof docTypeRaw !== "string" ||
      !(file instanceof File)
    ) {
      return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    }

    if (!VALID_DOC_TYPE.has(docTypeRaw as VerificationDocType)) {
      return NextResponse.json({ error: "Invalid docType" }, { status: 400 });
    }

    validateUpload(file);
    const fileKey = await savePrivateFile(file);

    await prisma.studentProfile.upsert({
      where: { userId: auth.userId },
      update: {
        realName,
        schoolName,
        grade,
        className: typeof className === "string" && className.trim() ? className : null,
        number: typeof number === "string" && number.trim() ? number : null,
      },
      create: {
        userId: auth.userId,
        realName,
        schoolName,
        grade,
        className: typeof className === "string" && className.trim() ? className : null,
        number: typeof number === "string" && number.trim() ? number : null,
      },
    });

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
    });

    return NextResponse.json({ id: submission.id, status: submission.status }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unsupported file type" || error.message === "File too large") {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }
    return jsonError(error);
  }
}
