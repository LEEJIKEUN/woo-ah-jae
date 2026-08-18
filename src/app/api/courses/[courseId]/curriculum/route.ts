import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/guards";
import { getCourse } from "@/lib/course/content";
import { getSession, canEnterClassroom } from "@/lib/course/access";
import { getCourseMeta } from "@/lib/course/meta-store";
import { setCurriculumOverride, getEffectiveCourse, type OverrideModule } from "@/lib/course/curriculum";

export const dynamic = "force-dynamic";

/**
 * 강의실 사이드바 동기화용 — 실효 강좌명(CourseMeta 오버라이드 반영)과 커리큘럼(차시 편집 반영)을
 * 사이드바가 쓰는 형태로 반환. 강의실 구성원 접근.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const { courseId } = await params;
    if (!getCourse(courseId)) return NextResponse.json({ error: "강좌를 찾을 수 없습니다." }, { status: 404 });
    const session = await getSession();
    if (!(await canEnterClassroom(courseId, session))) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    const [eff, meta] = await Promise.all([getEffectiveCourse(courseId), getCourseMeta(courseId)]);
    if (!eff) return NextResponse.json({ error: "강좌를 찾을 수 없습니다." }, { status: 404 });
    return NextResponse.json({
      title: meta?.title ?? eff.title, // 강좌명 편집(CourseMeta) 반영
      modules: eff.modules.map((m) => ({
        label: m.label,
        weekStart: m.weekStart ?? undefined,
        sessions: m.blocks.flatMap((b) => b.activities).map((a) => ({ id: a.id, title: a.title, completable: a.completion !== "none" })),
      })),
    });
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
