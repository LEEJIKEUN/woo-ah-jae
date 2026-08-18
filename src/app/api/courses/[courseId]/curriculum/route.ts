import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/guards";
import { getCourse } from "@/lib/course/content";
import { setCurriculumOverride, getCurriculumOverride, hardcodedOverride, type OverrideModule } from "@/lib/course/curriculum";

export const dynamic = "force-dynamic";

/** 현재 커리큘럼(오버라이드 있으면 그것, 없으면 하드코딩) — 편집 초기값. 관리자 전용. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    await requireAdmin(request);
    const { courseId } = await params;
    const base = getCourse(courseId);
    if (!base) return NextResponse.json({ error: "하드코딩 강좌만 커리큘럼 편집을 지원합니다." }, { status: 404 });
    const override = await getCurriculumOverride(courseId);
    return NextResponse.json({ modules: override ?? hardcodedOverride(base), overridden: !!override });
  } catch (error) {
    return jsonError(error);
  }
}

/** 커리큘럼(모듈·차시) 저장 — 관리자 전용. 강의실·소개·출석·이수에 즉시 반영. */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    await requireAdmin(request);
    const { courseId } = await params;
    if (!getCourse(courseId)) return NextResponse.json({ error: "하드코딩 강좌만 커리큘럼 편집을 지원합니다." }, { status: 404 });
    const body = (await request.json().catch(() => null)) as { modules?: OverrideModule[] } | null;
    if (!body || !Array.isArray(body.modules)) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    const saved = await setCurriculumOverride(courseId, body.modules);
    return NextResponse.json({ ok: true, modules: saved });
  } catch (error) {
    return jsonError(error);
  }
}
