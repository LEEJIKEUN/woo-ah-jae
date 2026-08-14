import { NextRequest, NextResponse } from "next/server";
import { UserLifecycleStatus, UserRole } from "@prisma/client";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { verifyEmailCode, clearEmailCode } from "@/lib/email-code-store";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** 학부모가 자녀 이메일 인증코드 확인 후 연결(APPROVED, 최대 4명). */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);
    const me = await prisma.user.findUnique({ where: { id: auth.userId }, select: { role: true } });
    if (!me || me.role !== UserRole.PARENT) return NextResponse.json({ error: "학부모 계정만 가능합니다." }, { status: 403 });

    const body = (await request.json().catch(() => null)) as { childEmail?: unknown; code?: unknown } | null;
    const childEmail = String(body?.childEmail ?? "").trim().toLowerCase();
    const code = String(body?.code ?? "").trim();
    if (!childEmail || !/^\d{6}$/.test(code)) return NextResponse.json({ error: "이메일과 6자리 인증코드를 입력해 주세요." }, { status: 400 });

    const child = await prisma.user.findUnique({ where: { email: childEmail }, select: { id: true, role: true, lifecycleStatus: true, studentProfile: { select: { realName: true } } } });
    if (!child || child.role !== UserRole.STUDENT || child.lifecycleStatus !== UserLifecycleStatus.ACTIVE) {
      return NextResponse.json({ error: "해당 이메일의 학생 계정을 찾을 수 없습니다." }, { status: 404 });
    }

    const approved = await prisma.parentChildLink.count({ where: { parentUserId: auth.userId, status: "APPROVED" } });
    const existing = await prisma.parentChildLink.findFirst({ where: { parentUserId: auth.userId, childUserId: child.id }, select: { id: true, status: true } });
    if (existing?.status === "APPROVED") return NextResponse.json({ error: "이미 연결된 자녀입니다." }, { status: 400 });
    if (approved >= 4) return NextResponse.json({ error: "자녀는 최대 4명까지 연결할 수 있습니다." }, { status: 400 });

    const verified = await verifyEmailCode(childEmail, code);
    if (!verified.ok) return NextResponse.json({ error: verified.error }, { status: 400 });

    if (existing) {
      await prisma.parentChildLink.update({ where: { id: existing.id }, data: { status: "APPROVED", respondedAt: new Date() } });
    } else {
      await prisma.parentChildLink.create({ data: { parentUserId: auth.userId, childUserId: child.id, status: "APPROVED", respondedAt: new Date() } });
    }
    await clearEmailCode(childEmail);

    return NextResponse.json({ ok: true, childName: child.studentProfile?.realName?.trim() || childEmail });
  } catch (error) {
    return jsonError(error);
  }
}
