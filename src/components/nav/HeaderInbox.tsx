"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, MessageCircle, X, Send, Paperclip } from "lucide-react";

const BROWN = "#8c6e59";
const INK = "#2C2823";
const BODY = "#334155";
const SUB = "#8a8479";
const MUTED = "#94a3b8";
const LINE = "#ece7df";
const PANEL = "#FBF8F2";

type Notif = { id: string; kind: string; title: string; body: string; href: string; read: boolean; at: string };
type Conv = { courseId: string; roomStudentId: string; title: string; unread: number; lastText: string; lastAt: string; canSend: boolean };
type ChatMsg = { id: string; from: "teacher" | "student"; senderId: string; text: string; at: string; deleted: boolean; kind: "text" | "file"; file: { name: string; size: number } | null };

function Badge({ n }: { n: number }) {
  return (
    <span className="absolute -right-0.5 -top-0.5 grid min-h-[16px] min-w-[16px] place-items-center rounded-full px-1 text-[10px] font-bold text-white" style={{ background: "#d1493a" }}>
      {n > 99 ? "99+" : n}
    </span>
  );
}

export default function HeaderInbox({ userId }: { userId: string }) {
  const router = useRouter();
  const [notifs, setNotifs] = useState<{ items: Notif[]; unread: number }>({ items: [], unread: 0 });
  const [inbox, setInbox] = useState<{ conversations: Conv[]; unread: number }>({ conversations: [], unread: 0 });
  const [panel, setPanel] = useState<null | "bell" | "msg">(null);
  const [chat, setChat] = useState<Conv | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const [n, m] = await Promise.all([
        fetch("/api/notifications", { cache: "no-store" }).then((r) => (r.ok ? r.json() : { items: [], unread: 0 })),
        fetch("/api/mentoring/inbox", { cache: "no-store" }).then((r) => (r.ok ? r.json() : { conversations: [], unread: 0 })),
      ]);
      setNotifs({ items: n.items ?? [], unread: n.unread ?? 0 });
      setInbox({ conversations: m.conversations ?? [], unread: m.unread ?? 0 });
    } catch {
      /* 무시 */
    }
  }, []);

  useEffect(() => {
    void loadAll();
    const t = setInterval(loadAll, 120000); // 폴백 폴링(실시간 SSE 보조)
    const onFocus = () => void loadAll();
    window.addEventListener("focus", onFocus);
    const es = new EventSource("/api/inbox/stream");
    es.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data) as { type?: string };
        if (d.type === "refresh") void loadAll();
      } catch {
        /* 무시 */
      }
    };
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
      es.close();
    };
  }, [loadAll]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setPanel(null);
    }
    if (panel) window.addEventListener("mousedown", onDoc);
    return () => window.removeEventListener("mousedown", onDoc);
  }, [panel]);

  async function openBell() {
    if (panel === "bell") {
      setPanel(null);
      return;
    }
    setPanel("bell");
    if (notifs.unread > 0) {
      await fetch("/api/notifications", { method: "POST" }).catch(() => {});
      setNotifs((n) => ({ items: n.items.map((x) => ({ ...x, read: true })), unread: 0 }));
    }
  }
  function clickNotif(n: Notif) {
    setPanel(null);
    router.push(n.href);
  }
  function openChat(c: Conv) {
    setPanel(null);
    setChat(c);
    void fetch("/api/mentoring/read", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ courseId: c.courseId, roomStudentId: c.roomStudentId }) }).then(() => {
      setInbox((prev) => ({
        conversations: prev.conversations.map((x) => (x.courseId === c.courseId && x.roomStudentId === c.roomStudentId ? { ...x, unread: 0 } : x)),
        unread: Math.max(0, prev.unread - c.unread),
      }));
    });
  }

  return (
    <div ref={ref} className="relative flex items-center">
      <button type="button" onClick={() => void openBell()} className="relative grid h-9 w-9 place-items-center rounded-full hover:bg-[#f6f3ef]" aria-label="알림">
        <Bell size={18} style={{ color: SUB }} />
        {notifs.unread > 0 ? <Badge n={notifs.unread} /> : null}
      </button>
      <button type="button" onClick={() => setPanel((p) => (p === "msg" ? null : "msg"))} className="relative grid h-9 w-9 place-items-center rounded-full hover:bg-[#f6f3ef]" aria-label="메시지">
        <MessageCircle size={18} style={{ color: SUB }} />
        {inbox.unread > 0 ? <Badge n={inbox.unread} /> : null}
      </button>

      {panel === "bell" ? (
        <div className="absolute right-0 top-11 z-[60] w-[320px] max-w-[86vw] overflow-hidden rounded-[10px] border bg-white shadow-xl" style={{ borderColor: LINE }}>
          <div className="border-b px-4 py-2.5 text-[13px] font-bold" style={{ borderColor: LINE, color: INK }}>알림</div>
          <div className="max-h-[380px] overflow-y-auto">
            {notifs.items.length === 0 ? (
              <p className="py-8 text-center text-[13px]" style={{ color: MUTED }}>새 알림이 없습니다.</p>
            ) : (
              notifs.items.map((n) => (
                <button key={n.id} type="button" onClick={() => clickNotif(n)} className="block w-full border-b px-4 py-3 text-left transition hover:bg-[#FBF8F2]" style={{ borderColor: "#f2ece2" }}>
                  <p className="truncate text-[13px] font-semibold" style={{ color: n.read ? SUB : INK }}>{n.title}</p>
                  {n.body ? <p className="mt-0.5 line-clamp-2 text-[12px]" style={{ color: MUTED }}>{n.body}</p> : null}
                </button>
              ))
            )}
          </div>
          <Link href="/notifications" onClick={() => setPanel(null)} className="block border-t px-4 py-2.5 text-center text-[12.5px] font-semibold hover:bg-[#FBF8F2]" style={{ borderColor: LINE, color: BROWN }}>알림 전체보기 (더보기)</Link>
        </div>
      ) : null}

      {panel === "msg" ? (
        <div className="absolute right-0 top-11 z-[60] w-[320px] max-w-[86vw] overflow-hidden rounded-[10px] border bg-white shadow-xl" style={{ borderColor: LINE }}>
          <div className="border-b px-4 py-2.5 text-[13px] font-bold" style={{ borderColor: LINE, color: INK }}>1:1 멘토링</div>
          <div className="max-h-[380px] overflow-y-auto">
            {inbox.conversations.length === 0 ? (
              <p className="py-8 text-center text-[13px]" style={{ color: MUTED }}>대화가 없습니다.</p>
            ) : (
              inbox.conversations.map((c) => (
                <button key={`${c.courseId}::${c.roomStudentId}`} type="button" onClick={() => openChat(c)} className="flex w-full items-center gap-2 border-b px-4 py-3 text-left transition hover:bg-[#FBF8F2]" style={{ borderColor: "#f2ece2" }}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold" style={{ color: INK }}>{c.title}</p>
                    <p className="mt-0.5 truncate text-[12px]" style={{ color: MUTED }}>{c.lastText || "—"}</p>
                  </div>
                  {c.unread > 0 ? <span className="grid min-h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-bold text-white" style={{ background: "#d1493a" }}>{c.unread}</span> : null}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}

      {chat ? createPortal(<ChatPopup conv={chat} viewerId={userId} onClose={() => { setChat(null); void loadAll(); }} />, document.body) : null}
    </div>
  );
}

function ChatPopup({ conv, viewerId, onClose }: { conv: Conv; viewerId: string; onClose: () => void }) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) {
      setErr("파일이 너무 큽니다. (최대 20MB)");
      return;
    }
    setErr(null);
    setUploading(true);
    try {
      const dataUrl: string = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.onerror = () => rej(new Error("read"));
        r.readAsDataURL(f);
      });
      const resp = await fetch(`/api/courses/${conv.courseId}/mentoring`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "chatFile", file: { name: f.name, size: f.size, mime: f.type, dataUrl }, studentId: conv.roomStudentId }),
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

  useEffect(() => {
    const es = new EventSource(`/api/courses/${conv.courseId}/mentoring/stream?studentId=${encodeURIComponent(conv.roomStudentId)}`);
    es.onmessage = (e) => {
      try {
        const room = JSON.parse(e.data) as { chat?: ChatMsg[] };
        setMsgs(Array.isArray(room.chat) ? room.chat : []);
      } catch {
        /* 무시 */
      }
    };
    return () => es.close();
  }, [conv.courseId, conv.roomStudentId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs]);

  async function send() {
    const t = draft.trim();
    if (!t) return;
    setDraft("");
    await fetch(`/api/courses/${conv.courseId}/mentoring`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "chat", text: t, studentId: conv.roomStudentId }) }).catch(() => {});
  }

  const fullHref = `/course/${conv.courseId}/mentoring${viewerId !== conv.roomStudentId ? `?student=${conv.roomStudentId}` : ""}`;

  return (
    <div className="fixed bottom-4 right-4 z-[70] flex h-[440px] w-[340px] max-w-[92vw] flex-col rounded-[14px] border bg-white shadow-2xl" style={{ borderColor: LINE }}>
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3" style={{ borderColor: LINE }}>
        <p className="min-w-0 flex-1 truncate text-[14px] font-bold" style={{ color: INK }}>{conv.title}</p>
        <a href={fullHref} className="shrink-0 text-[11px]" style={{ color: BROWN }}>전체 보기</a>
        <button type="button" onClick={onClose} className="shrink-0" style={{ color: MUTED }} aria-label="닫기"><X size={16} /></button>
      </div>
      <div ref={scrollRef} className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 py-3">
        {msgs.length === 0 ? (
          <p className="my-auto text-center text-[12.5px]" style={{ color: MUTED }}>메시지가 없습니다.</p>
        ) : (
          msgs.map((m) => {
            const mine = m.senderId === viewerId;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[82%]">
                  {!mine ? <p className="mb-0.5 text-[10px]" style={{ color: MUTED }}>{m.from === "teacher" ? "교사" : "학생"}</p> : null}
                  <div className="rounded-[12px] px-3 py-1.5 text-[12.5px] leading-5" style={m.deleted ? { background: "#F3F1EC", color: MUTED, fontStyle: "italic" } : mine ? { background: BROWN, color: "#fff" } : { background: PANEL, color: BODY, border: `1px solid ${LINE}` }}>
                    {m.deleted ? "삭제된 메시지입니다." : m.kind === "file" && m.file ? (
                      <a href={`/api/courses/${conv.courseId}/mentoring/file?studentId=${encodeURIComponent(conv.roomStudentId)}&id=${m.id}`} target="_blank" rel="noreferrer" className="underline">📎 {m.file.name}</a>
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
      {conv.canSend ? (
        <div>
          {err ? <p className="px-3 pt-2 text-[11px]" style={{ color: "#a6402c" }}>{err}</p> : null}
          <div className="flex items-center gap-2 border-t px-3 py-2.5" style={{ borderColor: LINE }}>
            <input ref={fileRef} type="file" onChange={onFile} className="hidden" />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] border transition hover:border-[#8C6E59] disabled:opacity-50" style={{ borderColor: "#E7E2D6", color: BROWN }} aria-label="파일 첨부" title="사진·파일 첨부 (최대 20MB)"><Paperclip size={15} /></button>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder={uploading ? "파일 업로드 중…" : "메시지 입력 후 Enter"}
              className="h-9 flex-1 rounded-[8px] border px-3 text-[12.5px] outline-none focus:border-[#8C6E59]"
              style={{ borderColor: "#E7E2D6", color: BODY }}
            />
            <button type="button" onClick={() => void send()} className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] text-white" style={{ background: BROWN }} aria-label="전송"><Send size={15} /></button>
          </div>
        </div>
      ) : (
        <div className="border-t px-3 py-2.5 text-center text-[11px]" style={{ borderColor: LINE, color: MUTED }}>열람 전용 — 메시지를 보낼 수 없습니다.</div>
      )}
    </div>
  );
}
