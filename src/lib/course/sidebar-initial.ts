import { getSession, isStaffRole } from "@/lib/course/access";
import { getCourse, allActivities, type Course } from "@/lib/course/content";
import { getEffectiveCourse } from "@/lib/course/curriculum";
import { getCourseMeta } from "@/lib/course/meta-store";
import { isUserEnrolled } from "@/lib/enrollment-store";
import { prisma } from "@/lib/prisma";

/**
 * 강의실 사이드바의 초기값(실효 강좌명·형식·시청 진도율)을 서버에서 계산.
 * 서버 레이아웃이 이 값을 컨텍스트로 내려주어, 사이드바의 SSR 렌더가 처음부터 정확한 값을
 * 그리도록 한다(새로고침 시 하드코딩 기본값·완료 기준값이 잠깐 스치는 깜빡임 제거).
 * 실패해도 빈 값 반환 → 사이드바는 기존 클라이언트 seed/폴링으로 폴백(안전).
 */
export type SidebarInitial = { title?: string; format?: string; watchPct?: number | null };

type VideoBlock = { type?: string; durationSec?: number; videoKey?: string };

async function computeWatchPct(courseId: string, userId: string, course: Course): Promise<number> {
  const acts = allActivities(course);
  const contents = await prisma.lessonContent.findMany({ where: { courseId }, select: { activityId: true, blocks: true } });
  const videoByActivity = new Map<string, number>();
  for (const c of contents) {
    const blocks = Array.isArray(c.blocks) ? (c.blocks as unknown as VideoBlock[]) : [];
    const vids = blocks.filter((b) => b && b.type === "video" && b.videoKey);
    if (vids.length) videoByActivity.set(c.activityId, Math.max(0, ...vids.map((v) => Math.floor(v.durationSec || 0))));
  }
  const myRows = await prisma.videoProgress.findMany({ where: { courseId, userId }, select: { activityId: true, watchedSec: true, totalSec: true, watchedBits: true } });
  const mine = new Map(myRows.map((r) => [r.activityId, { watchedSec: r.watchedBits ? r.watchedSec : 0, totalSec: r.totalSec }]));
  const sessions = acts
    .filter((a) => videoByActivity.has(a.activity.id))
    .map((a) => {
      const blockDur = videoByActivity.get(a.activity.id) ?? 0;
      const p = mine.get(a.activity.id);
      const totalSec = p?.totalSec && p.totalSec > 0 ? p.totalSec : blockDur;
      return { watchedSec: p?.watchedSec ?? 0, totalSec };
    });
  const done = sessions.filter((s) => s.totalSec > 0 && s.watchedSec >= s.totalSec).length;
  return sessions.length ? Math.round((done / sessions.length) * 100) : 0;
}

export async function getSidebarInitial(courseId: string): Promise<SidebarInitial> {
  try {
    if (!getCourse(courseId)) return {}; // 하드코딩 강좌만 (DB 강좌는 클라이언트 seed 사용)
    const [eff, meta] = await Promise.all([getEffectiveCourse(courseId), getCourseMeta(courseId)]);
    if (!eff) return {};
    const title = meta?.title ?? eff.title;
    const format = meta?.format ?? eff.format;
    let watchPct: number | null = null;
    // 도넛이 시청 진도율을 쓰는 형식(관리형·자기주도)에서 학생 본인 진도율을 미리 계산
    if (format === "관리형학습" || format === "자기주도학습") {
      const session = await getSession();
      if (session && !isStaffRole(session.role) && (await isUserEnrolled(courseId, session.userId))) {
        watchPct = await computeWatchPct(courseId, session.userId, eff);
      }
    }
    return { title, format, watchPct };
  } catch {
    return {};
  }
}
