import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { getCourse } from "@/lib/course/content";
import { isStaffRole } from "@/lib/course/access";
import { isUserEnrolled } from "@/lib/enrollment-store";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function sessionFromReq(request: NextRequest) {
  try {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

/** 강좌 성취기준 목록 — 수강생·스태프 열람. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  if (!getCourse(courseId)) return NextResponse.json({ error: "강좌를 찾을 수 없습니다." }, { status: 404 });
  const s = await sessionFromReq(request);
  if (!s) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!isStaffRole(s.role) && !(await isUserEnrolled(courseId, s.userId))) {
    return NextResponse.json({ error: "이 강좌의 수강생만 볼 수 있습니다." }, { status: 403 });
  }

  const items = await prisma.mentoringAchievementStandard.findMany({
    where: { courseId },
    orderBy: { sort: "asc" },
    select: { id: true, area: true, code: true, content: true },
  });
  return NextResponse.json({ items });
}

/** 성취기준 목록 교체 — 관리자·퍼실만(엑셀 업로드 결과 저장). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  if (!getCourse(courseId)) return NextResponse.json({ error: "강좌를 찾을 수 없습니다." }, { status: 404 });
  const s = await sessionFromReq(request);
  if (!s) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!isStaffRole(s.role)) return NextResponse.json({ error: "관리자·퍼실리테이터만 수정할 수 있습니다." }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { items?: unknown } | null;
  const raw = Array.isArray(body?.items) ? body!.items : null;
  if (!raw) return NextResponse.json({ error: "성취기준 데이터가 올바르지 않습니다." }, { status: 400 });

  const items = raw
    .map((r) => {
      const o = (r ?? {}) as Record<string, unknown>;
      return {
        area: typeof o.area === "string" ? o.area.trim().slice(0, 120) : "",
        code: typeof o.code === "string" ? o.code.trim().slice(0, 120) : "",
        content: typeof o.content === "string" ? o.content.trim().slice(0, 1000) : "",
      };
    })
    .filter((r) => r.content || r.code)
    .slice(0, 1000);

  await prisma.$transaction([
    prisma.mentoringAchievementStandard.deleteMany({ where: { courseId } }),
    ...items.map((it, i) =>
      prisma.mentoringAchievementStandard.create({ data: { courseId, sort: i, area: it.area, code: it.code, content: it.content } })
    ),
  ]);

  return NextResponse.json({ ok: true, count: items.length });
}
