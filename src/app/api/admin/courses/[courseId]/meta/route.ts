import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/guards";
import { getCourse } from "@/lib/course/content";
import { upsertCourseMeta, type CourseMetaPatch, STATUS_ORDER, type CourseStatus } from "@/lib/course/meta-store";

export const dynamic = "force-dynamic";

const TEXT_KEYS = ["programme", "title", "subtitle", "audience", "classDays", "periodLabel", "country", "summary", "realtimeInfo"] as const;

/** 강좌 메타 편집 — 관리자만. 부분 업데이트(전달된 필드만 반영). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    await requireAdmin(request);
    const { courseId } = await params;
    if (!getCourse(courseId)) return NextResponse.json({ error: "강좌를 찾을 수 없습니다." }, { status: 404 });

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });

    const patch: CourseMetaPatch = {};
    for (const k of TEXT_KEYS) {
      if (k in body) (patch as Record<string, unknown>)[k] = typeof body[k] === "string" ? (body[k] as string) : null;
    }
    if ("capacity" in body) patch.capacity = typeof body.capacity === "number" ? body.capacity : Number(body.capacity) || null;
    if ("deadline" in body) patch.deadline = typeof body.deadline === "string" && body.deadline ? body.deadline : null;
    if ("status" in body) {
      const st = String(body.status);
      if (!(STATUS_ORDER as string[]).includes(st)) return NextResponse.json({ error: "상태 값이 올바르지 않습니다." }, { status: 400 });
      patch.status = st as CourseStatus;
    }

    const meta = await upsertCourseMeta(courseId, patch);
    return NextResponse.json({ ok: true, meta });
  } catch (error) {
    return jsonError(error);
  }
}
