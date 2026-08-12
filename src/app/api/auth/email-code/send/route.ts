import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requestEmailCode } from "@/lib/email-code-store";
import { isDbConnectionError } from "@/lib/local-signup-store";
import { sendEmailVerificationCode } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";

const schema = z.object({ email: z.string().trim().toLowerCase().email() });
const EXPIRES_MIN = 10;

export async function POST(request: NextRequest) {
  try {
    const { email } = schema.parse(await request.json());

    // 이미 가입된 이메일이면 안내(가입 UX상 노출 허용). DB 불가 시 최종 단계에서 재검사.
    try {
      const exists = await prisma.user.findUnique({ where: { email } });
      if (exists) {
        return NextResponse.json({ error: "이미 가입된 이메일입니다. 로그인해 주세요." }, { status: 409 });
      }
    } catch (dbError) {
      if (!isDbConnectionError(dbError)) throw dbError;
    }

    const result = await requestEmailCode(email);
    if ("error" in result) {
      return NextResponse.json({ error: result.error, retryAfterSec: result.retryAfterSec }, { status: 429 });
    }

    try {
      await sendEmailVerificationCode({ to: email, code: result.code, expiresMinutes: EXPIRES_MIN });
      console.log(`[email-code] sent verification code to=${email}`);
    } catch (mailError) {
      if (process.env.NODE_ENV === "production") {
        console.error("[email-code] mail delivery failed:", mailError);
        return NextResponse.json(
          { error: "인증 메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요." },
          { status: 500 }
        );
      }
      console.warn("[email-code] mail delivery failed in non-production:", mailError);
    }

    return NextResponse.json({
      message: `인증코드를 이메일로 보냈습니다. ${EXPIRES_MIN}분 내에 입력해 주세요.`,
      // 개발 환경에서만 코드 노출(메일함 없이 테스트용)
      ...(process.env.NODE_ENV !== "production" ? { devCode: result.code } : {}),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    if (error instanceof Error && /RESEND_API_KEY|MAIL_FROM|APP_URL/.test(error.message)) {
      return NextResponse.json({ error: "메일 발송 설정에 문제가 있습니다." }, { status: 500 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
