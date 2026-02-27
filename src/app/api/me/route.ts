import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest, getUserVerificationStatus, jsonError } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        studentProfile: {
          select: {
            realName: true,
            schoolName: true,
            grade: true,
            className: true,
            number: true,
            bio: true,
            residenceCountry: true,
            birthDate: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const verificationStatus = await getUserVerificationStatus(user.id);
    const latestVerification = await prisma.verificationSubmission.findFirst({
      where: { userId: user.id },
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
      ...user,
      verificationStatus,
      verificationSubmission: latestVerification,
    });
  } catch (error) {
    return jsonError(error);
  }
}

type ProfilePayload = {
  realName?: unknown;
  schoolName?: unknown;
  grade?: unknown;
  className?: unknown;
  number?: unknown;
  bio?: unknown;
};

function asTrimmedOptionalString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);
    const body = (await request.json()) as ProfilePayload;

    const realName = asTrimmedOptionalString(body.realName);
    const schoolName = asTrimmedOptionalString(body.schoolName);
    const grade = asTrimmedOptionalString(body.grade);
    const className = asTrimmedOptionalString(body.className);
    const number = asTrimmedOptionalString(body.number);
    const bio = asTrimmedOptionalString(body.bio);

    if (!realName || !schoolName || !grade) {
      return NextResponse.json(
        { error: "실명, 학교, 학년은 필수입니다." },
        { status: 400 },
      );
    }

    const profile = await prisma.studentProfile.upsert({
      where: { userId: auth.userId },
      create: {
        userId: auth.userId,
        realName,
        schoolName,
        grade,
        className,
        number,
        bio,
      },
      update: {
        realName,
        schoolName,
        grade,
        className,
        number,
        bio,
      },
      select: {
        realName: true,
        schoolName: true,
        grade: true,
        className: true,
        number: true,
        bio: true,
      },
    });

    return NextResponse.json({ profile });
  } catch (error) {
    return jsonError(error);
  }
}
