import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword } from "@/lib/auth";
import { clearEmailCode, isEmailVerified } from "@/lib/email-code-store";
import { createLocalSignup, isDbConnectionError, listLocalSignups } from "@/lib/local-signup-store";
import { prisma } from "@/lib/prisma";

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  passwordConfirm: z.string().min(8).max(72),
  realName: z.string().min(1).max(80),
  residenceCountry: z.string().min(1).max(80),
  schoolName: z.string().min(1).max(120),
  birthDate: z.string().date(),
  // 졸업 예정 연도 (예: "2028년 1(2)월") — grade 컬럼(String)에 저장
  grade: z.string().min(1).max(40),
});

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();

    const parsed = signupSchema.parse({
      email: form.get("email"),
      password: form.get("password"),
      passwordConfirm: form.get("passwordConfirm"),
      realName: form.get("realName"),
      residenceCountry: form.get("residenceCountry"),
      schoolName: form.get("schoolName"),
      birthDate: form.get("birthDate"),
      grade: form.get("grade"),
    });

    if (parsed.password !== parsed.passwordConfirm) {
      return NextResponse.json({ error: "비밀번호 확인이 일치하지 않습니다." }, { status: 400 });
    }

    if (!(await isEmailVerified(parsed.email))) {
      return NextResponse.json({ error: "이메일 인증을 완료해 주세요." }, { status: 400 });
    }

    const finalSchoolName = parsed.schoolName.trim();
    if (!finalSchoolName) {
      return NextResponse.json({ error: "학교명을 입력해주세요." }, { status: 400 });
    }

    const localDup = (await listLocalSignups()).some((x) => x.email === parsed.email);
    if (localDup) {
      return NextResponse.json({ error: "이미 신청된 이메일입니다." }, { status: 409 });
    }

    const passwordHash = await hashPassword(parsed.password);

    try {
      const exists = await prisma.user.findUnique({ where: { email: parsed.email } });
      if (exists) {
        return NextResponse.json({ error: "이미 사용 중인 이메일입니다." }, { status: 409 });
      }

      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: parsed.email,
            passwordHash,
            role: UserRole.STUDENT,
          },
        });

        await tx.studentProfile.create({
          data: {
            userId: user.id,
            realName: parsed.realName.trim(),
            schoolName: finalSchoolName,
            residenceCountry: parsed.residenceCountry,
            birthDate: new Date(parsed.birthDate),
            grade: parsed.grade,
            className: null,
            number: null,
          },
        });

        return user;
      });

      await clearEmailCode(parsed.email);

      return NextResponse.json(
        {
          id: result.id,
          email: result.email,
          status: "ACTIVE",
          fallback: false,
        },
        { status: 201 }
      );
    } catch (dbError) {
      if (!isDbConnectionError(dbError)) throw dbError;

      const local = await createLocalSignup({
        email: parsed.email,
        passwordHash,
        schoolName: finalSchoolName,
        grade: parsed.grade,
        residenceCountry: parsed.residenceCountry,
        birthDate: parsed.birthDate,
        fileKey: "",
        originalFilename: "",
        mimeType: "",
        sizeBytes: 0,
      });

      await clearEmailCode(parsed.email);

      return NextResponse.json(
        {
          id: local.id,
          email: local.email,
          status: local.status,
          fallback: true,
        },
        { status: 201 }
      );
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "입력값이 올바르지 않습니다." },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
