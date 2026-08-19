import { prisma } from "@/lib/prisma";

/**
 * 강의 동영상 시청 진도(학생별·차시별). watchedSec = 지금까지 도달한 최대 위치(초),
 * totalSec = 영상 길이(초). 관리형 강의의 '강의 수강 현황' 표에 사용.
 * VideoProgress 테이블(prisma db push 로 생성). 오류 시 조용히 무시(기능이 강의실을 막지 않도록).
 */
export type WatchCell = { watchedSec: number; totalSec: number };

/** 학생이 보고한 시청 위치로 진도 upsert — watchedSec 은 기존값과 max(뒤로 감아도 최대 시청 유지). */
export async function recordWatch(userId: string, courseId: string, activityId: string, watchedSec: number, totalSec: number): Promise<void> {
  const w = Math.max(0, Math.floor(watchedSec || 0));
  const t = Math.max(0, Math.floor(totalSec || 0));
  try {
    const prev = await prisma.videoProgress.findUnique({ where: { userId_courseId_activityId: { userId, courseId, activityId } }, select: { watchedSec: true, totalSec: true } });
    const nextWatched = Math.max(prev?.watchedSec ?? 0, w);
    const nextTotal = t > 0 ? t : (prev?.totalSec ?? 0);
    const cappedWatched = nextTotal > 0 ? Math.min(nextWatched, nextTotal) : nextWatched;
    await prisma.videoProgress.upsert({
      where: { userId_courseId_activityId: { userId, courseId, activityId } },
      create: { userId, courseId, activityId, watchedSec: cappedWatched, totalSec: nextTotal },
      update: { watchedSec: cappedWatched, totalSec: nextTotal },
    });
  } catch {
    /* 테이블 미생성 등 — 무시 */
  }
}

/** 강좌의 모든 시청 진도 → { userId: { activityId: WatchCell } } (스태프 표용). */
export async function courseWatchMap(courseId: string): Promise<Map<string, Map<string, WatchCell>>> {
  const out = new Map<string, Map<string, WatchCell>>();
  try {
    const rows = await prisma.videoProgress.findMany({ where: { courseId }, select: { userId: true, activityId: true, watchedSec: true, totalSec: true } });
    for (const r of rows) {
      let m = out.get(r.userId);
      if (!m) { m = new Map(); out.set(r.userId, m); }
      m.set(r.activityId, { watchedSec: r.watchedSec, totalSec: r.totalSec });
    }
  } catch {
    /* 무시 */
  }
  return out;
}
