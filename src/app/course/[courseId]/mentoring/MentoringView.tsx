"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Lock, Send, ChevronLeft, Plus, X, Upload, FileText, Download, Pencil, Paperclip, Trash2, Megaphone, Check, Smile } from "lucide-react";
import EmojiPicker from "@/components/ui/EmojiPicker";
import ClassroomSidebar from "@/components/course/ClassroomSidebar";

/* 우아재 서재 톤 */
const BROWN = "#8C6E59";
const DEEP = "#6B5342";
const INK = "#2C2823";
const BODY = "#334155";
const SUB = "#8A8479";
const MUTED = "#94a3b8";
const LINE = "#E4DBC7";
const CARD = "#EFEBE1";
const PANEL = "#FBF8F2";
const serif = { fontFamily: "var(--font-serif)" } as const;

type FieldKey = "topic" | "motive" | "process" | "result" | "difficulty" | "overcome" | "learned" | "standard" | "references";
const FIELDS: { key: FieldKey; label: string; rows: number }[] = [
  { key: "topic", label: "주제", rows: 2 },
  { key: "motive", label: "동기", rows: 6 },
  { key: "process", label: "과정", rows: 6 },
  { key: "result", label: "결과", rows: 5 },
  { key: "difficulty", label: "어려움", rows: 3 },
  { key: "overcome", label: "극복", rows: 3 },
  { key: "learned", label: "배운 점", rows: 3 },
  { key: "standard", label: "성취기준", rows: 2 },
  { key: "references", label: "참고문헌", rows: 2 },
];
// 필드별 제한 바이트(성취기준은 선택형이라 제외). 실제 입력은 +10%까지 허용.
const FIELD_LIMITS: Partial<Record<FieldKey, number>> = {
  topic: 90, motive: 300, process: 600, result: 300, difficulty: 240, overcome: 360, learned: 300, references: 300,
};
const BOOK_LIMITS = { motive: 90, review: 260, influence: 260 } as const;
const SETE_LIMIT = 1500; // 과목별 세부능력 특기사항(참고)
const OVER_RED = "#dc2626";

type Report = Record<FieldKey, string>;
type FileMeta = { name: string; size: number };
type ChatMsg = { id: string; from: "teacher" | "student"; senderId: string; text: string; at: string; edited: boolean; deleted: boolean; kind: "text" | "file"; file: FileMeta | null; fileMime: string | null };
type Book = { book: string; author: string; motive: string; review: string; influence: string };
type Notice = { id: string; body: string; at: string; updated: boolean };
type Assignment = { id: string; name: string; size: number; mime: string; at: string; column: number };
const ASSIGN_SLOTS = [0, 1, 2, 3, 4]; // 과제1~5 슬롯(독립)
// 브라우저 새 탭에서 소리·화면 원활히 재생되는 동영상만 허용
const VIDEO_EXTS = ["mp4", "m4v", "webm", "mov"];
const VIDEO_MIMES = ["video/mp4", "video/webm", "video/quicktime", "video/x-m4v"];
const VIDEO_LABEL = "MP4, WebM, MOV";
const ASSIGN_ACCEPT = "application/pdf,.pdf,.mp4,.m4v,.webm,.mov,video/mp4,video/webm,video/quicktime";
function checkAssignmentFile(name: string, mime: string): { ok: boolean; isVideo: boolean } {
  const lower = name.toLowerCase();
  const isPdf = mime === "application/pdf" || lower.endsWith(".pdf");
  const ext = lower.includes(".") ? lower.split(".").pop()! : "";
  const isVideo = VIDEO_EXTS.includes(ext) || VIDEO_MIMES.includes(mime);
  return { ok: isPdf || isVideo, isVideo };
}
function isVideoName(name: string) {
  const l = name.toLowerCase();
  return VIDEO_EXTS.some((e) => l.endsWith("." + e));
}
// 과제 열기 링크 — 동영상은 다운로드 차단 뷰어로, 그 외(PDF)는 파일 API(새 탭)로.
function assignmentOpenHref(courseId: string, id: string, name: string) {
  return isVideoName(name)
    ? `/course/${courseId}/mentoring/watch/${id}`
    : `/api/courses/${courseId}/mentoring/assignment/${id}`;
}
type PeerReview = { assignmentId: string | null; name: string; status: string; resubmittedAt: string | null };
type PeerReviewGroup = { column: number; items: PeerReview[] };
type Room = { report: Report; reportFile: FileMeta | null; books: Book[]; chat: ChatMsg[]; notices: Notice[]; assignments: Assignment[]; sete: string; peerReviews: PeerReviewGroup[] };
const BLANK_BOOK: Book = { book: "", author: "", motive: "", review: "", influence: "" };
function blankReport(): Report {
  return { topic: "", motive: "", process: "", result: "", difficulty: "", overcome: "", learned: "", standard: "", references: "" };
}

const MAX_BOOKS = 5;
const MAX_FILE_BYTES = 20 * 1024 * 1024;

// 모바일에서 한 번에 한 섹션씩 볼 수 있게 하는 필터 목록
const SECTIONS = [
  { key: "report", label: "탐구 보고서" },
  { key: "notice", label: "개별 공지" },
  { key: "sete", label: "세특(참고)" },
  { key: "chat", label: "1:1 멘토링" },
  { key: "drive", label: "자료함" },
  { key: "books", label: "독서활동" },
  { key: "assignment", label: "과제" },
] as const;

function byteLen(s: string) {
  try {
    return new TextEncoder().encode(s).length;
  } catch {
    return s.length;
  }
}
// UTF-8 바이트 기준으로 잘라내기(제한+10% 초과분은 입력 차단).
function truncateToBytes(s: string, maxBytes: number): string {
  const enc = new TextEncoder();
  if (enc.encode(s).length <= maxBytes) return s;
  let out = "";
  let bytes = 0;
  for (const ch of s) {
    const b = enc.encode(ch).length;
    if (bytes + b > maxBytes) break;
    out += ch;
    bytes += b;
  }
  return out;
}
type StdItem = { id?: string; area?: string; code: string; content: string };
function parseStandards(v: string): { code: string; content: string }[] {
  try {
    const a = JSON.parse(v);
    return Array.isArray(a) ? a.filter((x) => x && typeof x.content === "string").map((x) => ({ code: String(x.code ?? ""), content: String(x.content) })) : [];
  } catch {
    return [];
  }
}
function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function readAsDataUrl(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read"));
    reader.readAsDataURL(f);
  });
}
async function postRoom(courseId: string, studentId: string, payload: object) {
  const res = await fetch(`/api/courses/${courseId}/mentoring`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, studentId }),
  });
  return res;
}

export default function MentoringView({
  courseId,
  role,
  isStaff = false,
  isParent = false,
  isStudent = false,
  students = [],
  initialStudentId = "",
  viewerId = "",
}: {
  courseId: string;
  role: "teacher" | "student";
  isStaff?: boolean;
  isParent?: boolean;
  isStudent?: boolean;
  students?: { id: string; name: string }[];
  initialStudentId?: string;
  viewerId?: string;
}) {
  // 권한: 보고서·독서·파일 = 학생만 / 채팅·채팅파일 = 학생+스태프 / 공지 = 스태프만 / 학부모 = 열람 전용
  const canEditReport = isStudent;
  const canEditBooks = isStudent;
  const canUploadFile = isStudent;
  const canChat = isStudent || isStaff;
  const canPostNotice = isStaff;
  const showSelector = (isStaff || isParent) && students.length > 0;
  const noStudent = (isStaff || isParent) && !initialStudentId;

  const [studentId, setStudentId] = useState(initialStudentId);
  const [mobileSection, setMobileSection] = useState<string>("report"); // 모바일 섹션 필터
  const vis = (key: string) => (mobileSection === key ? "" : "hidden xl:block"); // 데스크톱은 항상 표시
  const [report, setReport] = useState<Report>(blankReport());
  const [reportFile, setReportFile] = useState<FileMeta | null>(null);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [peerReviews, setPeerReviews] = useState<PeerReviewGroup[]>([]);
  const [standards, setStandards] = useState<StdItem[]>([]);
  const [assignErr, setAssignErr] = useState<string | null>(null);
  const [assignPct, setAssignPct] = useState<number | null>(null);
  const [uploadCol, setUploadCol] = useState<number | null>(null); // 업로드 진행 중 슬롯
  const pendingColRef = useRef<number>(0);
  const assignInputRef = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState("");
  const [chatEmojiOpen, setChatEmojiOpen] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [bookDraft, setBookDraft] = useState<Book>(BLANK_BOOK);
  const [editBookIdx, setEditBookIdx] = useState<number | null>(null);
  const [editBook, setEditBook] = useState<Book>(BLANK_BOOK);
  const [fileError, setFileError] = useState<string | null>(null);
  const [reportPct, setReportPct] = useState<number | null>(null);
  const [chatFileError, setChatFileError] = useState<string | null>(null);
  const [uploadingChat, setUploadingChat] = useState(false);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editMsgDraft, setEditMsgDraft] = useState("");
  const [sete, setSete] = useState("");
  const [editingSete, setEditingSete] = useState(false);
  const [seteDraft, setSeteDraft] = useState("");
  const [noticeDraft, setNoticeDraft] = useState("");
  const [editingNoticeId, setEditingNoticeId] = useState<string | null>(null);
  const [noticeEditDraft, setNoticeEditDraft] = useState("");
  const dirtyRef = useRef(false); // 보고서를 편집 중(미저장)이면 SSE 로 덮어쓰지 않음
  const seteDirtyRef = useRef(false); // 세특 편집 중이면 SSE 로 덮어쓰지 않음
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const chatFileInputRef = useRef<HTMLInputElement | null>(null);

  const fileUrl = useCallback(
    (id: string) => `/api/courses/${courseId}/mentoring/file?studentId=${encodeURIComponent(studentId)}&id=${encodeURIComponent(id)}`,
    [courseId, studentId]
  );

  // 실시간 방 구독(SSE) — 선택 학생 방
  useEffect(() => {
    if (!studentId) return;
    setReport(blankReport());
    setReportFile(null);
    setReportPct(null);
    setChat([]);
    setBooks([]);
    setNotices([]);
    setAssignments([]);
    setPeerReviews([]);
    setSete("");
    setEditingSete(false);
    seteDirtyRef.current = false;
    setEditingMsgId(null);
    dirtyRef.current = false;
    const es = new EventSource(`/api/courses/${courseId}/mentoring/stream?studentId=${encodeURIComponent(studentId)}`);
    es.onmessage = (e) => {
      try {
        const room = JSON.parse(e.data) as Room;
        setChat(Array.isArray(room.chat) ? room.chat : []);
        setBooks(Array.isArray(room.books) ? room.books : []);
        setNotices(Array.isArray(room.notices) ? room.notices : []);
        setAssignments(Array.isArray(room.assignments) ? room.assignments : []);
        setPeerReviews(Array.isArray(room.peerReviews) ? room.peerReviews : []);
        if (!seteDirtyRef.current) setSete(typeof room.sete === "string" ? room.sete : "");
        setReportFile(room.reportFile ?? null);
        if (!dirtyRef.current) setReport({ ...blankReport(), ...(room.report ?? {}) });
      } catch {
        /* 무시 */
      }
    };
    return () => es.close();
  }, [courseId, studentId]);

  // 새 메시지 오면 스크롤 하단으로
  useEffect(() => {
    const el = chatScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat]);

  // 강좌 성취기준 목록(관리자가 엑셀로 등록) — 탐구보고서 성취기준 선택에 사용
  useEffect(() => {
    let alive = true;
    fetch(`/api/courses/${courseId}/achievement-standards`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => { if (alive) setStandards(Array.isArray(d.items) ? d.items : []); })
      .catch(() => { /* 무시 */ });
    return () => { alive = false; };
  }, [courseId]);

  function startEditSete() {
    setSeteDraft(sete);
    seteDirtyRef.current = true;
    setEditingSete(true);
  }
  function cancelEditSete() {
    seteDirtyRef.current = false;
    setEditingSete(false);
  }
  async function submitSete() {
    try {
      await postRoom(courseId, studentId, { action: "sete", body: seteDraft });
      setSete(seteDraft);
    } catch {
      /* 무시 */
    } finally {
      seteDirtyRef.current = false;
      setEditingSete(false);
    }
  }

  const hasContent = useMemo(() => Object.values(report).some((v) => v.trim().length > 0), [report]);
  const driveFiles = useMemo(() => chat.filter((m) => m.kind === "file" && !m.deleted && m.file), [chat]);

  function setField(key: FieldKey, value: string) {
    if (!canEditReport) return;
    dirtyRef.current = true;
    setReport((prev) => ({ ...prev, [key]: value }));
    setSavedFlash(false);
  }

  async function save() {
    if (!canEditReport) return;
    try {
      const res = await postRoom(courseId, studentId, { action: "report", report });
      if (res.ok) {
        dirtyRef.current = false;
        setSavedFlash(true);
      }
    } catch {
      /* 무시 */
    }
  }

  /* ── 채팅 ── */
  async function send() {
    if (!canChat) return;
    const t = draft.trim();
    if (!t) return;
    setDraft("");
    try {
      await postRoom(courseId, studentId, { action: "chat", text: t });
    } catch {
      /* 무시 */
    }
  }
  async function onChatFile(e: React.ChangeEvent<HTMLInputElement>) {
    if (!canChat) return;
    setChatFileError(null);
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > MAX_FILE_BYTES) {
      setChatFileError(`파일이 너무 큽니다. (최대 ${fmtSize(MAX_FILE_BYTES)})`);
      return;
    }
    setUploadingChat(true);
    try {
      const dataUrl = await readAsDataUrl(f);
      const res = await postRoom(courseId, studentId, { action: "chatFile", file: { name: f.name, size: f.size, mime: f.type, dataUrl } });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setChatFileError(d.error ?? "업로드에 실패했습니다.");
      }
    } catch {
      setChatFileError("업로드 중 오류가 발생했습니다.");
    } finally {
      setUploadingChat(false);
    }
  }
  function startEditMsg(m: ChatMsg) {
    setEditingMsgId(m.id);
    setEditMsgDraft(m.text);
  }
  async function saveEditMsg() {
    const id = editingMsgId;
    const t = editMsgDraft.trim();
    if (!id || !t) {
      setEditingMsgId(null);
      return;
    }
    setEditingMsgId(null);
    try {
      await postRoom(courseId, studentId, { action: "editChat", id, text: t });
    } catch {
      /* 무시 */
    }
  }
  async function deleteMsg(id: string) {
    if (!window.confirm("이 메시지를 삭제할까요? '삭제된 메시지입니다'로 표시됩니다.")) return;
    try {
      await postRoom(courseId, studentId, { action: "deleteChat", id });
    } catch {
      /* 무시 */
    }
  }

  /* ── 독서활동상황 ── */
  async function persistBooks(next: Book[]) {
    setBooks(next);
    try {
      await postRoom(courseId, studentId, { action: "books", books: next });
    } catch {
      /* 무시 */
    }
  }
  function addBook() {
    if (!canEditBooks) return;
    if (books.length >= MAX_BOOKS) return;
    if (!bookDraft.book.trim() && !bookDraft.author.trim()) return;
    void persistBooks([...books, bookDraft]);
    setBookDraft(BLANK_BOOK);
  }
  function removeBook(idx: number) {
    if (!canEditBooks) return;
    if (editBookIdx === idx) cancelEditBook();
    void persistBooks(books.filter((_, i) => i !== idx));
  }
  function startEditBook(i: number) {
    if (!canEditBooks) return;
    setEditBookIdx(i);
    setEditBook({ ...books[i] });
  }
  function cancelEditBook() {
    setEditBookIdx(null);
    setEditBook(BLANK_BOOK);
  }
  function saveEditBook() {
    if (!canEditBooks || editBookIdx === null) return;
    const next = books.map((b, i) => (i === editBookIdx ? editBook : b));
    void persistBooks(next);
    cancelEditBook();
  }

  /* ── 보고서 파일(PDF) ── */
  async function onUploadReportFile(e: React.ChangeEvent<HTMLInputElement>) {
    if (!canUploadFile) return;
    setFileError(null);
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const isPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setFileError("PDF 파일만 업로드할 수 있습니다.");
      return;
    }
    if (f.size > MAX_FILE_BYTES) {
      setFileError(`파일이 너무 큽니다. (최대 ${fmtSize(MAX_FILE_BYTES)})`);
      return;
    }
    setReportPct(0);
    try {
      const dataUrl = await readAsDataUrl(f);
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `/api/courses/${courseId}/mentoring`);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setReportPct(Math.round((ev.loaded / ev.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else {
            let msg = `업로드 실패 (${xhr.status})`;
            try {
              const d = JSON.parse(xhr.responseText) as { error?: string };
              if (d.error) msg = d.error;
            } catch {
              /* 무시 */
            }
            reject(new Error(msg));
          }
        };
        xhr.onerror = () => reject(new Error("네트워크 오류가 발생했습니다."));
        xhr.send(JSON.stringify({ action: "reportFile", file: { name: f.name, size: f.size, mime: f.type, dataUrl }, studentId }));
      });
      setReportFile({ name: f.name, size: f.size }); // 낙관적 표시(SSE 로 확정)
    } catch (e2) {
      setFileError(e2 instanceof Error ? e2.message : "업로드 중 오류가 발생했습니다.");
    } finally {
      setReportPct(null);
    }
  }
  function removeReportFile() {
    if (!canUploadFile) return;
    setFileError(null);
    void postRoom(courseId, studentId, { action: "reportFile", file: null });
  }

  /* ── 개별 공지 ── */
  async function postNotice() {
    const t = noticeDraft.trim();
    if (!t) return;
    setNoticeDraft("");
    try {
      await postRoom(courseId, studentId, { action: "notice", body: t });
    } catch {
      /* 무시 */
    }
  }
  function startEditNotice(n: Notice) {
    setEditingNoticeId(n.id);
    setNoticeEditDraft(n.body);
  }
  async function saveEditNotice() {
    const id = editingNoticeId;
    const t = noticeEditDraft.trim();
    if (!id || !t) {
      setEditingNoticeId(null);
      return;
    }
    setEditingNoticeId(null);
    try {
      await postRoom(courseId, studentId, { action: "editNotice", id, body: t });
    } catch {
      /* 무시 */
    }
  }
  async function deleteNotice(id: string) {
    if (!window.confirm("이 공지를 삭제할까요?")) return;
    try {
      await postRoom(courseId, studentId, { action: "deleteNotice", id });
    } catch {
      /* 무시 */
    }
  }

  /* ── 과제 업로드(학생 본인, R2 직접 업로드) ── */
  function triggerAssignUpload(col: number) {
    pendingColRef.current = col;
    assignInputRef.current?.click();
  }
  async function onAssignmentFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const column = pendingColRef.current;
    if (!checkAssignmentFile(f.name, f.type).ok) {
      setAssignErr(`PDF 또는 지원되는 동영상(${VIDEO_LABEL})만 업로드할 수 있습니다.`);
      return;
    }
    setAssignErr(null);
    setUploadCol(column);
    setAssignPct(0);
    try {
      const pres = await fetch(`/api/courses/${courseId}/mentoring/assignment/presign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: f.name, contentType: f.type, size: f.size }),
      });
      if (!pres.ok) {
        const d = (await pres.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? "업로드 준비에 실패했습니다.");
      }
      const { url, key } = (await pres.json()) as { url: string; key: string };
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", url);
        xhr.setRequestHeader("Content-Type", f.type || "application/octet-stream");
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setAssignPct(Math.round((ev.loaded / ev.total) * 100));
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`업로드 실패 (${xhr.status})`)));
        xhr.onerror = () => reject(new Error("네트워크 오류(업로드). R2 CORS 설정을 확인하세요."));
        xhr.send(f);
      });
      const res = await postRoom(courseId, studentId, { action: "assignmentAdd", name: f.name, size: f.size, mime: f.type, key, column });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setAssignErr(d.error ?? "업로드에 실패했습니다.");
      }
    } catch (e2) {
      setAssignErr(e2 instanceof Error ? e2.message : "업로드에 실패했습니다.");
    } finally {
      setAssignPct(null);
      setUploadCol(null);
    }
  }
  async function removeAssignment(id: string) {
    if (!window.confirm("이 과제 파일을 삭제할까요?")) return;
    try {
      await postRoom(courseId, studentId, { action: "assignmentDelete", id });
    } catch {
      /* 무시 */
    }
  }

  return (
    <div className="flex w-full items-start" style={{ background: "#fff" }}>
      <ClassroomSidebar courseId={courseId} isStaff={isStaff} isParent={isParent} />

      <main className="min-w-0 flex-1 px-6 py-8 lg:px-8">
        <div className="mb-6 flex items-end justify-between gap-3">
          <div>
            <Link href={`/course/${courseId}/learn`} className="mb-1 inline-flex items-center gap-1 text-[13px]" style={{ color: BROWN }}>
              <ChevronLeft size={14} /> 강의실
            </Link>
            <h1 className="text-[26px] font-normal" style={{ ...serif, color: INK }}>탐구활동 멘토링</h1>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {showSelector ? (
              isParent && students.length === 1 ? (
                <span className="rounded-full border px-3 py-1.5 text-[12.5px] font-semibold" style={{ borderColor: LINE, color: INK, background: "#fff" }}>
                  {students[0].name} 학생 (내 자녀)
                </span>
              ) : (
                <select
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="rounded-full border px-3 py-1.5 text-[12.5px] font-semibold outline-none focus:border-[#8C6E59]"
                  style={{ borderColor: LINE, color: INK, background: "#fff" }}
                  aria-label={isParent ? "자녀 선택" : "학생 선택"}
                >
                  {students.map((st) => (
                    <option key={st.id} value={st.id}>{st.name} 학생{isParent ? " (내 자녀)" : ""}</option>
                  ))}
                </select>
              )
            ) : null}
          </div>
        </div>

        {noStudent ? (
          <div className="rounded-[14px] border p-10 text-center text-[14px]" style={{ borderColor: CARD, color: SUB }}>
            {isParent ? "연결된 자녀가 이 강좌를 수강하고 있지 않습니다." : "수강 중인 학생이 없습니다. 학생이 수강신청하면 학생을 선택해 멘토링을 진행할 수 있습니다."}
          </div>
        ) : (
        <>
          {/* 모바일: 섹션 필터 (좁은 화면에서 한 섹션씩 보기) */}
          <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1 xl:hidden">
            {SECTIONS.map((s) => (
              <button key={s.key} type="button" onClick={() => setMobileSection(s.key)} className="shrink-0 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition" style={mobileSection === s.key ? { background: BROWN, color: "#fff", borderColor: BROWN } : { borderColor: LINE, color: SUB, background: "#fff" }}>
                {s.label}
              </button>
            ))}
          </div>
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          {/* 중: 학생 탐구 보고서 + 상호 피드백 */}
          <div className={`space-y-4 ${vis("report")}`}>
          <section className="rounded-[14px] bg-white" style={{ border: `1px solid ${CARD}` }}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-6 py-4" style={{ borderColor: CARD }}>
              <h2 className="text-[18px] font-bold" style={{ color: INK }}>학생 탐구 보고서</h2>
              <div className="flex items-center gap-3">
                {hasContent ? (
                  <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: "#E7F1EA", color: "#3E7E5B" }}>작성됨</span>
                ) : (
                  <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: PANEL, color: SUB }}>미작성</span>
                )}
              </div>
            </div>

            <div className="space-y-5 px-6 py-5">
              {FIELDS.map((f) => {
                if (f.key === "standard") {
                  return (
                    <StandardField
                      key="standard"
                      value={report.standard}
                      onChange={(v) => setField("standard", v)}
                      standards={standards}
                      readOnly={!canEditReport}
                    />
                  );
                }
                const limit = FIELD_LIMITS[f.key];
                const used = byteLen(report[f.key]);
                const over = limit != null && used > limit;
                return (
                  <div key={f.key}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label className="text-[13.5px] font-bold" style={{ color: INK }}>{f.label}</label>
                      {limit != null ? (
                        <span className="text-[11px]" style={{ color: over ? OVER_RED : MUTED }}>
                          <span className={over ? "font-bold" : ""}>{used}byte</span> / <b>{limit}byte</b>
                        </span>
                      ) : (
                        <span className="text-[11px]" style={{ color: MUTED }}>{used} byte</span>
                      )}
                    </div>
                    <textarea
                      value={report[f.key]}
                      onChange={(e) => setField(f.key, limit != null ? truncateToBytes(e.target.value, Math.floor(limit * 1.1)) : e.target.value)}
                      rows={f.rows}
                      readOnly={!canEditReport}
                      placeholder={!canEditReport ? "" : `${f.label}을(를) 입력하세요.`}
                      className="w-full resize-y rounded-[10px] border px-3.5 py-2.5 text-[14px] leading-7 outline-none focus:border-[#8C6E59]"
                      style={{ borderColor: over ? OVER_RED : "#E7E2D6", color: BODY, background: "#fff" }}
                    />
                  </div>
                );
              })}

              {/* 보고서 파일 (PDF) 업로드 */}
              <div>
                <label className="mb-1.5 block text-[13.5px] font-bold" style={{ color: INK }}>보고서 파일 (PDF)</label>
                {reportPct !== null ? (
                  <div className="rounded-[10px] border px-3.5 py-3.5" style={{ borderColor: LINE }}>
                    <p className="mb-1.5 text-[12.5px] font-semibold" style={{ color: DEEP }}>업로드 중… {reportPct}%{reportPct >= 100 ? " · 처리 중" : ""}</p>
                    <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "#EDE7DA" }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${reportPct}%`, background: BROWN }} />
                    </div>
                  </div>
                ) : reportFile ? (
                  <div className="flex items-center justify-between gap-2 rounded-[10px] border px-3.5 py-3" style={{ borderColor: "#E7E2D6", background: PANEL }}>
                    <a href={`${fileUrl("report")}&v=${reportFile.size}`} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2.5 text-left" title="클릭하면 새 탭에서 열립니다">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] text-white" style={{ background: BROWN }}><FileText size={16} /></span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13.5px] font-semibold hover:underline" style={{ color: DEEP }}>{reportFile.name}</span>
                        <span className="text-[11px]" style={{ color: MUTED }}>{fmtSize(reportFile.size)} · 클릭하여 새 탭에서 보기</span>
                      </span>
                    </a>
                    <div className="flex shrink-0 items-center gap-1">
                      <a href={`${fileUrl("report")}&v=${reportFile.size}&download=1`} className="grid h-8 w-8 place-items-center rounded-[8px] hover:bg-[#F0EBE0]" style={{ color: BROWN }} aria-label="다운로드"><Download size={16} /></a>
                      {canUploadFile ? <button type="button" onClick={removeReportFile} className="grid h-8 w-8 place-items-center rounded-[8px] hover:bg-[#F0EBE0]" style={{ color: MUTED }} aria-label="삭제"><X size={16} /></button> : null}
                    </div>
                  </div>
                ) : canUploadFile ? (
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-dashed py-4 text-[13.5px] transition hover:border-[#8C6E59]" style={{ borderColor: LINE, color: SUB }}>
                    <Upload size={16} /> PDF 파일 업로드
                    <input type="file" accept="application/pdf,.pdf" onChange={onUploadReportFile} className="hidden" />
                  </label>
                ) : (
                  <p className="rounded-[10px] py-3 text-center text-[12.5px]" style={{ background: PANEL, color: SUB }}>첨부된 보고서 파일이 없습니다.</p>
                )}
                {fileError ? <p className="mt-1.5 text-[12px]" style={{ color: "#a6402c" }}>{fileError}</p> : null}
              </div>
            </div>

            {canEditReport ? (
            <div className="flex items-center justify-end gap-3 border-t px-6 py-4" style={{ borderColor: CARD }}>
              {savedFlash ? <span className="text-[13px]" style={{ color: "#3E7E5B" }}>저장됨 · 상대에게 실시간 반영</span> : null}
              <button type="button" onClick={save} className="rounded-[8px] px-6 py-2.5 text-[14px] font-bold text-white transition hover:opacity-90" style={{ background: BROWN }}>
                저장하기
              </button>
            </div>
            ) : null}
          </section>

          {/* 상호 피드백 — 항상 표시(기본 안내), 배정 시 과제별로 누적 */}
          <div className="rounded-[14px] bg-white" style={{ border: `1px solid ${CARD}` }}>
            <div className="border-b px-6 py-4" style={{ borderColor: CARD }}>
              <h2 className="text-[16px] font-bold" style={{ color: INK }}>상호 피드백</h2>
              <p className="mt-1 text-[12.5px] leading-5" style={{ color: SUB }}>상호 피드백 활동은 학생들의 협업능력과 나눔과 배려, 공동체 역량을 키웁니다.</p>
            </div>
            <div className="px-6 py-5">
              <p className="text-[13.5px] leading-6" style={{ color: BODY }}>
                다음 학생들의 과제를 읽고(또는 학습하고) 느낀점을 정리하고, 피드백을 <b style={{ color: DEEP }}>수강생 토론 게시판</b>에 댓글로 제출하세요.
                평가나 조언, 비판적인 의견보다는 <b style={{ color: DEEP }}>긍정적인 의견과 더 발전할 수 있는 방향·아이디어</b>를 중심으로 성심성의껏 작성해 주세요.
              </p>

              {peerReviews.length === 0 ? (
                <p className="mt-4 rounded-[10px] py-3 text-center text-[12.5px]" style={{ background: PANEL, color: SUB }}>아직 배정된 과제가 없습니다.</p>
              ) : (
                <div className="mt-4 space-y-4">
                  {peerReviews.map((g) => (
                    <div key={g.column}>
                      <p className="mb-2 text-[13.5px] font-bold" style={{ color: DEEP }}>과제{g.column + 1}. 상호 피드백</p>
                      <div className="flex flex-col gap-2">
                        {g.items.map((p, i) => (
                          p.status === "deleted" ? (
                            <div
                              key={i}
                              className="inline-flex max-w-full items-start gap-2 rounded-[10px] border px-3.5 py-2.5 text-[13px]"
                              style={{ borderColor: LINE, background: "#FBF6EC" }}
                            >
                              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white" style={{ background: MUTED }}>{i + 1}</span>
                              <span className="min-w-0">
                                <span className="block truncate font-semibold line-through" style={{ color: MUTED }}>{p.name}</span>
                                <span className="mt-0.5 block text-[11.5px] font-bold" style={{ color: "#c2410c" }}>과제가 삭제되었습니다. 다시 업로드할 때까지 기다려주세요.</span>
                              </span>
                            </div>
                          ) : (
                            <a
                              key={i}
                              href={assignmentOpenHref(courseId, p.assignmentId!, p.name)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex max-w-full items-start gap-2 rounded-[10px] border px-3.5 py-2.5 text-[13px] font-semibold transition hover:border-[#8C6E59] hover:bg-[#FBF8F2]"
                              style={{ borderColor: LINE, color: DEEP }}
                              title={p.name}
                            >
                              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white" style={{ background: BROWN }}>{i + 1}</span>
                              <span className="min-w-0">
                                <span className="block truncate">{p.name}</span>
                                {p.status === "resubmitted" && p.resubmittedAt ? (
                                  <span className="mt-0.5 block text-[11.5px] font-bold" style={{ color: "#d97706" }}>{p.resubmittedAt} 파일이 다시 제출되었습니다.</span>
                                ) : null}
                              </span>
                            </a>
                          )
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          </div>

          {/* 우: 개별공지 → 세특 → 1:1 멘토링 → 자료함 → 독서활동상황 → 과제 업로드 (flex order로 정렬) */}
          <aside className="flex flex-col gap-4">
            {/* 독서활동상황 */}
            <div className={`order-5 rounded-[14px] bg-white ${vis("books")}`} style={{ border: `1px solid ${CARD}` }}>
              <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: CARD }}>
                <p className="text-[14px] font-bold" style={{ color: INK }}>독서활동상황</p>
                <span className="text-[12px]" style={{ color: MUTED }}>{books.length} / {MAX_BOOKS}</span>
              </div>
              <div className="space-y-3 px-4 py-4">
                {books.map((b, i) =>
                  editBookIdx === i ? (
                    <div key={i} className="space-y-2 rounded-[10px] p-3" style={{ border: `1px solid ${BROWN}`, background: "#fff" }}>
                      <div className="grid grid-cols-2 gap-2">
                        <BookInput label="책" value={editBook.book} onChange={(v) => setEditBook((p) => ({ ...p, book: v }))} />
                        <BookInput label="저자" value={editBook.author} onChange={(v) => setEditBook((p) => ({ ...p, author: v }))} />
                      </div>
                      <BookArea label="읽게 된 동기" value={editBook.motive} onChange={(v) => setEditBook((p) => ({ ...p, motive: v }))} limit={BOOK_LIMITS.motive} />
                      <BookArea label="책에 대한 평가" value={editBook.review} onChange={(v) => setEditBook((p) => ({ ...p, review: v }))} limit={BOOK_LIMITS.review} />
                      <BookArea label="자신에게 준 영향" value={editBook.influence} onChange={(v) => setEditBook((p) => ({ ...p, influence: v }))} limit={BOOK_LIMITS.influence} />
                      <div className="flex gap-2">
                        <button type="button" onClick={saveEditBook} className="flex-1 rounded-[8px] py-2 text-[13px] font-bold text-white transition hover:opacity-90" style={{ background: BROWN }}>저장</button>
                        <button type="button" onClick={cancelEditBook} className="rounded-[8px] border px-3 py-2 text-[13px] font-semibold" style={{ borderColor: LINE, color: SUB }}>취소</button>
                      </div>
                    </div>
                  ) : (
                    <div key={i} className="rounded-[10px] border bg-white p-3.5" style={{ borderColor: CARD }}>
                      <div className="flex items-start justify-between gap-2 border-b pb-2.5" style={{ borderColor: CARD }}>
                        <p className="text-[13.5px] font-bold" style={{ color: INK }}>
                          {b.book || "(제목 없음)"}
                          {b.author ? <span className="ml-1 font-normal" style={{ color: SUB }}>({b.author})</span> : null}
                        </p>
                        {canEditBooks ? (
                          <div className="flex shrink-0 items-center gap-1.5">
                            <button type="button" onClick={() => startEditBook(i)} aria-label="수정" style={{ color: MUTED }}><Pencil size={13} /></button>
                            <button type="button" onClick={() => removeBook(i)} aria-label="삭제" style={{ color: MUTED }}><X size={15} /></button>
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-2.5 space-y-2.5">
                        {b.motive ? <BookReadField label="읽게 된 동기" value={b.motive} limit={BOOK_LIMITS.motive} /> : null}
                        {b.review ? <BookReadField label="책에 대한 평가" value={b.review} limit={BOOK_LIMITS.review} /> : null}
                        {b.influence ? <BookReadField label="자신에게 준 영향" value={b.influence} limit={BOOK_LIMITS.influence} /> : null}
                      </div>
                    </div>
                  )
                )}

                {canEditBooks && books.length < MAX_BOOKS ? (
                  <div className="space-y-2 rounded-[10px] p-3" style={{ border: `1px dashed ${LINE}` }}>
                    <div className="grid grid-cols-2 gap-2">
                      <BookInput label="책" value={bookDraft.book} onChange={(v) => setBookDraft((p) => ({ ...p, book: v }))} />
                      <BookInput label="저자" value={bookDraft.author} onChange={(v) => setBookDraft((p) => ({ ...p, author: v }))} />
                    </div>
                    <BookArea label="읽게 된 동기" value={bookDraft.motive} onChange={(v) => setBookDraft((p) => ({ ...p, motive: v }))} limit={BOOK_LIMITS.motive} />
                    <BookArea label="책에 대한 평가" value={bookDraft.review} onChange={(v) => setBookDraft((p) => ({ ...p, review: v }))} limit={BOOK_LIMITS.review} />
                    <BookArea label="자신에게 준 영향" value={bookDraft.influence} onChange={(v) => setBookDraft((p) => ({ ...p, influence: v }))} limit={BOOK_LIMITS.influence} />
                    <button type="button" onClick={addBook} className="flex w-full items-center justify-center gap-1.5 rounded-[8px] py-2.5 text-[13.5px] font-bold text-white transition hover:opacity-90" style={{ background: BROWN }}>
                      <Plus size={15} /> 추가
                    </button>
                  </div>
                ) : canEditBooks ? (
                  <p className="rounded-[10px] py-3 text-center text-[12.5px]" style={{ background: PANEL, color: SUB }}>최대 {MAX_BOOKS}개까지 추가할 수 있습니다.</p>
                ) : null}
              </div>
            </div>

            {/* 과목별 세부능력 특기사항(세특) — 학생별, 관리자·퍼실 작성 */}
            <div className={`order-2 rounded-[14px] bg-white ${vis("sete")}`} style={{ border: `1px solid ${CARD}` }}>
              <div className="flex items-center justify-between gap-2 border-b px-4 py-3" style={{ borderColor: CARD }}>
                <p className="flex items-center gap-1.5 text-[14px] font-bold" style={{ color: INK }}>
                  과목별 세부능력 특기사항(참고)
                  {!isStaff ? <span className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: MUTED }}><Lock size={11} /> 읽기 전용</span> : null}
                </p>
                {(() => {
                  const used = byteLen(editingSete ? seteDraft : sete);
                  const over = used > SETE_LIMIT;
                  return (
                    <span className="shrink-0 text-[11px]" style={{ color: over ? OVER_RED : MUTED }}>
                      <span className={over ? "font-bold" : ""}>{used}byte</span> / <b>{SETE_LIMIT}byte</b>
                    </span>
                  );
                })()}
              </div>
              <div className="px-4 py-4">
                {editingSete ? (
                  <textarea value={seteDraft} onChange={(e) => setSeteDraft(truncateToBytes(e.target.value, Math.floor(SETE_LIMIT * 1.1)))} rows={6} placeholder="이 학생의 과목별 세부능력 특기사항을 작성하세요." className="w-full resize-y rounded-[8px] border px-3 py-2 text-[13.5px] leading-7 outline-none focus:border-[#8C6E59]" style={{ borderColor: byteLen(seteDraft) > SETE_LIMIT ? OVER_RED : "#E7E2D6", color: BODY }} />
                ) : sete ? (
                  <p className="whitespace-pre-line text-[13.5px] leading-7" style={{ color: BODY }}>{sete}</p>
                ) : (
                  <p className="text-[13px]" style={{ color: SUB }}>{isStaff ? "이 학생의 세특을 작성하세요." : "아직 작성된 세특이 없습니다."}</p>
                )}
                {isStaff ? (
                  <div className="mt-3 flex justify-end gap-1.5">
                    {editingSete ? (
                      <>
                        <button type="button" onClick={() => void submitSete()} className="rounded-[6px] px-3 py-1.5 text-[12px] font-bold text-white transition hover:opacity-90" style={{ background: BROWN }}>저장</button>
                        <button type="button" onClick={cancelEditSete} className="rounded-[6px] border px-3 py-1.5 text-[12px] font-semibold" style={{ borderColor: LINE, color: SUB }}>취소</button>
                      </>
                    ) : (
                      <button type="button" onClick={startEditSete} className="inline-flex items-center gap-1 rounded-[6px] border px-3 py-1.5 text-[12px] font-bold" style={{ borderColor: BROWN, color: BROWN }}><Pencil size={12} /> 수정</button>
                    )}
                  </div>
                ) : null}
              </div>
            </div>


            {/* 1:1 멘토링 (실시간, 카카오톡식) */}
            <div className={`order-3 flex-col rounded-[14px] bg-white ${mobileSection === "chat" ? "flex xl:flex" : "hidden xl:flex"}`} style={{ border: `1px solid ${CARD}` }}>
              <div className="border-b px-4 py-3" style={{ borderColor: CARD }}>
                <p className="text-[14px] font-bold" style={{ color: INK }}>1:1 멘토링</p>
              </div>
              <div ref={chatScrollRef} className="flex max-h-[360px] min-h-[200px] flex-1 flex-col gap-2 overflow-y-auto px-4 py-4">
                {chat.length === 0 ? (
                  <p className="my-auto text-center text-[13px]" style={{ color: MUTED }}>메시지를 입력해 실시간 상담을 시작하세요.</p>
                ) : (
                  chat.map((m) => {
                    const mine = m.senderId === viewerId;
                    const editing = editingMsgId === m.id;
                    return (
                      <div key={m.id} className={`group flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div className="max-w-[82%]">
                          {!mine ? <p className="mb-0.5 text-[10px]" style={{ color: MUTED }}>{m.from === "teacher" ? "교사" : "학생"}</p> : null}
                          {editing ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                value={editMsgDraft}
                                onChange={(e) => setEditMsgDraft(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); void saveEditMsg(); }
                                  if (e.key === "Escape") setEditingMsgId(null);
                                }}
                                autoFocus
                                className="h-9 w-52 rounded-[8px] border px-2.5 text-[13px] outline-none focus:border-[#8C6E59]"
                                style={{ borderColor: BROWN, color: BODY }}
                              />
                              <button type="button" onClick={() => void saveEditMsg()} className="grid h-8 w-8 place-items-center rounded-[8px] text-white" style={{ background: BROWN }} aria-label="저장"><Check size={15} /></button>
                              <button type="button" onClick={() => setEditingMsgId(null)} className="grid h-8 w-8 place-items-center rounded-[8px]" style={{ color: MUTED }} aria-label="취소"><X size={15} /></button>
                            </div>
                          ) : (
                            <div className={`flex items-end gap-1 ${mine ? "flex-row-reverse" : ""}`}>
                              <div
                                className="rounded-[12px] px-3.5 py-2 text-[13px] leading-5"
                                style={m.deleted ? { background: "#F3F1EC", color: MUTED, fontStyle: "italic", border: `1px solid ${LINE}` } : mine ? { background: BROWN, color: "#fff" } : { background: PANEL, color: BODY, border: `1px solid ${LINE}` }}
                              >
                                {m.deleted ? (
                                  "삭제된 메시지입니다."
                                ) : m.kind === "file" && m.file ? (
                                  <ChatFileBubble url={fileUrl(m.id)} name={m.file.name} size={m.file.size} mime={m.fileMime} caption={m.text} mine={mine} />
                                ) : (
                                  m.text
                                )}
                              </div>
                              {!m.deleted && mine ? (
                                <div className="flex flex-col gap-0.5 opacity-0 transition group-hover:opacity-100">
                                  {m.kind === "text" ? (
                                    <button type="button" onClick={() => startEditMsg(m)} className="grid h-5 w-5 place-items-center rounded" style={{ color: MUTED }} aria-label="수정"><Pencil size={12} /></button>
                                  ) : null}
                                  <button type="button" onClick={() => void deleteMsg(m.id)} className="grid h-5 w-5 place-items-center rounded" style={{ color: MUTED }} aria-label="삭제"><Trash2 size={12} /></button>
                                </div>
                              ) : !m.deleted && isStaff && !mine ? (
                                <div className="flex flex-col gap-0.5 opacity-0 transition group-hover:opacity-100">
                                  <button type="button" onClick={() => void deleteMsg(m.id)} className="grid h-5 w-5 place-items-center rounded" style={{ color: MUTED }} aria-label="삭제"><Trash2 size={12} /></button>
                                </div>
                              ) : null}
                            </div>
                          )}
                          <p className={`mt-0.5 text-[10px] ${mine ? "text-right" : "text-left"}`} style={{ color: MUTED }}>
                            {m.at}{m.edited ? " · 수정됨" : ""}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              {canChat ? (
              <div className="flex items-center gap-2 border-t px-3 py-3" style={{ borderColor: CARD }}>
                <div className="relative">
                  <button type="button" onClick={() => setChatEmojiOpen((v) => !v)} className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] border transition hover:border-[#8C6E59]" style={{ borderColor: "#E7E2D6", color: BROWN }} aria-label="이모지"><Smile size={16} /></button>
                  {chatEmojiOpen ? <EmojiPicker onPick={(em) => setDraft((t) => t + em)} onClose={() => setChatEmojiOpen(false)} /> : null}
                </div>
                <input ref={chatFileInputRef} type="file" onChange={onChatFile} className="hidden" />
                <button
                  type="button"
                  onClick={() => chatFileInputRef.current?.click()}
                  disabled={uploadingChat}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] border transition hover:border-[#8C6E59] disabled:opacity-50"
                  style={{ borderColor: "#E7E2D6", color: BROWN }}
                  aria-label="파일 첨부"
                  title="사진·파일 첨부 (최대 20MB)"
                >
                  <Paperclip size={16} />
                </button>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  placeholder={uploadingChat ? "파일 업로드 중…" : "메시지 입력 후 Enter"}
                  className="h-10 flex-1 rounded-[8px] border px-3 text-[13px] outline-none focus:border-[#8C6E59]"
                  style={{ borderColor: "#E7E2D6", color: BODY }}
                />
                <button type="button" onClick={() => void send()} className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] text-white transition hover:opacity-90" style={{ background: BROWN }} aria-label="전송">
                  <Send size={16} />
                </button>
              </div>
              ) : (
                <div className="border-t px-4 py-3 text-center text-[12px]" style={{ borderColor: CARD, color: MUTED }}>열람 전용 — 메시지를 보낼 수 없습니다.</div>
              )}
              {chatFileError ? <p className="px-4 pb-3 text-[12px]" style={{ color: "#a6402c" }}>{chatFileError}</p> : null}
            </div>

            {/* 미니 드라이브 — 채팅에 업로드된 파일 모음 */}
            <div className={`order-4 rounded-[14px] bg-white ${vis("drive")}`} style={{ border: `1px solid ${CARD}` }}>
              <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: CARD }}>
                <p className="text-[14px] font-bold" style={{ color: INK }}>자료함</p>
                <span className="text-[12px]" style={{ color: MUTED }}>{driveFiles.length}개</span>
              </div>
              <div className="space-y-2 px-4 py-4">
                {driveFiles.length === 0 ? (
                  <p className="py-4 text-center text-[12.5px]" style={{ color: SUB }}>채팅에서 업로드한 사진·파일이 여기에 모입니다.</p>
                ) : (
                  driveFiles.map((m) => {
                    const isImg = (m.fileMime ?? "").startsWith("image/");
                    const mine = m.senderId === viewerId;
                    return (
                      <div key={m.id} className="flex items-center gap-2.5 rounded-[10px] border px-3 py-2.5" style={{ borderColor: "#E7E2D6", background: PANEL }}>
                        <a href={fileUrl(m.id)} target="_blank" rel="noreferrer" className="shrink-0" title="새 탭에서 보기">
                          {isImg ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={fileUrl(m.id)} alt={m.file!.name} className="h-10 w-10 rounded-[8px] object-cover" />
                          ) : (
                            <span className="grid h-10 w-10 place-items-center rounded-[8px] text-white" style={{ background: BROWN }}><FileText size={16} /></span>
                          )}
                        </a>
                        <a href={fileUrl(m.id)} target="_blank" rel="noreferrer" className="min-w-0 flex-1" title="새 탭에서 보기">
                          <span className="block truncate text-[13px] font-semibold hover:underline" style={{ color: DEEP }}>{m.file!.name}</span>
                          <span className="block text-[11px]" style={{ color: MUTED }}>{fmtSize(m.file!.size)} · {m.from === "teacher" ? "교사" : "학생"}</span>
                        </a>
                        <a href={`${fileUrl(m.id)}&download=1`} className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] hover:bg-[#F0EBE0]" style={{ color: BROWN }} aria-label="다운로드" title="다운로드"><Download size={15} /></a>
                        {mine || isStaff ? (
                          <button type="button" onClick={() => void deleteMsg(m.id)} className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] hover:bg-[#F0EBE0]" style={{ color: MUTED }} aria-label="삭제"><Trash2 size={15} /></button>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* 개별 공지 — 관리자가 학생에게 */}
            <div className={`order-1 rounded-[14px] bg-white ${vis("notice")}`} style={{ border: `1px solid ${CARD}` }}>
              <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: CARD }}>
                <p className="flex items-center gap-1.5 text-[14px] font-bold" style={{ color: INK }}>
                  <Megaphone size={14} style={{ color: BROWN }} /> 개별 공지
                  {!canPostNotice ? <span className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: MUTED }}><Lock size={11} /> 담당자 전용</span> : null}
                </p>
                <span className="text-[12px]" style={{ color: MUTED }}>{notices.length}개</span>
              </div>
              <div className="space-y-3 px-4 py-4">
                {canPostNotice ? (
                  <div className="space-y-2 rounded-[10px] p-3" style={{ border: `1px dashed ${LINE}` }}>
                    <textarea
                      value={noticeDraft}
                      onChange={(e) => setNoticeDraft(e.target.value)}
                      rows={2}
                      placeholder="이 학생에게 띄울 공지를 입력하세요."
                      className="w-full resize-y rounded-[8px] border px-3 py-2 text-[13px] leading-6 outline-none focus:border-[#8C6E59]"
                      style={{ borderColor: "#E7E2D6", color: BODY }}
                    />
                    <button type="button" onClick={() => void postNotice()} className="flex w-full items-center justify-center gap-1.5 rounded-[8px] py-2.5 text-[13.5px] font-bold text-white transition hover:opacity-90" style={{ background: BROWN }}>
                      <Plus size={15} /> 공지 등록
                    </button>
                  </div>
                ) : null}

                {notices.length === 0 ? (
                  <p className="py-3 text-center text-[12.5px]" style={{ color: SUB }}>{canPostNotice ? "등록된 공지가 없습니다." : "담당자가 등록한 공지가 없습니다."}</p>
                ) : (
                  notices.map((n) =>
                    editingNoticeId === n.id ? (
                      <div key={n.id} className="space-y-2 rounded-[10px] p-3" style={{ border: `1px solid ${BROWN}` }}>
                        <textarea value={noticeEditDraft} onChange={(e) => setNoticeEditDraft(e.target.value)} rows={2} className="w-full resize-y rounded-[8px] border px-3 py-2 text-[13px] leading-6 outline-none focus:border-[#8C6E59]" style={{ borderColor: "#E7E2D6", color: BODY }} />
                        <div className="flex gap-2">
                          <button type="button" onClick={() => void saveEditNotice()} className="flex-1 rounded-[8px] py-2 text-[13px] font-bold text-white" style={{ background: BROWN }}>저장</button>
                          <button type="button" onClick={() => setEditingNoticeId(null)} className="rounded-[8px] border px-3 py-2 text-[13px] font-semibold" style={{ borderColor: LINE, color: SUB }}>취소</button>
                        </div>
                      </div>
                    ) : (
                      <div key={n.id} className="rounded-[10px] p-3" style={{ background: "#FBF6EC", border: `1px solid ${LINE}` }}>
                        <div className="flex items-start justify-between gap-2">
                          <p className="whitespace-pre-line text-[13px] leading-6" style={{ color: BODY }}>{n.body}</p>
                          {canPostNotice ? (
                            <div className="flex shrink-0 items-center gap-1.5">
                              <button type="button" onClick={() => startEditNotice(n)} aria-label="수정" style={{ color: MUTED }}><Pencil size={13} /></button>
                              <button type="button" onClick={() => void deleteNotice(n.id)} aria-label="삭제" style={{ color: MUTED }}><Trash2 size={14} /></button>
                            </div>
                          ) : null}
                        </div>
                        <p className="mt-1.5 text-[10.5px]" style={{ color: MUTED }}>{n.at}{n.updated ? " · 수정됨" : ""}</p>
                      </div>
                    )
                  )
                )}
              </div>
            </div>

            {/* 과제 업로드 — 학생 제출(PDF·동영상) */}
            <div className={`order-6 rounded-[14px] bg-white ${vis("assignment")}`} style={{ border: `1px solid ${CARD}` }}>
              <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: CARD }}>
                <p className="flex items-center gap-1.5 text-[14px] font-bold" style={{ color: INK }}>
                  <Upload size={14} style={{ color: BROWN }} /> 과제 업로드
                </p>
                <span className="text-[12px]" style={{ color: MUTED }}>{assignments.filter((a) => a.column >= 0 && a.column <= 4).length} / {ASSIGN_SLOTS.length}</span>
              </div>
              <div className="space-y-3 px-4 py-4">
                {ASSIGN_SLOTS.map((col) => {
                  const a = assignments.find((x) => x.column === col);
                  const uploadingHere = isStudent && assignPct !== null && uploadCol === col;
                  const isVid = a ? (a.mime || "").startsWith("video/") : false;
                  const url = a ? `/api/courses/${courseId}/mentoring/assignment/${a.id}` : "";
                  const openHref = a ? assignmentOpenHref(courseId, a.id, a.name) : "";
                  return (
                    <div key={col}>
                      <p className="mb-1.5 text-[12.5px] font-bold" style={{ color: DEEP }}>과제{col + 1}</p>
                      {uploadingHere ? (
                        <div className="rounded-[10px] border px-3 py-3" style={{ borderColor: LINE }}>
                          <p className="mb-1.5 text-[12.5px] font-semibold" style={{ color: DEEP }}>업로드 중… {assignPct}% (닫지 마세요)</p>
                          <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "#EDE7DA" }}>
                            <div className="h-full rounded-full transition-all" style={{ width: `${assignPct}%`, background: BROWN }} />
                          </div>
                        </div>
                      ) : a ? (
                        <div className="flex items-center gap-2 rounded-[10px] border px-3 py-2.5" style={{ borderColor: "#E7E2D6", background: PANEL }}>
                          <a href={openHref} target="_blank" rel="noreferrer" className="min-w-0 flex-1" title="열기">
                            <span className="block truncate text-[13px] font-semibold hover:underline" style={{ color: DEEP }}>{a.name}</span>
                            <span className="text-[11px]" style={{ color: MUTED }}>{a.at} · {fmtSize(a.size)} · {isVid ? "동영상" : "PDF"}</span>
                          </a>
                          <a href={`${url}?download=1`} className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] hover:bg-[#F0EBE0]" style={{ color: BROWN }} aria-label="다운로드"><Download size={15} /></a>
                          {isStudent || isStaff ? (
                            <button type="button" onClick={() => void removeAssignment(a.id)} className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] hover:bg-[#F0EBE0]" style={{ color: MUTED }} aria-label="삭제"><Trash2 size={15} /></button>
                          ) : null}
                        </div>
                      ) : isStudent ? (
                        <button
                          type="button"
                          onClick={() => triggerAssignUpload(col)}
                          disabled={assignPct !== null}
                          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-dashed py-3.5 text-[13px] transition hover:border-[#8C6E59] disabled:opacity-50"
                          style={{ borderColor: LINE, color: SUB }}
                        >
                          <Upload size={15} /> 과제 파일 추가
                        </button>
                      ) : (
                        <p className="rounded-[10px] border border-dashed py-3 text-center text-[12px]" style={{ borderColor: LINE, color: MUTED }}>미제출</p>
                      )}
                    </div>
                  );
                })}

                {isStudent ? (
                  <>
                    <input ref={assignInputRef} type="file" accept={ASSIGN_ACCEPT} onChange={onAssignmentFile} className="hidden" />
                    <p className="text-[11px] leading-5" style={{ color: MUTED }}>PDF, 동영상 파일만 업로드할 수 있습니다. (최대 2GB)</p>
                    <p className="mt-0.5 text-[11px] leading-5" style={{ color: MUTED }}>업로드 가능한 동영상 : {VIDEO_LABEL}</p>
                  </>
                ) : null}
                {assignErr ? <p className="text-[12px]" style={{ color: "#a6402c" }}>{assignErr}</p> : null}
              </div>
            </div>
          </aside>
          </div>
        </>
        )}
      </main>
    </div>
  );
}

function ChatFileBubble({ url, name, size, mime, caption, mine }: { url: string; name: string; size: number; mime: string | null; caption: string; mine: boolean }) {
  const isImg = (mime ?? "").startsWith("image/");
  return (
    <div className="space-y-1.5">
      {isImg ? (
        <a href={url} target="_blank" rel="noreferrer" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={name} className="max-h-52 max-w-full rounded-[8px] object-cover" />
        </a>
      ) : (
        <div className="flex items-center gap-2 rounded-[8px] px-1 py-0.5" style={{ color: mine ? "#fff" : DEEP }}>
          <FileText size={16} className="shrink-0" />
          <a href={url} target="_blank" rel="noreferrer" className="min-w-0" title="새 탭에서 보기">
            <span className="block max-w-[160px] truncate text-[12.5px] font-semibold underline">{name}</span>
            <span className="text-[10.5px] opacity-80">{fmtSize(size)}</span>
          </a>
          <a href={`${url}&download=1`} className="shrink-0 opacity-90 hover:opacity-100" aria-label="다운로드" title="다운로드"><Download size={14} /></a>
        </div>
      )}
      {caption ? <p className="text-[12.5px] leading-5">{caption}</p> : null}
    </div>
  );
}

function BookInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-bold" style={{ color: INK }}>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-full rounded-[8px] border px-2.5 text-[13px] outline-none focus:border-[#8C6E59]" style={{ borderColor: "#E7E2D6", color: BODY }} />
    </label>
  );
}
function BookArea({ label, value, onChange, limit }: { label: string; value: string; onChange: (v: string) => void; limit?: number }) {
  const used = byteLen(value);
  const over = limit != null && used > limit;
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between">
        <span className="text-[12px] font-bold" style={{ color: INK }}>{label}</span>
        {limit != null ? (
          <span className="text-[10.5px]" style={{ color: over ? OVER_RED : MUTED }}>
            <span className={over ? "font-bold" : ""}>{used}byte</span> / <b>{limit}byte</b>
          </span>
        ) : null}
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(limit != null ? truncateToBytes(e.target.value, Math.floor(limit * 1.1)) : e.target.value)}
        rows={2}
        className="w-full resize-y rounded-[8px] border px-2.5 py-2 text-[13px] leading-6 outline-none focus:border-[#8C6E59]"
        style={{ borderColor: over ? OVER_RED : "#E7E2D6", color: BODY }}
      />
    </label>
  );
}

/** 독서활동상황 읽기뷰 필드 — 입력폼과 동일하게 풀네임 라벨 + 바이트/제한 표기. */
function BookReadField({ label, value, limit }: { label: string; value: string; limit: number }) {
  const used = byteLen(value);
  const over = used > limit;
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-bold" style={{ color: DEEP }}>{label}</p>
        <span className="text-[10.5px]" style={{ color: over ? OVER_RED : MUTED }}>
          <span className={over ? "font-bold" : ""}>{used}byte</span> / <b>{limit}byte</b>
        </span>
      </div>
      <p className="mt-0.5 whitespace-pre-line text-[12.5px] leading-6" style={{ color: BODY }}>{value}</p>
    </div>
  );
}

/** 성취기준 선택 — 관리자가 등록한 목록에서 중복 선택(최대 5, 안내 문구 없음). */
function StandardField({ value, onChange, standards, readOnly }: { value: string; onChange: (v: string) => void; standards: StdItem[]; readOnly: boolean }) {
  const [open, setOpen] = useState(false);
  const selected = parseStandards(value);
  const sameAs = (a: { code: string; content: string }, b: { code: string; content: string }) => a.content === b.content && a.code === b.code;
  const isSel = (s: StdItem) => selected.some((x) => sameAs(x, { code: s.code ?? "", content: s.content }));
  const commit = (next: { code: string; content: string }[]) => onChange(next.length ? JSON.stringify(next) : "");
  const toggle = (s: StdItem) => {
    const item = { code: s.code ?? "", content: s.content };
    if (isSel(s)) commit(selected.filter((x) => !sameAs(x, item)));
    else {
      if (selected.length >= 5) return; // 최대 5개(안내 없이 조용히 제한)
      commit([...selected, item]);
    }
  };
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-[13.5px] font-bold" style={{ color: INK }}>성취기준</label>
        {!readOnly ? (
          <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-[12px] font-semibold" style={{ color: BROWN }}>
            <Plus size={13} /> 성취기준 선택
          </button>
        ) : null}
      </div>
      {selected.length ? (
        <ul className="space-y-1.5">
          {selected.map((s, i) => (
            <li key={i} className="flex items-start justify-between gap-2 rounded-[10px] border px-3 py-2 text-[13px]" style={{ borderColor: "#E7E2D6", background: "#fff" }}>
              <span className="min-w-0 leading-6">
                {s.code ? <b style={{ color: BROWN }}>{s.code}</b> : null} <span style={{ color: BODY }}>{s.content}</span>
              </span>
              {!readOnly ? <button type="button" onClick={() => commit(selected.filter((x) => !sameAs(x, s)))} aria-label="삭제" className="mt-0.5 shrink-0" style={{ color: MUTED }}><X size={14} /></button> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-[10px] border px-3 py-2.5 text-[13px]" style={{ borderColor: "#E7E2D6", color: SUB, background: "#fff" }}>
          {readOnly ? "선택된 성취기준이 없습니다." : "‘성취기준 선택’을 눌러 해당하는 성취기준을 고르세요."}
        </p>
      )}

      {open ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="flex max-h-[82vh] w-full max-w-lg flex-col overflow-hidden rounded-[14px] bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: CARD }}>
              <p className="text-[15px] font-bold" style={{ color: INK }}>성취기준 선택</p>
              <button type="button" onClick={() => setOpen(false)} style={{ color: MUTED }}><X size={18} /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {standards.length === 0 ? (
                <p className="py-10 text-center text-[13px]" style={{ color: SUB }}>아직 등록된 성취기준이 없습니다.</p>
              ) : (
                <ul className="space-y-1.5">
                  {standards.map((s, i) => {
                    const on = isSel(s);
                    const disabled = !on && selected.length >= 5;
                    return (
                      <li key={s.id ?? i}>
                        <label className="flex cursor-pointer items-start gap-2.5 rounded-[10px] border px-3 py-2.5" style={{ borderColor: on ? BROWN : "#E7E2D6", background: on ? "#FBF6EC" : "#fff", opacity: disabled ? 0.4 : 1 }}>
                          <input type="checkbox" checked={on} disabled={disabled} onChange={() => toggle(s)} className="mt-1 h-4 w-4 shrink-0 accent-[#8C6E59]" />
                          <span className="min-w-0 text-[13px] leading-6">
                            {s.code ? <b style={{ color: BROWN }}>{s.code}</b> : null} <span style={{ color: BODY }}>{s.content}</span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="flex items-center justify-end border-t px-4 py-3" style={{ borderColor: CARD }}>
              <button type="button" onClick={() => setOpen(false)} className="rounded-[9px] px-5 py-2 text-[13px] font-bold text-white" style={{ background: BROWN }}>완료</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
