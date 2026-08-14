import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/guards";
import { loadDbCourse, updateDbCourse, deleteDbCourse, type DbCourseInput } from "@/lib/course/db-course";

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

/** DB 강좌 삭제 — 관리자. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    await requireAdmin(request);
    const { courseId } = await params;
    const ok = await deleteDbCourse(courseId);
    if (!ok) return NextResponse.json({ error: "DB 강좌를 찾을 수 없습니다." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
