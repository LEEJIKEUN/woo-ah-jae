import crypto from "node:crypto";
import { UserLifecycleStatus, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword } from "@/lib/auth";
import { sendParentConsentEmail } from "@/lib/mailer";
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
  // 퍼실리테이터(강의 담당자) 가입 초대코드 — 일치 시 FACILITATOR 역할로 생성
  facilitatorCode: z.string().max(100).optional(),
});

// 학부모 가입 — 간소 폼(이름·이메일·비밀번호 + 자녀 이메일). 학생 전용 항목은 받지 않음.
const parentSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  passwordConfirm: z.string().min(8).max(72),
  realName: z.string().min(1).max(80),
  childEmail: z.string().email(),
});

/**
 * 같은 이메일의 계정이 소프트삭제(DELETED) 상태면 하드삭제해 이메일을 회수한다.
 * 회원탈퇴·관리자 삭제 후 같은 이메일로 재가입할 수 있게 하기 위함.
 * 반환: "active"=사용 중(재가입 불가) · "reclaimed"=회수함 · "none"=없음
 */
async function reclaimDeletedUser(email: string): Promise<"active" | "reclaimed" | "none"> {
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, lifecycleStatus: true },
  });
  if (!existing) return "none";
  if (existing.lifecycleStatus !== UserLifecycleStatus.DELETED) return "active";
  await prisma.$transaction(async (tx) => {
    await tx.comment.deleteMany({ where: { createdBy: existing.id } });
    await tx.post.deleteMany({ where: { createdBy: existing.id } });
    await tx.announcement.deleteMany({ where: { createdBy: existing.id } });
    await tx.auditLog.deleteMany({ where: { actorUserId: existing.id } });
    await tx.project.deleteMany({ where: { ownerId: existing.id } });
    await tx.user.delete({ where: { id: existing.id } });
  });
  return "reclaimed";
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();

    // 학부모 가입은 별도 경로(자녀 연결 요청 생성)
    if (form.get("accountType") === "parent") {
      return await handleParentSignup(form);
    }

    const parsed = signupSchema.parse({
      email: form.get("email"),
      password: form.get("password"),
      passwordConfirm: form.get("passwordConfirm"),
      realName: form.get("realName"),
      residenceCountry: form.get("residenceCountry"),
      schoolName: form.get("schoolName"),
      birthDate: form.get("birthDate"),
      grade: form.get("grade"),
      facilitatorCode: form.get("facilitatorCode") ?? undefined,
    });

    if (parsed.password !== parsed.passwordConfirm) {
      return NextResponse.json({ error: "비밀번호 확인이 일치하지 않습니다." }, { status: 400 });
    }

    // 퍼실리테이터 초대코드 검증 — 입력됐으면 서버 환경변수와 일치해야 함
    const facilitatorCode = (parsed.facilitatorCode ?? "").trim();
    let signupRole: UserRole = UserRole.STUDENT;
    if (facilitatorCode) {
      const expected = (process.env.FACILITATOR_SIGNUP_CODE ?? "").trim();
      if (!expected || facilitatorCode !== expected) {
        return NextResponse.json({ error: "퍼실리테이터 초대코드가 올바르지 않습니다." }, { status: 403 });
      }
      signupRole = UserRole.FACILITATOR;
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
      const reclaim = await reclaimDeletedUser(parsed.email);
      if (reclaim === "active") {
        return NextResponse.json({ error: "이미 사용 중인 이메일입니다." }, { status: 409 });
      }

      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: parsed.email,
            passwordHash,
            role: signupRole,
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

async function handleParentSignup(form: FormData): Promise<NextResponse> {
  const parsed = parentSchema.parse({
    email: form.get("email"),
    password: form.get("password"),
    passwordConfirm: form.get("passwordConfirm"),
    realName: form.get("realName"),
    childEmail: form.get("childEmail"),
  });

  if (parsed.password !== parsed.passwordConfirm) {
    return NextResponse.json({ error: "비밀번호 확인이 일치하지 않습니다." }, { status: 400 });
  }

  const email = parsed.email.trim().toLowerCase();
  const childEmail = parsed.childEmail.trim().toLowerCase();
  if (email === childEmail) {
    return NextResponse.json({ error: "자녀 이메일은 본인 이메일과 달라야 합니다." }, { status: 400 });
  }
  if (!(await isEmailVerified(parsed.email))) {
    return NextResponse.json({ error: "이메일 인증을 완료해 주세요." }, { status: 400 });
  }

  // 자녀(학생) 계정 확인 — 실제 존재하는 활성 학생만 연결 요청 가능
  const child = await prisma.user.findUnique({
    where: { email: childEmail },
    select: { id: true, role: true, lifecycleStatus: true, studentProfile: { select: { realName: true } } },
  });
  if (!child || child.role !== UserRole.STUDENT || child.lifecycleStatus !== UserLifecycleStatus.ACTIVE) {
    return NextResponse.json({ error: "해당 이메일의 학생 계정을 찾을 수 없습니다." }, { status: 404 });
  }

  const reclaim = await reclaimDeletedUser(email);
  if (reclaim === "active") {
    return NextResponse.json({ error: "이미 사용 중인 이메일입니다." }, { status: 409 });
  }

  const passwordHash = await hashPassword(parsed.password);
  const consentToken = crypto.randomBytes(24).toString("hex");
  const parentName = parsed.realName.trim();
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email, passwordHash, role: UserRole.PARENT },
    });
    // 이름 표시용 최소 프로필(학교·학년은 학부모라 비움 → nullable)
    await tx.studentProfile.create({
      data: { userId: user.id, realName: parentName },
    });
    // 자녀 연결 요청(PENDING) — 자녀가 이메일 링크 또는 앱 배너에서 동의해야 APPROVED
    await tx.parentChildLink.create({
      data: { parentUserId: user.id, childUserId: child.id, consentToken },
    });
    return user;
  });

  await clearEmailCode(parsed.email);

  // 자녀 이메일로 동의 요청 링크 발송(실패해도 가입은 유지 — 앱 내 배너로도 동의 가능)
  try {
    const base = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "").replace(/\/$/, "");
    await sendParentConsentEmail({
      to: childEmail,
      childName: child.studentProfile?.realName || "학생",
      parentName,
      parentEmail: email,
      consentUrl: `${base}/parent-consent?token=${consentToken}`,
    });
  } catch {
    /* 이메일 발송 실패는 무시 */
  }

  return NextResponse.json(
    { id: result.id, email: result.email, status: "ACTIVE", role: "PARENT", pendingChild: childEmail, fallback: false },
    { status: 201 }
  );
}
