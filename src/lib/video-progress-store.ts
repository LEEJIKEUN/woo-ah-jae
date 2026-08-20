import { prisma } from "@/lib/prisma";

/**
 * 강의 동영상 시청 진도(학생별·차시별) — 실제로 재생한 구간만 집계.
 * 5초 버킷 비트맵(watchedBits, base64)에 재생한 버킷을 OR 누적 → watchedSec = 켜진 버킷 수 × 5.
 * 건너뛴(seek) 구간은 카운트되지 않고, 여러 세션에 걸쳐 본 구간은 합산된다.
 * VideoProgress 테이블(prisma db push). 오류 시 조용히 무시(강의실을 막지 않도록).
 */
export const BUCKET_SEC = 5;
export type WatchCell = { watchedSec: number; totalSec: number };

function popcount(bytes: Uint8Array): number {
  let c = 0;
  for (const b of bytes) { let x = b; while (x) { x &= x - 1; c++; } }
  return c;
}

/** 기존 비트맵(base64)에 버킷들을 켠 뒤 { base64, 켜진 수 } 반환. */
function mergeBuckets(base64: string | null | undefined, buckets: number[]): { b64: string; count: number } {
  const valid = buckets.filter((b) => Number.isFinite(b) && b >= 0 && b < 200000); // 방어(최대 ~11일)
  const maxB = valid.length ? Math.max(...valid) : -1;
  let bytes = base64 ? Buffer.from(base64, "base64") : Buffer.alloc(0);
  const need = Math.max(bytes.length, Math.ceil((maxB + 1) / 8));
  if (bytes.length < need) { const nb = Buffer.alloc(need); bytes.copy(nb); bytes = nb; }
  for (const bk of valid) bytes[bk >> 3] |= (1 << (bk & 7));
  return { b64: bytes.toString("base64"), count: popcount(bytes) };
}

/** 학생이 실제 재생한 버킷(5초 단위 인덱스)들을 누적 반영. 반영 후 { watchedSec, totalSec } 반환. */
export async function recordWatchSegments(userId: string, courseId: string, activityId: string, buckets: number[], totalSec: number): Promise<WatchCell> {
  const t = Math.max(0, Math.floor(totalSec || 0));
  try {
    const prev = await prisma.videoProgress.findUnique({ where: { userId_courseId_activityId: { userId, courseId, activityId } }, select: { watchedBits: true, totalSec: true } });
    const { b64, count } = mergeBuckets(prev?.watchedBits, buckets);
    const total = t > 0 ? t : (prev?.totalSec ?? 0);
    let watchedSec = count * BUCKET_SEC;
    if (total > 0) watchedSec = Math.min(watchedSec, total);
    await prisma.videoProgress.upsert({
      where: { userId_courseId_activityId: { userId, courseId, activityId } },
      create: { userId, courseId, activityId, watchedSec, totalSec: total, watchedBits: b64 },
      update: { watchedSec, totalSec: total, watchedBits: b64 },
    });
    return { watchedSec, totalSec: total };
  } catch {
    return { watchedSec: 0, totalSec: t };
  }
}

/** 강좌의 모든 시청 진도 → { userId: { activityId: WatchCell } } (스태프 표용). */
export async function courseWatchMap(courseId: string): Promise<Map<string, Map<string, WatchCell>>> {
  const out = new Map<string, Map<string, WatchCell>>();
  try {
    const rows = await prisma.videoProgress.findMany({ where: { courseId }, select: { userId: true, activityId: true, watchedSec: true, totalSec: true, watchedBits: true } });
    for (const r of rows) {
      let m = out.get(r.userId);
      if (!m) { m = new Map(); out.set(r.userId, m); }
      // 구(최대위치) 방식 데이터(watchedBits 없음)는 부정확하므로 0으로 리셋 — 재생하면 실제 구간으로 누적
      m.set(r.activityId, { watchedSec: r.watchedBits ? r.watchedSec : 0, totalSec: r.totalSec });
    }
  } catch {
    /* 무시 */
  }
  return out;
}
