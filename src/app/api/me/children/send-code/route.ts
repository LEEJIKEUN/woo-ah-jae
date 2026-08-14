import { NextRequest, NextResponse } from "next/server";
import { UserLifecycleStatus, UserRole } from "@prisma/client";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { requestEmailCode } from "@/lib/email-code-store";
import { sendChildLinkCodeEmail } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
const EXPIRES_MIN = 10;

/** 학부모가 자녀 연결을 위해 자녀 이메일로 6자리 인증코드 발송. */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);
    const me = await prisma.user.findUnique({ where: { id: auth.userId }, select: { role: true, studentProfile: { select: { realName: true } } } });
    if (!me || me.role !== UserRole.PARENT) return NextResponse.json({ error: "학부모 계정만 가능합니다." }, { status: 403 });

    const body = (await request.json().catch(() => null)) as { childEmail?: unknown } | null;
    const childEmail = String(body?.childEmail ?? "").trim().toLowerCase();
    if (!childEmail || !childEmail.includes("@")) return NextResponse.json({ error: "자녀 이메일을 입력해 주세요." }, { status: 400 });

    // 자녀는 실제 학생 계정이어야 함
    const child = await prisma.user.findUnique({ where: { email: childEmail }, select: { id: true, role: true, lifecycleStatus: true } });
    if (!child || child.role !== UserRole.STUDENT || child.lifecycleStatus !== UserLifecycleStatus.ACTIVE) {
      return NextResponse.json({ error: "해당 이메일의 학생 계정을 찾을 수 없습니다." }, { status: 404 });
    }
    const existing = await prisma.parentChildLink.findFirst({ where: { parentUserId: auth.userId, childUserId: child.id }, select: { status: true } });
    if (existing?.status === "APPROVED") return NextResponse.json({ error: "이미 연결된 자녀입니다." }, { status: 400 });
    const approved = await prisma.parentChildLink.count({ where: { parentUserId: auth.userId, status: "APPROVED" } });
    if (approved >= 4) return NextResponse.json({ error: "자녀는 최대 4명까지 연결할 수 있습니다." }, { status: 400 });

    const result = await requestEmailCode(childEmail);
    if ("error" in result) return NextResponse.json({ error: result.error, retryAfterSec: result.retryAfterSec }, { status: 429 });

    try {
      await sendChildLinkCodeEmail({ to: childEmail, code: result.code, parentName: me.studentProfile?.realName ?? "", expiresMinutes: EXPIRES_MIN });
    } catch (mailError) {
      if (process.env.NODE_ENV === "production") {
        console.error("[child-link] mail failed:", mailError);
        return NextResponse.json({ error: "인증 메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });
      }
    }
    return NextResponse.json({ message: `자녀 이메일로 인증코드를 보냈습니다. ${EXPIRES_MIN}분 내에 입력해 주세요.`, ...(process.env.NODE_ENV !== "production" ? { devCode: result.code } : {}) });
  } catch (error) {
    return jsonError(error);
  }
}
