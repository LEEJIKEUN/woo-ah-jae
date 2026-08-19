import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { isStaffRole } from "@/lib/course/access";
import { allActivities } from "@/lib/course/content";
import { getEffectiveCourse } from "@/lib/course/curriculum";
import { isUserEnrolled } from "@/lib/enrollment-store";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type VideoBlock = { type?: string; durationSec?: number; videoKey?: string };

/** 본인 강의 수강 현황 — 동영상 차시별 내 시청 진도(시청/총). 로그인+수강생(또는 스태프). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const { courseId } = await params;
    const auth = await getAuthFromRequest(request);
    const allowed = isStaffRole(auth.role) || (await isUserEnrolled(courseId, auth.userId));
    if (!allowed) return NextResponse.json({ error: "수강생만 조회할 수 있습니다." }, { status: 403 });

    const course = await getEffectiveCourse(courseId);
    if (!course) return NextResponse.json({ error: "강좌를 찾을 수 없습니다." }, { status: 404 });

    const acts = allActivities(course).map((x) => ({ id: x.activity.id, title: x.activity.title, module: x.module.label }));
    const contents = await prisma.lessonContent.findMany({ where: { courseId }, select: { activityId: true, blocks: true } });
    const videoByActivity = new Map<string, number>();
    for (const c of contents) {
      const blocks = Array.isArray(c.blocks) ? (c.blocks as unknown as VideoBlock[]) : [];
      const vids = blocks.filter((b) => b && b.type === "video" && b.videoKey);
      if (vids.length) videoByActivity.set(c.activityId, Math.max(0, ...vids.map((v) => Math.floor(v.durationSec || 0))));
    }

    const myRows = await prisma.videoProgress.findMany({ where: { courseId, userId: auth.userId }, select: { activityId: true, watchedSec: true, totalSec: true, watchedBits: true } });
    const mine = new Map(myRows.map((r) => [r.activityId, { watchedSec: r.watchedBits ? r.watchedSec : 0, totalSec: r.totalSec }]));

    const sessions = acts
      .filter((a) => videoByActivity.has(a.id))
      .map((a) => {
        const blockDur = videoByActivity.get(a.id) ?? 0;
        const p = mine.get(a.id);
        const totalSec = (p?.totalSec && p.totalSec > 0) ? p.totalSec : blockDur;
        return { activityId: a.id, title: a.title, module: a.module, watchedSec: p?.watchedSec ?? 0, totalSec };
      });

    return NextResponse.json({ courseTitle: course.title, sessions });
  } catch (error) {
    return jsonError(error);
  }
}
