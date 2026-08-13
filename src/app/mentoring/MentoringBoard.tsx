"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Send, Paperclip, Download } from "lucide-react";

const BROWN = "#8C6E59";
const INK = "#2C2823";
const BODY = "#334155";
const SUB = "#8A8479";
const MUTED = "#94a3b8";
const LINE = "#E4DBC7";
const PANEL = "#FBF8F2";
const serif = { fontFamily: "var(--font-serif)" } as const;

type Course = { id: string; title: string };
type Room = { courseId: string; roomStudentId: string; title: string; unread: number; lastText: string; lastAt: string; canSend: boolean };
type ChatMsg = { id: string; from: "teacher" | "student"; senderId: string; text: string; at: string; deleted: boolean; kind: "text" | "file"; file: { name: string; size: number } | null };

const PAGE_SIZE = 6; // 노트북 기준 2행 × 3열

export default function MentoringBoard({ courses, rooms, viewerId }: { courses: Course[]; rooms: Room[]; viewerId: string }) {
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => (courseFilter === "all" ? rooms : rooms.filter((r) => r.courseId === courseFilter)), [rooms, courseFilter]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRooms = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  useEffect(() => { setPage(0); }, [courseFilter]);

  const btn = (active: boolean) =>
    `shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition ${active ? "" : "hover:border-[#8C6E59]"}`;
  const btnStyle = (active: boolean) => (active ? { background: BROWN, color: "#fff", borderColor: BROWN } : { background: "#fff", color: SUB, borderColor: LINE });

  return (
    <main className="mx-auto w-full max-w-[1200px] px-5 py-8 md:px-6">
      <h1 className="text-[26px] font-normal" style={{ ...serif, color: INK }}>멘토링 더보기</h1>
      <p className="mt-1 text-[13.5px]" style={{ color: SUB }}>담당 강좌 수강생과의 1:1 채팅을 한 화면에서 관리하세요. 강좌를 선택하면 해당 학생만 표시됩니다.</p>

      {/* 강좌 토글 */}
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" onClick={() => setCourseFilter("all")} className={btn(courseFilter === "all")} style={btnStyle(courseFilter === "all")}>전체</button>
        {courses.map((c) => (
          <button key={c.id} type="button" onClick={() => setCourseFilter(c.id)} className={btn(courseFilter === c.id)} style={btnStyle(courseFilter === c.id)}>{c.title}</button>
        ))}
      </div>

      {/* 페이지 컨트롤 */}
      <div className="mt-4 flex items-center justify-between">
        <span className="text-[12.5px]" style={{ color: MUTED }}>총 {filtered.length}명 · {safePage + 1} / {totalPages} 페이지</span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={safePage === 0} className="grid h-9 w-9 place-items-center rounded-full border transition hover:border-[#8C6E59] disabled:opacity-30" style={{ borderColor: LINE, color: BROWN }} aria-label="이전"><ChevronLeft size={18} /></button>
          <button type="button" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={safePage >= totalPages - 1} className="grid h-9 w-9 place-items-center rounded-full border transition hover:border-[#8C6E59] disabled:opacity-30" style={{ borderColor: LINE, color: BROWN }} aria-label="다음"><ChevronRight size={18} /></button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-16 text-center text-[15px]" style={{ color: SUB }}>표시할 수강생이 없습니다.</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pageRooms.map((r) => (
            <ChatCell key={`${r.courseId}::${r.roomStudentId}`} courseId={r.courseId} roomStudentId={r.roomStudentId} title={r.title} viewerId={viewerId} />
          ))}
        </div>
      )}
    </main>
  );
}

function ChatCell({ courseId, roomStudentId, title, viewerId }: { courseId: string; roomStudentId: string; title: string; viewerId: string }) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const es = new EventSource(`/api/courses/${courseId}/mentoring/stream?studentId=${encodeURIComponent(roomStudentId)}`);
    es.onmessage = (e) => {
      try {
        const room = JSON.parse(e.data) as { chat?: ChatMsg[] };
        setMsgs(Array.isArray(room.chat) ? room.chat : []);
      } catch {
        /* 무시 */
      }
    };
    void fetch("/api/mentoring/read", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ courseId, roomStudentId }) }).catch(() => {});
    return () => es.close();
  }, [courseId, roomStudentId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs]);

  async function send() {
    const t = draft.trim();
    if (!t) return;
    setDraft("");
    await fetch(`/api/courses/${courseId}/mentoring`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "chat", text: t, studentId: roomStudentId }) }).catch(() => setErr("전송에 실패했습니다."));
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) { setErr("파일이 너무 큽니다. (최대 20MB)"); return; }
    setErr(null);
    setUploading(true);
    try {
      const dataUrl: string = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.onerror = () => rej(new Error("read"));
        r.readAsDataURL(f);
      });
      const resp = await fetch(`/api/courses/${courseId}/mentoring`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "chatFile", file: { name: f.name, size: f.size, mime: f.type, dataUrl }, studentId: roomStudentId }),
      });
      if (!resp.ok) {
        const d = (await resp.json().catch(() => ({}))) as { error?: string };
        setErr(d.error ?? "업로드에 실패했습니다.");
      }
    } catch {
      setErr("업로드 중 오류가 발생했습니다.");
    } finally {
      setUploading(false);
    }
  }

  const fullHref = `/course/${courseId}/mentoring?student=${roomStudentId}`;

  return (
    <div className="flex h-[400px] flex-col overflow-hidden rounded-[14px] border bg-white" style={{ borderColor: LINE }}>
      <div className="flex items-center justify-between gap-2 border-b px-3.5 py-2.5" style={{ borderColor: LINE }}>
        <p className="min-w-0 flex-1 truncate text-[13.5px] font-bold" style={{ color: INK }}>{title}</p>
        <a href={fullHref} className="shrink-0 text-[11px]" style={{ color: BROWN }}>전체 보기</a>
      </div>
      <div ref={scrollRef} className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 py-3">
        {msgs.length === 0 ? (
          <p className="my-auto text-center text-[12px]" style={{ color: MUTED }}>메시지가 없습니다.</p>
        ) : (
          msgs.map((m) => {
            const mine = m.senderId === viewerId;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[84%]">
                  {!mine ? <p className="mb-0.5 text-[10px]" style={{ color: MUTED }}>{m.from === "teacher" ? "교사" : "학생"}</p> : null}
                  <div className="rounded-[12px] px-3 py-1.5 text-[12.5px] leading-5" style={m.deleted ? { background: "#F3F1EC", color: MUTED, fontStyle: "italic" } : mine ? { background: BROWN, color: "#fff" } : { background: PANEL, color: BODY, border: `1px solid ${LINE}` }}>
                    {m.deleted ? "삭제된 메시지입니다." : m.kind === "file" && m.file ? (
                      <span className="inline-flex items-center gap-1.5">
                        <a href={`/api/courses/${courseId}/mentoring/file?studentId=${encodeURIComponent(roomStudentId)}&id=${m.id}`} target="_blank" rel="noreferrer" className="underline" title="새 탭에서 보기">📎 {m.file.name}</a>
                        <a href={`/api/courses/${courseId}/mentoring/file?studentId=${encodeURIComponent(roomStudentId)}&id=${m.id}&download=1`} className="shrink-0 opacity-90 hover:opacity-100" aria-label="다운로드" title="다운로드"><Download size={12} /></a>
                      </span>
                    ) : (
                      m.text
                    )}
                  </div>
                  <p className={`mt-0.5 text-[10px] ${mine ? "text-right" : ""}`} style={{ color: MUTED }}>{m.at}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div>
        {err ? <p className="px-3 pt-1.5 text-[11px]" style={{ color: "#a6402c" }}>{err}</p> : null}
        <div className="flex items-center gap-2 border-t px-2.5 py-2" style={{ borderColor: LINE }}>
          <input ref={fileRef} type="file" onChange={onFile} className="hidden" />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] border transition hover:border-[#8C6E59] disabled:opacity-50" style={{ borderColor: "#E7E2D6", color: BROWN }} aria-label="파일 첨부"><Paperclip size={15} /></button>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} placeholder="메시지" className="h-9 min-w-0 flex-1 rounded-[8px] border px-3 text-[13px] outline-none focus:border-[#8C6E59]" style={{ borderColor: "#E7E2D6", color: BODY }} />
          <button type="button" onClick={() => void send()} className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] text-white" style={{ background: BROWN }} aria-label="전송"><Send size={15} /></button>
        </div>
      </div>
    </div>
  );
}
