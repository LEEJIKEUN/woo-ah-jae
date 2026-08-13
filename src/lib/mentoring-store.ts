import { prisma } from "@/lib/prisma";
import { storeUploadDataUrl, deletePrivateKey } from "@/lib/private-file";

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
export type Assignment = { id: string; name: string; size: number; mime: string; at: string };
export type PeerReview = { assignmentId: string; name: string; mime: string };
export type PeerReviewGroup = { column: number; items: PeerReview[] };
export type MentoringRoom = {
  report: Report;
  reportFile: FileMeta | null;
  books: Book[];
  chat: ChatMsg[];
  notices: Notice[];
  assignments: Assignment[];
  sete: string;
  peerReviews: PeerReviewGroup[];
};

function blankReport(): Report {
  return { topic: "", motive: "", process: "", result: "", difficulty: "", overcome: "", learned: "", standard: "", references: "" };
}
export function emptyRoom(): MentoringRoom {
  return { report: blankReport(), reportFile: null, books: [], chat: [], notices: [], assignments: [], sete: "", peerReviews: [] };
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
  const [rep, books, msgs, notices, assignments, sete] = await Promise.all([
    prisma.mentoringReport.findUnique({ where: { courseId_studentId: { courseId, studentId } } }),
    prisma.mentoringBook.findMany({ where: { courseId, studentId }, orderBy: [{ sort: "asc" }, { createdAt: "asc" }] }),
    prisma.mentoringMessage.findMany({ where: { courseId, studentId }, orderBy: { createdAt: "asc" }, take: -500 }),
    prisma.mentoringNotice.findMany({ where: { courseId, studentId }, orderBy: { createdAt: "desc" } }),
    prisma.mentoringAssignment.findMany({ where: { courseId, studentId }, orderBy: { createdAt: "asc" } }),
    prisma.mentoringSete.findUnique({ where: { courseId_studentId: { courseId, studentId } }, select: { body: true } }),
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
    assignments: assignments.map((a) => ({ id: a.id, name: a.name, size: a.size, mime: a.mime, at: fmtAt(a.createdAt) })),
    sete: sete?.body ?? "",
    peerReviews: await loadPeerReviews(courseId, studentId),
  };
}

/** 이 학생이 상호 피드백으로 읽어야 할 과제 — 과제(column)별로 그룹(누적). */
async function loadPeerReviews(courseId: string, studentId: string): Promise<PeerReviewGroup[]> {
  const peer = await prisma.mentoringPeerReview.findMany({ where: { courseId, recipientStudentId: studentId }, orderBy: [{ column: "asc" }, { createdAt: "asc" }], select: { assignmentId: true, column: true } });
  if (!peer.length) return [];
  const asgs = await prisma.mentoringAssignment.findMany({ where: { id: { in: peer.map((p) => p.assignmentId) } }, select: { id: true, name: true, mime: true } });
  const m = new Map(asgs.map((a) => [a.id, a]));
  const byCol = new Map<number, PeerReview[]>();
  for (const p of peer) {
    const a = m.get(p.assignmentId);
    if (!a) continue;
    byCol.set(p.column, [...(byCol.get(p.column) ?? []), { assignmentId: a.id, name: a.name, mime: a.mime }]);
  }
  return [...byCol.entries()].sort((x, y) => x[0] - y[0]).map(([column, items]) => ({ column, items }));
}

/** 이 사용자가 해당 과제의 피어 리뷰 대상자인지(과제 열람 권한 근거). */
export async function isPeerReviewer(courseId: string, userId: string, assignmentId: string): Promise<boolean> {
  const r = await prisma.mentoringPeerReview.findFirst({ where: { courseId, recipientStudentId: userId, assignmentId }, select: { id: true } });
  return !!r;
}

/**
 * 상호 피드백 배포 — 선택 학생들의 column 번째 과제를 pool 로, 각 학생(recipient)에게
 * 본인 제외 랜덤 count 개를 배정. 선택된 학생들의 기존 배정은 교체한다.
 */
export async function distributePeerReview(courseId: string, column: number, studentIds: string[], count: number): Promise<{ recipients: number; assigned: number; perAssignment: number }> {
  const all = await prisma.mentoringAssignment.findMany({ where: { courseId, studentId: { in: studentIds } }, orderBy: { createdAt: "asc" }, select: { id: true, studentId: true } });
  const byStudent = new Map<string, string[]>();
  for (const a of all) byStudent.set(a.studentId, [...(byStudent.get(a.studentId) ?? []), a.id]);

  // 이 과제(column)를 실제로 제출한 학생만 참여 — 미제출자는 배부·수신에서 제외
  const participants = studentIds.filter((sid) => !!byStudent.get(sid)?.[column]);
  const n = participants.length;
  // 무작위 순서로 섞기
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [participants[i], participants[j]] = [participants[j], participants[i]];
  }
  // 원형 라운드로빈: 각자 '다음 k명'의 과제를 받음 → 모든 과제가 정확히 k번씩 배부(완전 균등, 본인 제외·중복 없음)
  const k = Math.min(count, Math.max(0, n - 1));
  const rows: { courseId: string; recipientStudentId: string; assignmentId: string }[] = [];
  for (let i = 0; i < n; i++) {
    const recipient = participants[i];
    for (let off = 1; off <= k; off++) {
      const author = participants[(i + off) % n];
      rows.push({ courseId, recipientStudentId: recipient, assignmentId: byStudent.get(author)![column] });
    }
  }

  // 이 과제(column)의 기존 배정만 교체 → 다른 과제 배정은 누적 유지
  await prisma.$transaction([
    prisma.mentoringPeerReview.deleteMany({ where: { courseId, recipientStudentId: { in: studentIds }, column } }),
    ...rows.map((r) => prisma.mentoringPeerReview.create({ data: { ...r, column } })),
  ]);
  return { recipients: n, assigned: rows.length, perAssignment: k };
}

/** 세특(과목별 세부능력 특기사항) 저장 — 관리자·퍼실. */
export async function saveSete(courseId: string, studentId: string, body: string): Promise<void> {
  await prisma.mentoringSete.upsert({
    where: { courseId_studentId: { courseId, studentId } },
    create: { courseId, studentId, body },
    update: { body },
  });
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
  let data;
  if (file) {
    const ref = await storeUploadDataUrl(`mentoring/${courseId}/${studentId}/report`, file.name, file.mime, file.dataUrl);
    data = { fileName: file.name, fileSize: file.size, fileMime: file.mime, fileData: ref.data, fileKey: ref.key };
  } else {
    data = { fileName: null, fileSize: null, fileMime: null, fileData: null, fileKey: null };
  }
  await prisma.mentoringReport.upsert({
    where: { courseId_studentId: { courseId, studentId } },
    create: { courseId, studentId, ...blankReport(), ...data },
    update: { ...data },
  });
}

export type FileBytesRef = { name: string; mime: string; key: string | null; data: string | null };

export async function getReportFileData(courseId: string, studentId: string): Promise<FileBytesRef | null> {
  const rep = await prisma.mentoringReport.findUnique({ where: { courseId_studentId: { courseId, studentId } }, select: { fileName: true, fileMime: true, fileData: true, fileKey: true } });
  if (!rep?.fileName || (!rep.fileData && !rep.fileKey)) return null;
  return { name: rep.fileName, mime: rep.fileMime ?? "application/pdf", key: rep.fileKey, data: rep.fileData };
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
  const ref = await storeUploadDataUrl(`mentoring/${courseId}/${studentId}/chat`, file.name, file.mime, file.dataUrl);
  await prisma.mentoringMessage.create({
    data: { courseId, studentId, senderId, senderRole, kind: "file", text: caption, fileName: file.name, fileSize: file.size, fileMime: file.mime, fileData: ref.data, fileKey: ref.key },
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

export async function getMessageFileData(id: string): Promise<FileBytesRef | null> {
  const m = await prisma.mentoringMessage.findUnique({ where: { id }, select: { kind: true, deletedAt: true, fileName: true, fileMime: true, fileData: true, fileKey: true } });
  if (!m || m.kind !== "file" || m.deletedAt || !m.fileName || (!m.fileData && !m.fileKey)) return null;
  return { name: m.fileName, mime: m.fileMime ?? "application/octet-stream", key: m.fileKey, data: m.fileData };
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

/* ── 과제 업로드 ── */
export async function addAssignment(courseId: string, studentId: string, uploaderId: string, file: { name: string; size: number; mime: string; key: string }): Promise<void> {
  await prisma.mentoringAssignment.create({ data: { courseId, studentId, uploaderId, name: file.name, size: file.size, mime: file.mime, fileKey: file.key } });
}
export async function getAssignment(id: string) {
  return prisma.mentoringAssignment.findUnique({ where: { id } });
}
export async function deleteAssignment(id: string): Promise<void> {
  const a = await prisma.mentoringAssignment.findUnique({ where: { id }, select: { fileKey: true } });
  await deletePrivateKey(a?.fileKey); // R2 파일도 함께 제거 → 삭제 시 R2 용량 회수
  await prisma.mentoringAssignment.delete({ where: { id } });
}
