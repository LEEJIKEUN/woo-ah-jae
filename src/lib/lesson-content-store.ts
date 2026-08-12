import fs from "node:fs/promises";
import path from "node:path";

/**
 * 레슨(강의)별 관리자 편집 콘텐츠 블록. 강좌마다 강의 화면을 노션처럼 직접 구성.
 * 블록: 제목 / 텍스트 / 파일(업로드) / 링크 / 구분선.
 * 파일 저장 + 프로세스 내 뮤텍스. (서버리스 이전 시 DB/오브젝트스토리지로 교체.)
 */
export type Block =
  | { id: string; type: "heading"; text: string }
  | { id: string; type: "text"; text: string }
  | { id: string; type: "file"; name: string; size: number; dataUrl: string }
  | { id: string; type: "link"; title: string; url: string; desc: string }
  | { id: string; type: "divider" };

type Store = Record<string, Record<string, Block[]>>; // courseId -> activityId -> blocks

const persistentStoreDir =
  process.env.LOCAL_DATA_DIR ||
  (process.env.NODE_ENV === "production" ? "/var/data/local_data" : path.join(process.cwd(), ".local_data"));
const resolvedStorePath = path.join(persistentStoreDir, "lesson-content.json");

let lock: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = lock.then(fn, fn);
  lock = run.then(() => undefined, () => undefined);
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
    const parsed = JSON.parse(raw) as Store;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeAll(all: Store) {
  await ensureStore();
  await fs.writeFile(resolvedStorePath, JSON.stringify(all), "utf8");
}

export async function getBlocks(courseId: string, activityId: string): Promise<Block[]> {
  const all = await readAll();
  const b = all[courseId]?.[activityId];
  return Array.isArray(b) ? b : [];
}

export async function setBlocks(courseId: string, activityId: string, blocks: Block[]): Promise<Block[]> {
  return withLock(async () => {
    const all = await readAll();
    all[courseId] = all[courseId] ?? {};
    all[courseId][activityId] = blocks;
    await writeAll(all);
    return blocks;
  });
}
