import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { verifyEmailCode } from "@/lib/email-code-store";
import { prisma } from "@/lib/prisma";

const schema = z.object({ code: z.string().regex(/^\d{6}$/, "6자리 숫자 코드를 입력해 주세요.") });

/** 로그인한 본인 이메일로 받은 인증코드 확인. 성공 시 30분 내 비밀번호 변경·탈퇴가 허용된다. */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);
    const { code } = schema.parse(await request.json());
    const user = await prisma.user.findUnique({ where: { id: auth.userId }, select: { email: true } });
    if (!user) return NextResponse.json({ error: "계정을 찾을 수 없습니다." }, { status: 404 });

    const result = await verifyEmailCode(user.email, code);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

    return NextResponse.json({ ok: true, message: "이메일 인증이 완료되었습니다." });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    return jsonError(error);
  }
}
