import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyEmailCode } from "@/lib/email-code-store";

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
  code: z.string().regex(/^\d{6}$/, "6자리 숫자 코드를 입력해 주세요."),
});

export async function POST(request: NextRequest) {
  try {
    const { email, code } = schema.parse(await request.json());
    const result = await verifyEmailCode(email, code);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, message: "이메일 인증이 완료되었습니다." });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
