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
  residenceCountry?: unknown;
  phone?: unknown;
  entranceYear?: unknown;
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
    const residenceCountry = asTrimmedOptionalString(body.residenceCountry);

    const me = await prisma.user.findUnique({ where: { id: auth.userId }, select: { role: true } });
    if (!realName) {
      return NextResponse.json({ error: "이름(실명)은 필수입니다." }, { status: 400 });
    }
    if (me?.role === "STUDENT" && (!schoolName || !grade)) {
      return NextResponse.json({ error: "학생은 학교·졸업 예정 연도가 필수입니다." }, { status: 400 });
    }

    const profile = await prisma.studentProfile.upsert({
      where: { userId: auth.userId },
      create: {
        userId: auth.userId,
        realName,
        schoolName,
        grade,
        residenceCountry,
      },
      update: {
        realName,
        schoolName,
        grade,
        residenceCountry,
      },
      select: {
        realName: true,
        schoolName: true,
        grade: true,
        className: true,
        number: true,
        bio: true,
        residenceCountry: true,
      },
    });

    // 퍼실리테이터: 연락처·입학연도(신청서)도 함께 갱신
    if (me?.role === "FACILITATOR") {
      const phone = asTrimmedOptionalString(body.phone);
      const ey = typeof body.entranceYear === "string" && /^\d{4}$/.test(body.entranceYear) ? Number(body.entranceYear) : null;
      const data: Record<string, unknown> = {};
      if (phone !== null) data.phone = phone;
      if (ey !== null) data.entranceYear = ey;
      if (Object.keys(data).length) {
        await prisma.facilitatorApplication.updateMany({ where: { userId: auth.userId }, data });
      }
    }

    return NextResponse.json({ profile });
  } catch (error) {
    return jsonError(error);
  }
}
