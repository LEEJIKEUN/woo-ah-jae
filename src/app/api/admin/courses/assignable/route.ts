import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/guards";
import { COURSES } from "@/lib/course/content";
import { getAllCourseMeta } from "@/lib/course/meta-store";
import { listDbCourses } from "@/lib/course/db-course";

export const dynamic = "force-dynamic";

/** 담당 강좌 배정용 — 배정 가능한 전체 강좌(하드코딩 + DB). 관리자만. */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const metaMap = await getAllCourseMeta();
    // 편집(CourseMeta) 반영: 배정 UI에도 실효 강좌명 표시
    const hard = COURSES.map((c) => ({ id: c.id, title: metaMap.get(c.id)?.title ?? c.title }));
    const db = (await listDbCourses()).map((c) => ({ id: c.slug, title: c.title }));
    return NextResponse.json({ courses: [...hard, ...db] });
  } catch (error) {
    return jsonError(error);
  }
}
