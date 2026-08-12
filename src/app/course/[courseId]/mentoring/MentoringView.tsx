"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Lock, Send, ChevronLeft, Plus, X, Upload, FileText, Download, Pencil } from "lucide-react";
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
type ChatMsg = { from: "teacher" | "student"; text: string; at: string };
type Book = { book: string; author: string; motive: string; review: string; influence: string };
type Room = { report: Report; chat: ChatMsg[]; books: Book[]; file: { name: string; size: number } | null };
type ReportFile = { name: string; size: number; dataUrl: string };
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
async function postRoom(courseId: string, studentId: string, payload: object) {
  await fetch(`/api/courses/${courseId}/mentoring`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, studentId }),
  });
}

export default function MentoringView({
  courseId,
  role,
  isStaff = false,
  isParent = false,
  isStudent = false,
  students = [],
  initialStudentId = "",
}: {
  courseId: string;
  role: "teacher" | "student";
  isStaff?: boolean;
  isParent?: boolean;
  isStudent?: boolean;
  students?: { id: string; name: string }[];
  initialStudentId?: string;
}) {
  // 권한: 보고서·독서·파일 = 학생만 / 채팅 = 학생+스태프 / 학부모 = 열람 전용(파일 다운로드는 가능)
  const canEditReport = isStudent;
  const canEditBooks = isStudent;
  const canUploadFile = isStudent;
  const canChat = isStudent || isStaff;
  const showSelector = (isStaff || isParent) && students.length > 0;
  const noStudent = (isStaff || isParent) && !initialStudentId;

  const [studentId, setStudentId] = useState(initialStudentId);
  const [report, setReport] = useState<Report>(blankReport());
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [draft, setDraft] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);
  const [bookDraft, setBookDraft] = useState<Book>(BLANK_BOOK);
  const [editBookIdx, setEditBookIdx] = useState<number | null>(null);
  const [editBook, setEditBook] = useState<Book>(BLANK_BOOK);
  const [reportFile, setReportFile] = useState<ReportFile | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [guide, setGuide] = useState<string>(SEED_GUIDE);
  const [editingGuide, setEditingGuide] = useState(false);
  const [guideDraft, setGuideDraft] = useState("");
  const dirtyRef = useRef(false); // 보고서를 편집 중(미저장)이면 SSE 로 덮어쓰지 않음
  const fileMetaRef = useRef<string>(""); // 현재 파일 메타(name,size) JSON — 변경 감지
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // 보고서 파일(dataUrl)은 SSE 로 흘리지 않으므로 변경 시 GET 으로 다시 받는다.
  const refetchFile = useCallback(async () => {
    if (!studentId) return;
    try {
      const res = await fetch(`/api/courses/${courseId}/mentoring?studentId=${encodeURIComponent(studentId)}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { file?: ReportFile | null };
      setReportFile(data.file ?? null);
    } catch {
      /* 무시 */
    }
  }, [courseId, studentId]);

  // 실시간 방 구독(SSE) — 선택 학생 방. 보고서/채팅/독서 + 파일 메타 변경 감지
  useEffect(() => {
    if (!studentId) return;
    // 학생 전환 시 이전 방 데이터 초기화
    setReport(blankReport());
    setChat([]);
    setBooks([]);
    setReportFile(null);
    fileMetaRef.current = "";
    dirtyRef.current = false;
    const es = new EventSource(`/api/courses/${courseId}/mentoring/stream?studentId=${encodeURIComponent(studentId)}`);
    es.onmessage = (e) => {
      try {
        const room = JSON.parse(e.data) as Room;
        setChat(Array.isArray(room.chat) ? room.chat : []);
        setBooks(Array.isArray(room.books) ? room.books : []);
        if (!dirtyRef.current) setReport({ ...blankReport(), ...(room.report ?? {}) });
        const meta = room.file ? JSON.stringify({ name: room.file.name, size: room.file.size }) : "";
        if (meta !== fileMetaRef.current) {
          fileMetaRef.current = meta;
          if (!room.file) setReportFile(null);
          else void refetchFile();
        }
      } catch {
        /* 무시 */
      }
    };
    return () => es.close();
  }, [courseId, studentId, refetchFile]);

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

  const hasContent = useMemo(() => Object.values(report).some((v) => v.trim().length > 0), [report]);

  function setField(key: FieldKey, value: string) {
    if (!canEditReport) return;
    dirtyRef.current = true;
    setReport((prev) => ({ ...prev, [key]: value }));
    setSavedFlash(false);
  }

  async function save() {
    if (!canEditReport) return;
    try {
      await postRoom(courseId, studentId, { action: "report", report });
      dirtyRef.current = false;
      setSavedFlash(true);
    } catch {
      /* 무시 */
    }
  }

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

  // PDF 업로드 → 방(서버)에 공유 저장 (관리자·학부모도 다운로드 가능)
  function onUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
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
    const reader = new FileReader();
    reader.onload = async () => {
      const rec: ReportFile = { name: f.name, size: f.size, dataUrl: String(reader.result) };
      setReportFile(rec);
      fileMetaRef.current = JSON.stringify({ name: rec.name, size: rec.size });
      try {
        const res = await fetch(`/api/courses/${courseId}/mentoring`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "file", file: rec, studentId }),
        });
        if (!res.ok) {
          const d = (await res.json()) as { error?: string };
          setFileError(d.error ?? "업로드에 실패했습니다.");
        }
      } catch {
        setFileError("업로드 중 오류가 발생했습니다.");
      }
    };
    reader.onerror = () => setFileError("파일을 읽지 못했습니다.");
    reader.readAsDataURL(f);
  }
  function downloadFile() {
    if (!reportFile) return;
    const a = document.createElement("a");
    a.href = reportFile.dataUrl;
    a.download = reportFile.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  function removeFile() {
    if (!canUploadFile) return;
    setReportFile(null);
    setFileError(null);
    fileMetaRef.current = "";
    void fetch(`/api/courses/${courseId}/mentoring`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "file", file: null, studentId }),
    });
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
              <select
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="rounded-full border px-3 py-1.5 text-[12.5px] font-semibold outline-none focus:border-[#8C6E59]"
                style={{ borderColor: LINE, color: INK, background: "#fff" }}
                aria-label="학생 선택"
              >
                {students.map((st) => (
                  <option key={st.id} value={st.id}>{st.name} 학생</option>
                ))}
              </select>
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
                    <button type="button" onClick={downloadFile} className="flex min-w-0 items-center gap-2.5 text-left" title="클릭하면 다운로드됩니다">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] text-white" style={{ background: BROWN }}><FileText size={16} /></span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13.5px] font-semibold hover:underline" style={{ color: DEEP }}>{reportFile.name}</span>
                        <span className="text-[11px]" style={{ color: MUTED }}>{fmtSize(reportFile.size)} · 클릭하여 다운로드</span>
                      </span>
                    </button>
                    <div className="flex shrink-0 items-center gap-1">
                      <button type="button" onClick={downloadFile} className="grid h-8 w-8 place-items-center rounded-[8px] hover:bg-[#F0EBE0]" style={{ color: BROWN }} aria-label="다운로드"><Download size={16} /></button>
                      {canUploadFile ? <button type="button" onClick={removeFile} className="grid h-8 w-8 place-items-center rounded-[8px] hover:bg-[#F0EBE0]" style={{ color: MUTED }} aria-label="삭제"><X size={16} /></button> : null}
                    </div>
                  </div>
                ) : canUploadFile ? (
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-dashed py-4 text-[13.5px] transition hover:border-[#8C6E59]" style={{ borderColor: LINE, color: SUB }}>
                    <Upload size={16} /> PDF 파일 업로드 (최대 6MB)
                    <input type="file" accept="application/pdf,.pdf" onChange={onUploadFile} className="hidden" />
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

          {/* 우: 독서활동상황 → 작성 가이드 → 1:1 멘토링 */}
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

            {/* 과목별 세부능력 특기사항 작성 가이드 */}
            <div className="rounded-[14px] bg-white" style={{ border: `1px solid ${CARD}` }}>
              <div className="flex items-center justify-between gap-2 border-b px-4 py-3" style={{ borderColor: CARD }}>
                <p className="text-[14px] font-bold" style={{ color: INK }}>과목별 세부능력 특기사항 작성 가이드</p>
                {isStaff ? (
                  editingGuide ? (
                    <span className="flex shrink-0 gap-1.5">
                      <button type="button" onClick={saveGuide} className="rounded-[6px] px-2.5 py-1 text-[12px] font-bold text-white" style={{ background: BROWN }}>저장</button>
                      <button type="button" onClick={() => setEditingGuide(false)} className="rounded-[6px] border px-2.5 py-1 text-[12px] font-semibold" style={{ borderColor: LINE, color: SUB }}>취소</button>
                    </span>
                  ) : (
                    <button type="button" onClick={startEditGuide} className="inline-flex shrink-0 items-center gap-1 rounded-[6px] border px-2.5 py-1 text-[12px] font-bold" style={{ borderColor: BROWN, color: BROWN }}><Pencil size={12} /> 수정</button>
                  )
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium" style={{ color: MUTED }}><Lock size={11} /> 읽기 전용</span>
                )}
              </div>
              <div className="px-4 py-4">
                {editingGuide ? (
                  <textarea value={guideDraft} onChange={(e) => setGuideDraft(e.target.value)} rows={7} className="w-full resize-y rounded-[8px] border px-3 py-2 text-[13.5px] leading-7 outline-none focus:border-[#8C6E59]" style={{ borderColor: "#E7E2D6", color: BODY }} />
                ) : (
                  <p className="whitespace-pre-line text-[13.5px] leading-7" style={{ color: BODY }}>{guide}</p>
                )}
              </div>
            </div>

            {/* 1:1 멘토링 (실시간) */}
            <div className="flex flex-col rounded-[14px] bg-white" style={{ border: `1px solid ${CARD}` }}>
              <div className="border-b px-4 py-3" style={{ borderColor: CARD }}>
                <p className="text-[14px] font-bold" style={{ color: INK }}>1:1 멘토링</p>
              </div>
              <div ref={chatScrollRef} className="flex max-h-[320px] min-h-[200px] flex-1 flex-col gap-2 overflow-y-auto px-4 py-4">
                {chat.length === 0 ? (
                  <p className="my-auto text-center text-[13px]" style={{ color: MUTED }}>메시지를 입력해 실시간 상담을 시작하세요.</p>
                ) : (
                  chat.map((m, i) => {
                    const mine = m.from === role;
                    return (
                      <div key={i} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div className="max-w-[80%]">
                          {!mine ? <p className="mb-0.5 text-[10px]" style={{ color: MUTED }}>{m.from === "teacher" ? "교사" : "학생"}</p> : null}
                          <div
                            className="rounded-[12px] px-3.5 py-2 text-[13px] leading-5"
                            style={mine ? { background: BROWN, color: "#fff" } : { background: PANEL, color: BODY, border: `1px solid ${LINE}` }}
                          >
                            {m.text}
                          </div>
                          <p className={`mt-0.5 text-[10px] ${mine ? "text-right" : "text-left"}`} style={{ color: MUTED }}>{m.at}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              {canChat ? (
              <div className="flex items-center gap-2 border-t px-3 py-3" style={{ borderColor: CARD }}>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  placeholder="메시지 입력 후 Enter"
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
            </div>
          </aside>
        </div>
        )}
      </main>
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
