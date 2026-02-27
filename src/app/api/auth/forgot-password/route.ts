import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendPasswordResetEmail } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";
import { createPasswordResetToken } from "@/lib/password-reset";

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

const SUCCESS_MESSAGE = "입력하신 이메일로 비밀번호 재설정 안내를 보냈습니다. 메일함을 확인해 주세요.";

export async function POST(request: NextRequest) {
  try {
    const body = schema.parse(await request.json());

    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user) {
      return NextResponse.json({ error: "등록되지 않은 이메일입니다." }, { status: 404 });
    }

    let devResetUrl: string | undefined;
    let devWarning: string | undefined;
    const { token, tokenHash } = createPasswordResetToken();
    const expiresMinutes = 30;
    const expiresAt = new Date(Date.now() + expiresMinutes * 60 * 1000);

    await prisma.passwordResetToken.deleteMany({
      where: {
        userId: user.id,
        OR: [{ usedAt: null }, { expiresAt: { lt: new Date() } }],
      },
    });

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    const origin = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || request.nextUrl.origin;
    const resetUrl = `${origin}/reset-password?token=${token}`;
    devResetUrl = resetUrl;

    try {
      const messageId = await sendPasswordResetEmail({
        to: user.email,
        resetUrl,
        expiresMinutes,
      });
      console.log(`[forgot-password] sent reset mail to=${user.email} messageId=${messageId ?? "n/a"}`);
    } catch (mailError) {
      if (process.env.NODE_ENV === "production") {
        console.error("[forgot-password] mail delivery failed:", mailError);
        throw mailError;
      }
      console.warn("[password-reset] mail delivery failed in non-production:", mailError);
      devWarning = "메일 설정이 없어 개발용 재설정 링크를 표시합니다.";
    }

    return NextResponse.json({
      message: SUCCESS_MESSAGE,
      ...(process.env.NODE_ENV !== "production" && devResetUrl ? { resetUrl: devResetUrl } : {}),
      ...(process.env.NODE_ENV !== "production" && devWarning ? { warning: devWarning } : {}),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    if (error instanceof Error && /RESEND_API_KEY|MAIL_FROM|APP_URL|Resend send failed/.test(error.message)) {
      return NextResponse.json({ error: "메일 발송 설정 또는 발송 과정에 문제가 있습니다." }, { status: 500 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
