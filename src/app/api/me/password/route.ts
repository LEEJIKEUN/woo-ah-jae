import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword } from "@/lib/auth";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { clearEmailCode, isEmailVerified } from "@/lib/email-code-store";
import { prisma } from "@/lib/prisma";

const schema = z.object({ newPassword: z.string().min(8, "비밀번호는 8자 이상이어야 합니다.").max(72) });

/** 비밀번호 변경 — 이메일 인증(6자리 코드) 완료 후에만 허용. */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);
    const { newPassword } = schema.parse(await request.json());
    const user = await prisma.user.findUnique({ where: { id: auth.userId }, select: { email: true } });
    if (!user) return NextResponse.json({ error: "계정을 찾을 수 없습니다." }, { status: 404 });

    if (!(await isEmailVerified(user.email))) {
      return NextResponse.json({ error: "이메일 인증을 먼저 완료해 주세요." }, { status: 403 });
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({ where: { id: auth.userId }, data: { passwordHash } });
    await clearEmailCode(user.email);

    return NextResponse.json({ ok: true, message: "비밀번호가 변경되었습니다." });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    return jsonError(error);
  }
}
