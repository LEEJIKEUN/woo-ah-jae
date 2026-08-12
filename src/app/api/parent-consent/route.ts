import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * 자녀 이메일로 받은 동의 링크의 토큰으로 승인/거절.
 * 토큰이 인증 수단이므로 로그인 없이 처리한다(비밀번호 재설정 링크와 동일한 방식).
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { token?: unknown; action?: unknown } | null;
  const token = typeof body?.token === "string" ? body.token : "";
  const action = body?.action;
  if (!token || (action !== "approve" && action !== "reject")) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const link = await prisma.parentChildLink.findUnique({
    where: { consentToken: token },
    select: { id: true, status: true },
  });
  if (!link) return NextResponse.json({ error: "유효하지 않은 링크입니다." }, { status: 404 });
  if (link.status !== "PENDING") return NextResponse.json({ error: "이미 처리된 요청입니다." }, { status: 409 });

  await prisma.parentChildLink.update({
    where: { id: link.id },
    data: { status: action === "approve" ? "APPROVED" : "REJECTED", respondedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
