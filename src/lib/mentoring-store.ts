import fs from "node:fs/promises";
import path from "node:path";

/**
 * 탐구활동 멘토링 공유 방(방 = 강좌). 학생 보고서·1:1 채팅·독서활동상황을 서버에 저장해
 * 관리자(교사)와 학생이 같은 방을 실시간으로 공유한다.
 * 파일 저장 + 프로세스 내 뮤텍스(라이브 DB 부담 회피). 서버리스 이전 시 DB/Redis 로 교체.
 * (지금은 강좌당 단일 방 — 데모: 관리자 1 + 학생 1. 다학생 시 방 키를 course+studentId 로 확장.)
 */
export type FieldKey =
  | "topic" | "motive" | "process" | "result" | "difficulty" | "overcome" | "learned" | "standard" | "references";
export type Report = Record<FieldKey, string>;
export type ChatMsg = { from: "teacher" | "student"; text: string; at: string };
export type Book = { book: string; author: string; motive: string; review: string; influence: string };
export type MentoringFile = { name: string; size: number; dataUrl: string };
export type MentoringRoom = { report: Report; chat: ChatMsg[]; books: Book[]; file: MentoringFile | null };

function blankReport(): Report {
  return { topic: "", motive: "", process: "", result: "", difficulty: "", overcome: "", learned: "", standard: "", references: "" };
}
export function emptyRoom(): MentoringRoom {
  return { report: blankReport(), chat: [], books: [], file: null };
}

const persistentStoreDir =
  process.env.LOCAL_DATA_DIR ||
  (process.env.NODE_ENV === "production" ? "/var/data/local_data" : path.join(process.cwd(), ".local_data"));
const resolvedStorePath = path.join(persistentStoreDir, "mentoring.json");

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

async function readAll(): Promise<Record<string, MentoringRoom>> {
  await ensureStore();
  const raw = await fs.readFile(resolvedStorePath, "utf8");
  try {
    const parsed = JSON.parse(raw) as Record<string, MentoringRoom>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeAll(all: Record<string, MentoringRoom>) {
  await ensureStore();
  await fs.writeFile(resolvedStorePath, JSON.stringify(all, null, 2), "utf8");
}

function normalize(r: MentoringRoom | undefined): MentoringRoom {
  if (!r) return emptyRoom();
  return {
    report: { ...blankReport(), ...(r.report ?? {}) },
    chat: Array.isArray(r.chat) ? r.chat : [],
    books: Array.isArray(r.books) ? r.books : [],
    file: r.file && typeof r.file === "object" && typeof r.file.dataUrl === "string" ? r.file : null,
  };
}

export async function getRoom(courseId: string): Promise<MentoringRoom> {
  const all = await readAll();
  return normalize(all[courseId]);
}

export async function saveReport(courseId: string, report: Report): Promise<MentoringRoom> {
  return withLock(async () => {
    const all = await readAll();
    const room = normalize(all[courseId]);
    room.report = { ...blankReport(), ...report };
    all[courseId] = room;
    await writeAll(all);
    return room;
  });
}

export async function addChat(courseId: string, msg: ChatMsg): Promise<MentoringRoom> {
  return withLock(async () => {
    const all = await readAll();
    const room = normalize(all[courseId]);
    room.chat = [...room.chat, msg].slice(-500);
    all[courseId] = room;
    await writeAll(all);
    return room;
  });
}

export async function saveBooks(courseId: string, books: Book[]): Promise<MentoringRoom> {
  return withLock(async () => {
    const all = await readAll();
    const room = normalize(all[courseId]);
    room.books = books.slice(0, 5);
    all[courseId] = room;
    await writeAll(all);
    return room;
  });
}

export async function saveFile(courseId: string, file: MentoringFile | null): Promise<MentoringRoom> {
  return withLock(async () => {
    const all = await readAll();
    const room = normalize(all[courseId]);
    room.file = file;
    all[courseId] = room;
    await writeAll(all);
    return room;
  });
}

export async function clearRoom(courseId: string): Promise<void> {
  return withLock(async () => {
    const all = await readAll();
    if (courseId in all) {
      delete all[courseId];
      await writeAll(all);
    }
  });
}
