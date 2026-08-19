import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { isUserEnrolled } from "@/lib/enrollment-store";
import { recordWatchSegments } from "@/lib/video-progress-store";

export const dynamic = "force-dynamic";

/**
 * 학생 동영상 시청 진도 보고 — 실제 재생한 5초 버킷 인덱스 목록을 보고(건너뛴 구간 제외).
 * { buckets: number[], totalSec }. 학생 본인 + 수강생만. keepalive 로도 호출됨.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ courseId: string; activityId: string }> }) {
  try {
    const { courseId, activityId } = await params;
    const auth = await getAuthFromRequest(request);
    if (auth.role !== "STUDENT") return NextResponse.json({ ok: true }); // 스태프·학부모 시청은 집계 제외
    if (!(await isUserEnrolled(courseId, auth.userId))) return NextResponse.json({ ok: true });
    const body = (await request.json().catch(() => null)) as { buckets?: unknown; totalSec?: unknown } | null;
    const buckets = Array.isArray(body?.buckets) ? (body!.buckets as unknown[]).map(Number).filter((n) => Number.isFinite(n)) : [];
    const totalSec = Number(body?.totalSec) || 0;
    if (buckets.length) await recordWatchSegments(auth.userId, courseId, activityId, buckets, totalSec);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
