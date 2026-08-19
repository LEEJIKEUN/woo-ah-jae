import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/guards";
import { getCourse } from "@/lib/course/content";
import { loadDbCourse, updateDbCourse, deleteDbCourse, type DbCourseInput } from "@/lib/course/db-course";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** DB 강좌 편집기용 로드 — 관리자. (하드코딩 강좌는 여기서 다루지 않음) */
export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    await requireAdmin(request);
    const { courseId } = await params;
    const course = await loadDbCourse(courseId);
    if (!course) return NextResponse.json({ error: "DB 강좌를 찾을 수 없습니다." }, { status: 404 });
    return NextResponse.json({ course });
  } catch (error) {
    return jsonError(error);
  }
}

/** DB 강좌 전체 수정(스칼라 + 커리큘럼) — 관리자. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    await requireAdmin(request);
    const { courseId } = await params;
    const body = (await request.json().catch(() => null)) as DbCourseInput | null;
    if (!body || !String(body.title ?? "").trim()) return NextResponse.json({ error: "강좌명을 입력해 주세요." }, { status: 400 });
    const ok = await updateDbCourse(courseId, body);
    if (!ok) return NextResponse.json({ error: "DB 강좌를 찾을 수 없습니다." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}

/** 강좌 삭제 — 관리자. DB 강좌만 화면에서 삭제(하드코딩=코드 관리). 강좌 범위 데이터도 함께 정리. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    await requireAdmin(request);
    const { courseId } = await params;
    if (getCourse(courseId)) {
      return NextResponse.json({ error: "코드로 관리되는 기본 강좌는 화면에서 삭제할 수 없습니다(담당자에게 요청)." }, { status: 400 });
    }
    const ok = await deleteDbCourse(courseId);
    if (!ok) return NextResponse.json({ error: "강좌를 찾을 수 없습니다." }, { status: 404 });
    // 고아 방지: 강좌 범위 데이터 정리(대부분 비어 있음)
    try {
      await prisma.$transaction([
        prisma.enrollment.deleteMany({ where: { courseId } }),
        prisma.courseSummary.deleteMany({ where: { courseId } }),
        prisma.lessonContent.deleteMany({ where: { courseId } }),
        prisma.lessonCompletion.deleteMany({ where: { courseId } }),
        prisma.videoProgress.deleteMany({ where: { courseId } }),
        prisma.courseMeta.deleteMany({ where: { courseId } }),
      ]);
    } catch {
      /* 정리 실패는 삭제 성공을 막지 않음 */
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
