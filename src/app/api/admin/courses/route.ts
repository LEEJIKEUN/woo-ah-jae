import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/guards";
import { createDbCourse, type DbCourseInput } from "@/lib/course/db-course";

export const dynamic = "force-dynamic";

/** 새 DB 강좌 생성 — 관리자. */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    const body = (await request.json().catch(() => null)) as DbCourseInput | null;
    if (!body || !String(body.title ?? "").trim()) {
      return NextResponse.json({ error: "강좌명을 입력해 주세요." }, { status: 400 });
    }
    const { slug } = await createDbCourse(body, admin.userId);
    return NextResponse.json({ ok: true, slug }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
