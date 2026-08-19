import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { isStaffRole, isFacilitatorOfCourse } from "@/lib/course/access";
import { allActivities } from "@/lib/course/content";
import { getEffectiveCourse } from "@/lib/course/curriculum";
import { getEnrolledUserIds } from "@/lib/enrollment-store";
import { courseWatchMap } from "@/lib/video-progress-store";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type VideoBlock = { type?: string; durationSec?: number; videoKey?: string };

/** 강의 수강 현황(스태프) — 동영상이 있는 차시 × 수강생, 셀=시청초/총초. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const { courseId } = await params;
    const auth = await getAuthFromRequest(request);
    if (!isStaffRole(auth.role)) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    if (auth.role === "FACILITATOR" && !(await isFacilitatorOfCourse(courseId, auth.userId))) return NextResponse.json({ error: "담당 강좌가 아닙니다." }, { status: 403 });

    const course = await getEffectiveCourse(courseId);
    if (!course) return NextResponse.json({ error: "강좌를 찾을 수 없습니다." }, { status: 404 });

    // 활동 순서·제목 맵
    const acts = allActivities(course).map((x) => ({ id: x.activity.id, title: x.activity.title, module: x.module.label }));

    // 각 차시의 저장된 콘텐츠에서 동영상 블록(길이) 찾기
    const contents = await prisma.lessonContent.findMany({ where: { courseId }, select: { activityId: true, blocks: true } });
    const videoByActivity = new Map<string, number>(); // activityId → durationSec(블록)
    for (const c of contents) {
      const blocks = Array.isArray(c.blocks) ? (c.blocks as unknown as VideoBlock[]) : [];
      const vids = blocks.filter((b) => b && b.type === "video" && b.videoKey);
      if (vids.length) videoByActivity.set(c.activityId, Math.max(0, ...vids.map((v) => Math.floor(v.durationSec || 0))));
    }

    const watch = await courseWatchMap(courseId);
    // 블록에 길이가 없으면(구 업로드) 학생들이 보고한 최대 totalSec 으로 총 길이 추정
    const reportedTotal = (activityId: string): number => {
      let mx = 0;
      for (const m of watch.values()) { const c = m.get(activityId); if (c && c.totalSec > mx) mx = c.totalSec; }
      return mx;
    };

    // 동영상이 있는 차시만(커리큘럼 순서 유지)
    const sessions = acts.filter((a) => videoByActivity.has(a.id)).map((a) => {
      const blockDur = videoByActivity.get(a.id) ?? 0;
      return { activityId: a.id, title: a.title, module: a.module, durationSec: blockDur > 0 ? blockDur : reportedTotal(a.id) };
    });

    const enrolledIds = await getEnrolledUserIds(courseId);
    const users = enrolledIds.length ? await prisma.user.findMany({ where: { id: { in: enrolledIds } }, select: { id: true, email: true, studentProfile: { select: { realName: true } } } }) : [];
    const students = users.map((u) => ({ id: u.id, name: u.studentProfile?.realName?.trim() || u.email })).sort((a, b) => a.name.localeCompare(b.name, "ko"));
    const cells: Record<string, Record<string, { watchedSec: number; totalSec: number }>> = {};
    for (const s of students) {
      cells[s.id] = {};
      const sm = watch.get(s.id);
      for (const sess of sessions) {
        const w = sm?.get(sess.activityId);
        const total = (w?.totalSec && w.totalSec > 0) ? w.totalSec : sess.durationSec;
        cells[s.id][sess.activityId] = { watchedSec: w?.watchedSec ?? 0, totalSec: total };
      }
    }

    return NextResponse.json({ students, sessions, cells });
  } catch (error) {
    return jsonError(error);
  }
}
