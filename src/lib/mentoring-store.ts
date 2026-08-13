import { prisma } from "@/lib/prisma";

/**
 * 탐구활동 멘토링 방(강좌 + 학생). 탐구 보고서·독서활동·1:1 채팅·개별 공지를
 * Neon DB(Prisma)에 영구 저장한다. 관리자가 삭제하기 전까지 사라지지 않으며,
 * 재접속 시 저장된 데이터를 그대로 다시 볼 수 있다.
 * (과거엔 /var/data 파일 저장 → Render 배포마다 초기화되어 데이터가 유실됐다. 그래서 DB로 이전.)
 */
export type FieldKey =
  | "topic" | "motive" | "process" | "result" | "difficulty" | "overcome" | "learned" | "standard" | "references";
export type Report = Record<FieldKey, string>;
export const FIELD_KEYS: FieldKey[] = ["topic", "motive", "process", "result", "difficulty", "overcome", "learned", "standard", "references"];

export type FileMeta = { name: string; size: number };
export type ChatMsg = {
  id: string;
  from: "teacher" | "student";
  senderId: string;
  text: string;
  at: string;
  edited: boolean;
  deleted: boolean;
  kind: "text" | "file";
  file: FileMeta | null;
  fileMime: string | null;
};
export type Book = { book: string; author: string; motive: string; review: string; influence: string };
export type Notice = { id: string; body: string; at: string; updated: boolean };
export type MentoringRoom = {
  report: Report;
  reportFile: FileMeta | null;
  books: Book[];
  chat: ChatMsg[];
  notices: Notice[];
};

function blankReport(): Report {
  return { topic: "", motive: "", process: "", result: "", difficulty: "", overcome: "", learned: "", standard: "", references: "" };
}
export function emptyRoom(): MentoringRoom {
  return { report: blankReport(), reportFile: null, books: [], chat: [], notices: [] };
}

function fmtAt(d: Date): string {
  try {
    return d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

/** 방 전체 스냅샷(메타데이터). 파일 실제 바이트(dataUrl)는 포함하지 않는다 — 다운로드는 file 라우트로. */
export async function loadRoom(courseId: string, studentId: string): Promise<MentoringRoom> {
  const [rep, books, msgs, notices] = await Promise.all([
    prisma.mentoringReport.findUnique({ where: { courseId_studentId: { courseId, studentId } } }),
    prisma.mentoringBook.findMany({ where: { courseId, studentId }, orderBy: [{ sort: "asc" }, { createdAt: "asc" }] }),
    prisma.mentoringMessage.findMany({ where: { courseId, studentId }, orderBy: { createdAt: "asc" }, take: -500 }),
    prisma.mentoringNotice.findMany({ where: { courseId, studentId }, orderBy: { createdAt: "desc" } }),
  ]);

  const report: Report = rep
    ? { topic: rep.topic, motive: rep.motive, process: rep.process, result: rep.result, difficulty: rep.difficulty, overcome: rep.overcome, learned: rep.learned, standard: rep.standard, references: rep.references }
    : blankReport();

  const reportFile: FileMeta | null = rep && rep.fileName ? { name: rep.fileName, size: rep.fileSize ?? 0 } : null;

  return {
    report,
    reportFile,
    books: books.map((b) => ({ book: b.book, author: b.author, motive: b.motive, review: b.review, influence: b.influence })),
    chat: msgs.map((m) => ({
      id: m.id,
      from: (m.senderRole === "teacher" ? "teacher" : "student") as "teacher" | "student",
      senderId: m.senderId,
      text: m.deletedAt ? "" : m.text,
      at: fmtAt(m.createdAt),
      edited: !!m.editedAt && !m.deletedAt,
      deleted: !!m.deletedAt,
      kind: (m.kind === "file" ? "file" : "text") as "text" | "file",
      file: m.kind === "file" && m.fileName && !m.deletedAt ? { name: m.fileName, size: m.fileSize ?? 0 } : null,
      fileMime: m.deletedAt ? null : m.fileMime ?? null,
    })),
    notices: notices.map((n) => ({ id: n.id, body: n.body, at: fmtAt(n.createdAt), updated: n.updatedAt.getTime() - n.createdAt.getTime() > 1000 })),
  };
}

/* ── 탐구 보고서 ── */
export async function saveReport(courseId: string, studentId: string, report: Report): Promise<void> {
  await prisma.mentoringReport.upsert({
    where: { courseId_studentId: { courseId, studentId } },
    create: { courseId, studentId, ...report },
    update: { ...report },
  });
}

export type UploadFile = { name: string; size: number; mime: string; dataUrl: string };

export async function setReportFile(courseId: string, studentId: string, file: UploadFile | null): Promise<void> {
  const data = file ? { fileName: file.name, fileSize: file.size, fileData: file.dataUrl } : { fileName: null, fileSize: null, fileData: null };
  await prisma.mentoringReport.upsert({
    where: { courseId_studentId: { courseId, studentId } },
    create: { courseId, studentId, ...blankReport(), ...data },
    update: { ...data },
  });
}

export async function getReportFileData(courseId: string, studentId: string): Promise<{ name: string; dataUrl: string } | null> {
  const rep = await prisma.mentoringReport.findUnique({ where: { courseId_studentId: { courseId, studentId } }, select: { fileName: true, fileData: true } });
  if (!rep?.fileData || !rep.fileName) return null;
  return { name: rep.fileName, dataUrl: rep.fileData };
}

/* ── 독서활동상황 ── */
export async function saveBooks(courseId: string, studentId: string, books: Book[]): Promise<void> {
  const trimmed = books.slice(0, 5);
  await prisma.$transaction([
    prisma.mentoringBook.deleteMany({ where: { courseId, studentId } }),
    ...trimmed.map((b, i) => prisma.mentoringBook.create({ data: { courseId, studentId, sort: i, book: b.book, author: b.author, motive: b.motive, review: b.review, influence: b.influence } })),
  ]);
}

/* ── 1:1 채팅 ── */
export async function addTextMessage(courseId: string, studentId: string, senderId: string, senderRole: "teacher" | "student", text: string): Promise<void> {
  await prisma.mentoringMessage.create({ data: { courseId, studentId, senderId, senderRole, kind: "text", text } });
}

export async function addFileMessage(courseId: string, studentId: string, senderId: string, senderRole: "teacher" | "student", file: UploadFile, caption = ""): Promise<void> {
  await prisma.mentoringMessage.create({
    data: { courseId, studentId, senderId, senderRole, kind: "file", text: caption, fileName: file.name, fileSize: file.size, fileMime: file.mime, fileData: file.dataUrl },
  });
}

export async function getMessage(id: string) {
  return prisma.mentoringMessage.findUnique({ where: { id } });
}

export async function editMessage(id: string, text: string): Promise<void> {
  await prisma.mentoringMessage.update({ where: { id }, data: { text, editedAt: new Date() } });
}

export async function deleteMessage(id: string): Promise<void> {
  // 소프트 삭제 — "삭제된 메시지입니다"로 표시. 파일 바이트는 회수.
  await prisma.mentoringMessage.update({ where: { id }, data: { deletedAt: new Date(), fileData: null } });
}

export async function getMessageFileData(id: string): Promise<{ name: string; mime: string; dataUrl: string } | null> {
  const m = await prisma.mentoringMessage.findUnique({ where: { id }, select: { kind: true, deletedAt: true, fileName: true, fileMime: true, fileData: true } });
  if (!m || m.kind !== "file" || m.deletedAt || !m.fileData || !m.fileName) return null;
  return { name: m.fileName, mime: m.fileMime ?? "application/octet-stream", dataUrl: m.fileData };
}

/* ── 개별 공지 ── */
export async function addNotice(courseId: string, studentId: string, authorId: string, body: string): Promise<void> {
  await prisma.mentoringNotice.create({ data: { courseId, studentId, authorId, body } });
}
export async function editNotice(id: string, body: string): Promise<void> {
  await prisma.mentoringNotice.update({ where: { id }, data: { body } });
}
export async function getNotice(id: string) {
  return prisma.mentoringNotice.findUnique({ where: { id } });
}
export async function deleteNotice(id: string): Promise<void> {
  await prisma.mentoringNotice.delete({ where: { id } });
}
