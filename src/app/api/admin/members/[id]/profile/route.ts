import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAdmin } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

const ROLE_KO: Record<string, string> = { ADMIN: "관리자", FACILITATOR: "퍼실리테이터", PARENT: "학부모", STUDENT: "학생" };

function trimOrNull(v: unknown) {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length ? t : null;
}

/** 관리자: 회원 프로필 조회 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const u = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, role: true, createdAt: true,
        studentProfile: { select: { realName: true, schoolName: true, grade: true, residenceCountry: true, birthDate: true, className: true, number: true, bio: true } },
      },
    });
    if (!u) return NextResponse.json({ error: "회원을 찾을 수 없습니다." }, { status: 404 });
    const p = u.studentProfile;
    return NextResponse.json({
      id: u.id,
      email: u.email,
      role: u.role,
      roleLabel: ROLE_KO[u.role] ?? u.role,
      createdAt: u.createdAt.toISOString(),
      realName: p?.realName ?? "",
      schoolName: p?.schoolName ?? "",
      grade: p?.grade ?? "",
      residenceCountry: p?.residenceCountry ?? "",
      birthDate: p?.birthDate ? p.birthDate.toISOString().slice(0, 10) : "",
      className: p?.className ?? "",
      number: p?.number ?? "",
      bio: p?.bio ?? "",
    });
  } catch (error) {
    return jsonError(error);
  }
}

/** 관리자: 회원 프로필 수정 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const u = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!u) return NextResponse.json({ error: "회원을 찾을 수 없습니다." }, { status: 404 });

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const realName = trimOrNull(body?.realName);
    if (realName === null) return NextResponse.json({ error: "이름(실명)은 비울 수 없습니다." }, { status: 400 });

    const birthRaw = typeof body?.birthDate === "string" ? body.birthDate.trim() : "";
    const birthDate = birthRaw ? new Date(birthRaw) : null;
    if (birthRaw && Number.isNaN(birthDate!.getTime())) return NextResponse.json({ error: "생년월일 형식이 올바르지 않습니다." }, { status: 400 });

    const data = {
      realName: realName ?? undefined, // undefined면 미변경(이름은 필수라 항상 값 존재 시 반영)
      schoolName: trimOrNull(body?.schoolName),
      grade: trimOrNull(body?.grade),
      residenceCountry: trimOrNull(body?.residenceCountry),
      className: trimOrNull(body?.className),
      number: trimOrNull(body?.number),
      bio: trimOrNull(body?.bio),
      birthDate,
    };

    await prisma.studentProfile.upsert({
      where: { userId: id },
      create: { userId: id, realName: realName ?? "", schoolName: data.schoolName, grade: data.grade, residenceCountry: data.residenceCountry, className: data.className, number: data.number, bio: data.bio, birthDate },
      update: data,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
