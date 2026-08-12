import fs from "node:fs/promises";
import path from "node:path";

/**
 * 강좌별 수강신청 기록 — 사용자ID 집합으로 저장한다.
 * 신청 인원 = 배열 길이. 접근 제어(강의실 입장)에 사용자별 등록 여부가 필요해서
 * 단순 카운트가 아니라 userId 목록을 보관한다.
 * 라이브 DB 부담을 피해 파일에 저장(프로세스 내 뮤텍스로 원자적 갱신).
 * (서버리스 다중 인스턴스로 이전 시 DB 테이블/KV 로 교체 필요.)
 */
type Store = Record<string, string[]>; // courseId -> [userId, ...]

const persistentStoreDir =
  process.env.LOCAL_DATA_DIR ||
  (process.env.NODE_ENV === "production"
    ? "/var/data/local_data"
    : path.join(process.cwd(), ".local_data"));
const resolvedStorePath = path.join(persistentStoreDir, "enrollments.json");

let lock: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = lock.then(fn, fn);
  lock = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function ensureStore() {
  await fs.mkdir(persistentStoreDir, { recursive: true });
  try {
    await fs.access(resolvedStorePath);
  } catch {
    await fs.writeFile(resolvedStorePath, "{}", "utf8");
  }
}

async function readAll(): Promise<Store> {
  await ensureStore();
  const raw = await fs.readFile(resolvedStorePath, "utf8");
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Store = {};
    for (const [k, v] of Object.entries(parsed)) {
      out[k] = Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === "string") : [];
    }
    return out;
  } catch {
    return {};
  }
}

async function writeAll(store: Store) {
  await ensureStore();
  await fs.writeFile(resolvedStorePath, JSON.stringify(store, null, 2), "utf8");
}

/** 신청 인원 */
export async function getApplied(courseId: string): Promise<number> {
  const all = await readAll();
  return all[courseId]?.length ?? 0;
}

/** 특정 사용자의 수강신청 여부 */
export async function isUserEnrolled(courseId: string, userId: string): Promise<boolean> {
  const all = await readAll();
  return all[courseId]?.includes(userId) ?? false;
}

/** 수강신청(사용자ID 기록). 이미 신청했으면 그대로 성공(already), 정원 초과면 실패(full). */
export async function enrollUser(
  courseId: string,
  userId: string,
  capacity: number
): Promise<{ ok: boolean; applied: number; full: boolean; already: boolean }> {
  return withLock(async () => {
    const all = await readAll();
    const list = all[courseId] ?? [];
    if (list.includes(userId)) {
      return { ok: true, applied: list.length, full: list.length >= capacity, already: true };
    }
    if (list.length >= capacity) {
      return { ok: false, applied: list.length, full: true, already: false };
    }
    const next = [...list, userId];
    all[courseId] = next;
    await writeAll(all);
    return { ok: true, applied: next.length, full: next.length >= capacity, already: false };
  });
}

/** 테스트/관리자용 리셋 */
export async function resetEnrollment(courseId: string): Promise<void> {
  return withLock(async () => {
    const all = await readAll();
    if (courseId in all) {
      delete all[courseId];
      await writeAll(all);
    }
  });
}
