import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/guards";
import { getCourse } from "@/lib/course/content";
import { upsertCourseMeta, type CourseMetaPatch, STATUS_ORDER, type CourseStatus } from "@/lib/course/meta-store";
import { dbCourseExists } from "@/lib/course/db-course";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const TEXT_KEYS = ["programme", "title", "subtitle", "objectives", "audience", "format", "deliveryMode", "classDays", "periodLabel", "country", "summary", "realtimeInfo"] as const;

/** 강좌 메타 편집 — 관리자만. 하드코딩=CourseMeta 오버라이드, DB강좌=CourseDb 직접 수정. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    await requireAdmin(request);
    const { courseId } = await params;
    const isHard = !!getCourse(courseId);
    const isDb = !isHard && (await dbCourseExists(courseId));
    if (!isHard && !isDb) return NextResponse.json({ error: "강좌를 찾을 수 없습니다." }, { status: 404 });

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });

    // 상태값 검증(공통)
    let status: CourseStatus | undefined;
    if ("status" in body) {
      const st = String(body.status);
      if (!(STATUS_ORDER as string[]).includes(st)) return NextResponse.json({ error: "상태 값이 올바르지 않습니다." }, { status: 400 });
      status = st as CourseStatus;
    }

    if (isDb) {
      const data: Record<string, unknown> = {};
      for (const k of TEXT_KEYS) {
        if (k in body && typeof body[k] === "string") data[k] = body[k];
      }
      if ("capacity" in body) { const c = typeof body.capacity === "number" ? body.capacity : Number(body.capacity); if (Number.isFinite(c) && c >= 0) data.capacity = Math.floor(c); }
      if ("deadline" in body) data.deadline = typeof body.deadline === "string" && body.deadline ? new Date(body.deadline) : null;
      if (status) data.status = status;
      await prisma.courseDb.update({ where: { slug: courseId }, data });
      return NextResponse.json({ ok: true });
    }

    const patch: CourseMetaPatch = {};
    for (const k of TEXT_KEYS) {
      if (k in body) (patch as Record<string, unknown>)[k] = typeof body[k] === "string" ? (body[k] as string) : null;
    }
    if ("capacity" in body) patch.capacity = typeof body.capacity === "number" ? body.capacity : Number(body.capacity) || null;
    if ("deadline" in body) patch.deadline = typeof body.deadline === "string" && body.deadline ? body.deadline : null;
    if (status) patch.status = status;

    const meta = await upsertCourseMeta(courseId, patch);
    return NextResponse.json({ ok: true, meta });
  } catch (error) {
    return jsonError(error);
  }
}
