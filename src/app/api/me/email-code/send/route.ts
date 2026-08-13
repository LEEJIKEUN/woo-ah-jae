import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { requestEmailCode } from "@/lib/email-code-store";
import { sendEmailVerificationCode } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";

const EXPIRES_MIN = 10;

/** 로그인한 본인의 가입 이메일로 6자리 인증코드 발송 (비밀번호 변경·회원 탈퇴 공용). */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);
    const user = await prisma.user.findUnique({ where: { id: auth.userId }, select: { email: true } });
    if (!user) return NextResponse.json({ error: "계정을 찾을 수 없습니다." }, { status: 404 });

    const result = await requestEmailCode(user.email);
    if ("error" in result) {
      return NextResponse.json({ error: result.error, retryAfterSec: result.retryAfterSec }, { status: 429 });
    }

    try {
      await sendEmailVerificationCode({ to: user.email, code: result.code, expiresMinutes: EXPIRES_MIN });
    } catch (mailError) {
      if (process.env.NODE_ENV === "production") {
        console.error("[me/email-code] mail delivery failed:", mailError);
        return NextResponse.json({ error: "인증 메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });
      }
      console.warn("[me/email-code] mail delivery failed (non-prod):", mailError);
    }

    return NextResponse.json({
      message: `인증코드를 이메일(${user.email})로 보냈습니다. ${EXPIRES_MIN}분 내에 입력해 주세요.`,
      ...(process.env.NODE_ENV !== "production" ? { devCode: result.code } : {}),
    });
  } catch (error) {
    return jsonError(error);
  }
}
