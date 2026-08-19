import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { isUserEnrolled } from "@/lib/enrollment-store";
import { recordWatch } from "@/lib/video-progress-store";

export const dynamic = "force-dynamic";

/**
 * 학생 동영상 시청 진도 보고 — 재생 중 주기적으로(+일시정지·종료 시) 호출.
 * { watchedSec, totalSec }. 학생 본인 + 수강생만. keepalive 로도 호출됨.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ courseId: string; activityId: string }> }) {
  try {
    const { courseId, activityId } = await params;
    const auth = await getAuthFromRequest(request);
    if (auth.role !== "STUDENT") return NextResponse.json({ ok: true }); // 스태프·학부모 시청은 진도로 집계하지 않음
    if (!(await isUserEnrolled(courseId, auth.userId))) return NextResponse.json({ ok: true });
    const body = (await request.json().catch(() => null)) as { watchedSec?: unknown; totalSec?: unknown } | null;
    const watchedSec = Number(body?.watchedSec) || 0;
    const totalSec = Number(body?.totalSec) || 0;
    await recordWatch(auth.userId, courseId, activityId, watchedSec, totalSec);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
