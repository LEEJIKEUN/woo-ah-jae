"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Lock, Send, ChevronLeft, Plus, X, Upload, FileText, Download, Pencil, Paperclip, Trash2, Megaphone, Check } from "lucide-react";
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

type Report = Record<FieldKey, string>;
type FileMeta = { name: string; size: number };
type ChatMsg = { id: string; from: "teacher" | "student"; senderId: string; text: string; at: string; edited: boolean; deleted: boolean; kind: "text" | "file"; file: FileMeta | null; fileMime: string | null };
type Book = { book: string; author: string; motive: string; review: string; influence: string };
type Notice = { id: string; body: string; at: string; updated: boolean };
type Assignment = { id: string; name: string; size: number; mime: string; at: string };
type Room = { report: Report; reportFile: FileMeta | null; books: Book[]; chat: ChatMsg[]; notices: Notice[]; assignments: Assignment[]; sete: string };
const BLANK_BOOK: Book = { book: "", author: "", motive: "", review: "", influence: "" };
function blankReport(): Report {
  return { topic: "", motive: "", process: "", result: "", difficulty: "", overcome: "", learned: "", standard: "", references: "" };
}

const SEED_GUIDE =
  "탐구의 동기 → 과정 → 결과를 인과적으로 연결하고, 사용한 개념·이론과 그것을 적용한 방법을 구체적으로 서술하세요. 수치·데이터로 성과를 제시하고, 배운 점과 진로·후속 탐구로의 확장을 담으면 좋습니다.";

const MAX_BOOKS = 5;
const MAX_FILE_BYTES = 6 * 1024 * 1024;

function byteLen(s: string) {
  try {
    return new TextEncoder().encode(s).length;
  } catch {
    return s.length;
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
  const [report, setReport] = useState<Report>(blankReport());
  const [reportFile, setReportFile] = useState<FileMeta | null>(null);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignErr, setAssignErr] = useState<string | null>(null);
  const [assignPct, setAssignPct] = useState<number | null>(null);
  const assignInputRef = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);
  const [bookDraft, setBookDraft] = useState<Book>(BLANK_BOOK);
  const [editBookIdx, setEditBookIdx] = useState<number | null>(null);
  const [editBook, setEditBook] = useState<Book>(BLANK_BOOK);
  const [fileError, setFileError] = useState<string | null>(null);
  const [chatFileError, setChatFileError] = useState<string | null>(null);
  const [uploadingChat, setUploadingChat] = useState(false);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editMsgDraft, setEditMsgDraft] = useState("");
  const [sete, setSete] = useState("");
  const [editingSete, setEditingSete] = useState(false);
  const [seteDraft, setSeteDraft] = useState("");
  const [guide, setGuide] = useState<string>(SEED_GUIDE);
  const [editingGuide, setEditingGuide] = useState(false);
  const [guideDraft, setGuideDraft] = useState("");
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
    setChat([]);
    setBooks([]);
    setNotices([]);
    setAssignments([]);
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

  // 작성 가이드(강좌 공통) 로드
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/courses/${courseId}/mentoring-guide`, { cache: "no-store" });
        if (!res.ok || !alive) return;
        const d = (await res.json()) as { body?: string };
        if (alive && typeof d.body === "string") setGuide(d.body);
      } catch {
        /* 무시 */
      }
    })();
    return () => {
      alive = false;
    };
  }, [courseId]);

  function startEditGuide() {
    setGuideDraft(guide);
    setEditingGuide(true);
  }
  async function saveGuide() {
    try {
      const res = await fetch(`/api/courses/${courseId}/mentoring-guide`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: guideDraft }),
      });
      if (res.ok) {
        const d = (await res.json()) as { body?: string };
        setGuide(typeof d.body === "string" ? d.body : guideDraft);
        setEditingGuide(false);
      }
    } catch {
      /* 무시 */
    }
  }

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
    try {
      const dataUrl = await readAsDataUrl(f);
      const res = await postRoom(courseId, studentId, { action: "reportFile", file: { name: f.name, size: f.size, mime: f.type, dataUrl } });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setFileError(d.error ?? "업로드에 실패했습니다.");
      }
    } catch {
      setFileError("업로드 중 오류가 발생했습니다.");
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
  async function onAssignmentFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const isPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
    const isVideo = f.type.startsWith("video/");
    if (!isPdf && !isVideo) {
      setAssignErr("PDF 또는 동영상 파일만 업로드할 수 있습니다.");
      return;
    }
    setAssignErr(null);
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
      await postRoom(courseId, studentId, { action: "assignmentAdd", name: f.name, size: f.size, mime: f.type, key });
    } catch (e2) {
      setAssignErr(e2 instanceof Error ? e2.message : "업로드에 실패했습니다.");
    } finally {
      setAssignPct(null);
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
            <span className="rounded-full px-3 py-1 text-[12px] font-semibold" style={{ background: PANEL, color: DEEP, border: `1px solid ${LINE}` }}>
              {isParent ? "학부모 · 열람 전용" : role === "teacher" ? "교사(관리자) · 보고서 열람 + 채팅" : "학생으로 접속"} · 실시간 공유
            </span>
          </div>
        </div>

        {noStudent ? (
          <div className="rounded-[14px] border p-10 text-center text-[14px]" style={{ borderColor: CARD, color: SUB }}>
            {isParent ? "연결된 자녀가 이 강좌를 수강하고 있지 않습니다." : "수강 중인 학생이 없습니다. 학생이 수강신청하면 학생을 선택해 멘토링을 진행할 수 있습니다."}
          </div>
        ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          {/* 중: 학생 탐구 보고서 */}
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
              {FIELDS.map((f) => (
                <div key={f.key}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="text-[13.5px] font-bold" style={{ color: INK }}>{f.label}</label>
                    <span className="text-[11px]" style={{ color: MUTED }}>{byteLen(report[f.key])} byte</span>
                  </div>
                  <textarea
                    value={report[f.key]}
                    onChange={(e) => setField(f.key, e.target.value)}
                    rows={f.rows}
                    readOnly={!canEditReport}
                    placeholder={!canEditReport ? "" : `${f.label}을(를) 입력하세요.`}
                    className="w-full resize-y rounded-[10px] border px-3.5 py-2.5 text-[14px] leading-7 outline-none focus:border-[#8C6E59]"
                    style={{ borderColor: "#E7E2D6", color: BODY, background: "#fff" }}
                  />
                </div>
              ))}

              {/* 보고서 파일 (PDF) 업로드 */}
              <div>
                <label className="mb-1.5 block text-[13.5px] font-bold" style={{ color: INK }}>보고서 파일 (PDF)</label>
                {reportFile ? (
                  <div className="flex items-center justify-between gap-2 rounded-[10px] border px-3.5 py-3" style={{ borderColor: "#E7E2D6", background: PANEL }}>
                    <a href={fileUrl("report")} download={reportFile.name} className="flex min-w-0 items-center gap-2.5 text-left" title="클릭하면 다운로드됩니다">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] text-white" style={{ background: BROWN }}><FileText size={16} /></span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13.5px] font-semibold hover:underline" style={{ color: DEEP }}>{reportFile.name}</span>
                        <span className="text-[11px]" style={{ color: MUTED }}>{fmtSize(reportFile.size)} · 클릭하여 다운로드</span>
                      </span>
                    </a>
                    <div className="flex shrink-0 items-center gap-1">
                      <a href={fileUrl("report")} download={reportFile.name} className="grid h-8 w-8 place-items-center rounded-[8px] hover:bg-[#F0EBE0]" style={{ color: BROWN }} aria-label="다운로드"><Download size={16} /></a>
                      {canUploadFile ? <button type="button" onClick={removeReportFile} className="grid h-8 w-8 place-items-center rounded-[8px] hover:bg-[#F0EBE0]" style={{ color: MUTED }} aria-label="삭제"><X size={16} /></button> : null}
                    </div>
                  </div>
                ) : canUploadFile ? (
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-dashed py-4 text-[13.5px] transition hover:border-[#8C6E59]" style={{ borderColor: LINE, color: SUB }}>
                    <Upload size={16} /> PDF 파일 업로드 (최대 6MB)
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

          {/* 우: 독서활동상황 → 작성 가이드 → 1:1 멘토링 → 미니 드라이브 → 개별 공지 */}
          <aside className="space-y-4">
            {/* 독서활동상황 */}
            <div className="rounded-[14px] bg-white" style={{ border: `1px solid ${CARD}` }}>
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
                      <BookArea label="읽게 된 동기" value={editBook.motive} onChange={(v) => setEditBook((p) => ({ ...p, motive: v }))} />
                      <BookArea label="책에 대한 평가" value={editBook.review} onChange={(v) => setEditBook((p) => ({ ...p, review: v }))} />
                      <BookArea label="자신에게 준 영향" value={editBook.influence} onChange={(v) => setEditBook((p) => ({ ...p, influence: v }))} />
                      <div className="flex gap-2">
                        <button type="button" onClick={saveEditBook} className="flex-1 rounded-[8px] py-2 text-[13px] font-bold text-white transition hover:opacity-90" style={{ background: BROWN }}>저장</button>
                        <button type="button" onClick={cancelEditBook} className="rounded-[8px] border px-3 py-2 text-[13px] font-semibold" style={{ borderColor: LINE, color: SUB }}>취소</button>
                      </div>
                    </div>
                  ) : (
                    <div key={i} className="rounded-[10px] p-3" style={{ background: PANEL, border: `1px solid ${LINE}` }}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[13.5px] font-bold" style={{ color: INK }}>
                          {b.book || "(제목 없음)"}
                          {b.author ? <span className="font-normal" style={{ color: SUB }}>({b.author})</span> : null}
                        </p>
                        {canEditBooks ? (
                          <div className="flex shrink-0 items-center gap-1.5">
                            <button type="button" onClick={() => startEditBook(i)} aria-label="수정" style={{ color: MUTED }}><Pencil size={13} /></button>
                            <button type="button" onClick={() => removeBook(i)} aria-label="삭제" style={{ color: MUTED }}><X size={15} /></button>
                          </div>
                        ) : null}
                      </div>
                      {b.motive ? <p className="mt-1.5 text-[12.5px] leading-5" style={{ color: BODY }}><b style={{ color: DEEP }}>동기</b> {b.motive}</p> : null}
                      {b.review ? <p className="mt-1 text-[12.5px] leading-5" style={{ color: BODY }}><b style={{ color: DEEP }}>평가</b> {b.review}</p> : null}
                      {b.influence ? <p className="mt-1 text-[12.5px] leading-5" style={{ color: BODY }}><b style={{ color: DEEP }}>영향</b> {b.influence}</p> : null}
                    </div>
                  )
                )}

                {canEditBooks && books.length < MAX_BOOKS ? (
                  <div className="space-y-2 rounded-[10px] p-3" style={{ border: `1px dashed ${LINE}` }}>
                    <div className="grid grid-cols-2 gap-2">
                      <BookInput label="책" value={bookDraft.book} onChange={(v) => setBookDraft((p) => ({ ...p, book: v }))} />
                      <BookInput label="저자" value={bookDraft.author} onChange={(v) => setBookDraft((p) => ({ ...p, author: v }))} />
                    </div>
                    <BookArea label="읽게 된 동기" value={bookDraft.motive} onChange={(v) => setBookDraft((p) => ({ ...p, motive: v }))} />
                    <BookArea label="책에 대한 평가" value={bookDraft.review} onChange={(v) => setBookDraft((p) => ({ ...p, review: v }))} />
                    <BookArea label="자신에게 준 영향" value={bookDraft.influence} onChange={(v) => setBookDraft((p) => ({ ...p, influence: v }))} />
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
            <div className="rounded-[14px] bg-white" style={{ border: `1px solid ${CARD}` }}>
              <div className="flex items-center justify-between gap-2 border-b px-4 py-3" style={{ borderColor: CARD }}>
                <p className="flex items-center gap-1.5 text-[14px] font-bold" style={{ color: INK }}>
                  과목별 세부능력 특기사항
                  {!isStaff ? <span className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: MUTED }}><Lock size={11} /> 읽기 전용</span> : null}
                </p>
                <span className="shrink-0 text-[11px]" style={{ color: MUTED }}>{byteLen(editingSete ? seteDraft : sete)} byte</span>
              </div>
              <div className="px-4 py-4">
                {editingSete ? (
                  <textarea value={seteDraft} onChange={(e) => setSeteDraft(e.target.value)} rows={6} placeholder="이 학생의 과목별 세부능력 특기사항을 작성하세요." className="w-full resize-y rounded-[8px] border px-3 py-2 text-[13.5px] leading-7 outline-none focus:border-[#8C6E59]" style={{ borderColor: "#E7E2D6", color: BODY }} />
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

            {/* 과목별 세부능력 특기사항 작성 가이드 */}
            <div className="rounded-[14px] bg-white" style={{ border: `1px solid ${CARD}` }}>
              <div className="flex items-center justify-between gap-2 border-b px-4 py-3" style={{ borderColor: CARD }}>
                <p className="flex items-center gap-1.5 text-[14px] font-bold" style={{ color: INK }}>
                  과목별 세부능력 특기사항 작성 가이드
                  {!isStaff ? <span className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: MUTED }}><Lock size={11} /> 읽기 전용</span> : null}
                </p>
                <span className="shrink-0 text-[11px]" style={{ color: MUTED }}>{byteLen(editingGuide ? guideDraft : guide)} byte</span>
              </div>
              <div className="px-4 py-4">
                {editingGuide ? (
                  <textarea value={guideDraft} onChange={(e) => setGuideDraft(e.target.value)} rows={7} className="w-full resize-y rounded-[8px] border px-3 py-2 text-[13.5px] leading-7 outline-none focus:border-[#8C6E59]" style={{ borderColor: "#E7E2D6", color: BODY }} />
                ) : (
                  <p className="whitespace-pre-line text-[13.5px] leading-7" style={{ color: BODY }}>{guide}</p>
                )}
                {isStaff ? (
                  <div className="mt-3 flex justify-end gap-1.5">
                    {editingGuide ? (
                      <>
                        <button type="button" onClick={saveGuide} className="rounded-[6px] px-3 py-1.5 text-[12px] font-bold text-white transition hover:opacity-90" style={{ background: BROWN }}>저장</button>
                        <button type="button" onClick={() => setEditingGuide(false)} className="rounded-[6px] border px-3 py-1.5 text-[12px] font-semibold" style={{ borderColor: LINE, color: SUB }}>취소</button>
                      </>
                    ) : (
                      <button type="button" onClick={startEditGuide} className="inline-flex items-center gap-1 rounded-[6px] border px-3 py-1.5 text-[12px] font-bold" style={{ borderColor: BROWN, color: BROWN }}><Pencil size={12} /> 수정</button>
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            {/* 1:1 멘토링 (실시간, 카카오톡식) */}
            <div className="flex flex-col rounded-[14px] bg-white" style={{ border: `1px solid ${CARD}` }}>
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
                <input ref={chatFileInputRef} type="file" onChange={onChatFile} className="hidden" />
                <button
                  type="button"
                  onClick={() => chatFileInputRef.current?.click()}
                  disabled={uploadingChat}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] border transition hover:border-[#8C6E59] disabled:opacity-50"
                  style={{ borderColor: "#E7E2D6", color: BROWN }}
                  aria-label="파일 첨부"
                  title="사진·파일 첨부 (최대 6MB)"
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
            <div className="rounded-[14px] bg-white" style={{ border: `1px solid ${CARD}` }}>
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
                        {isImg ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={fileUrl(m.id)} alt={m.file!.name} className="h-10 w-10 shrink-0 rounded-[8px] object-cover" />
                        ) : (
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] text-white" style={{ background: BROWN }}><FileText size={16} /></span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold" style={{ color: DEEP }}>{m.file!.name}</p>
                          <p className="text-[11px]" style={{ color: MUTED }}>{fmtSize(m.file!.size)} · {m.from === "teacher" ? "교사" : "학생"}</p>
                        </div>
                        <a href={fileUrl(m.id)} download={m.file!.name} className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] hover:bg-[#F0EBE0]" style={{ color: BROWN }} aria-label="다운로드"><Download size={15} /></a>
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
            <div className="rounded-[14px] bg-white" style={{ border: `1px solid ${CARD}` }}>
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
            <div className="rounded-[14px] bg-white" style={{ border: `1px solid ${CARD}` }}>
              <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: CARD }}>
                <p className="flex items-center gap-1.5 text-[14px] font-bold" style={{ color: INK }}>
                  <Upload size={14} style={{ color: BROWN }} /> 과제 업로드
                </p>
                <span className="text-[12px]" style={{ color: MUTED }}>{assignments.length}개</span>
              </div>
              <div className="space-y-2 px-4 py-4">
                {assignments.length === 0 ? (
                  <p className="py-3 text-center text-[12.5px]" style={{ color: SUB }}>{isStudent ? "제출한 과제가 없습니다." : "제출된 과제가 없습니다."}</p>
                ) : (
                  <ol className="space-y-2">
                    {assignments.map((a, i) => {
                      const isVid = (a.mime || "").startsWith("video/");
                      const url = `/api/courses/${courseId}/mentoring/assignment/${a.id}`;
                      return (
                        <li key={a.id} className="flex items-center gap-2 rounded-[10px] border px-3 py-2.5" style={{ borderColor: "#E7E2D6", background: PANEL }}>
                          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold" style={{ background: CARD, color: BROWN }}>{i + 1}</span>
                          <a href={url} target="_blank" rel="noreferrer" className="min-w-0 flex-1" title="열기">
                            <span className="block truncate text-[13px] font-semibold hover:underline" style={{ color: DEEP }}>{a.name}</span>
                            <span className="text-[11px]" style={{ color: MUTED }}>{a.at} · {fmtSize(a.size)} · {isVid ? "동영상" : "PDF"}</span>
                          </a>
                          <a href={`${url}?download=1`} className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] hover:bg-[#F0EBE0]" style={{ color: BROWN }} aria-label="다운로드"><Download size={15} /></a>
                          {isStudent || isStaff ? (
                            <button type="button" onClick={() => void removeAssignment(a.id)} className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] hover:bg-[#F0EBE0]" style={{ color: MUTED }} aria-label="삭제"><Trash2 size={15} /></button>
                          ) : null}
                        </li>
                      );
                    })}
                  </ol>
                )}

                {isStudent ? (
                  assignPct !== null ? (
                    <div className="rounded-[10px] border px-3 py-3" style={{ borderColor: LINE }}>
                      <p className="mb-1.5 text-[12.5px] font-semibold" style={{ color: DEEP }}>업로드 중… {assignPct}% (닫지 마세요)</p>
                      <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "#EDE7DA" }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${assignPct}%`, background: BROWN }} />
                      </div>
                    </div>
                  ) : (
                    <>
                      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-dashed py-3.5 text-[13px] transition hover:border-[#8C6E59]" style={{ borderColor: LINE, color: SUB }}>
                        <Upload size={15} /> 과제 파일 추가
                        <input ref={assignInputRef} type="file" accept="application/pdf,.pdf,video/*" onChange={onAssignmentFile} className="hidden" />
                      </label>
                      <p className="text-[11px] leading-5" style={{ color: MUTED }}>PDF·동영상 파일만 업로드할 수 있습니다. 동영상은 10분 이내 줌 화면 녹화 파일을 권장합니다. (최대 2GB)</p>
                    </>
                  )
                ) : null}
                {assignErr ? <p className="text-[12px]" style={{ color: "#a6402c" }}>{assignErr}</p> : null}
              </div>
            </div>
          </aside>
        </div>
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
        <a href={url} download={name} className="flex items-center gap-2 rounded-[8px] px-1 py-0.5" style={{ color: mine ? "#fff" : DEEP }}>
          <FileText size={16} />
          <span className="min-w-0">
            <span className="block max-w-[180px] truncate text-[12.5px] font-semibold underline">{name}</span>
            <span className="text-[10.5px] opacity-80">{fmtSize(size)}</span>
          </span>
          <Download size={14} />
        </a>
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
function BookArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-bold" style={{ color: INK }}>{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} className="w-full resize-y rounded-[8px] border px-2.5 py-2 text-[13px] leading-6 outline-none focus:border-[#8C6E59]" style={{ borderColor: "#E7E2D6", color: BODY }} />
    </label>
  );
}
