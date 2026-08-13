"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { COURSES } from "@/lib/course/content";

const BROWN = "#8C6E59";
const INK = "#2C2823";
const SUB = "#8A8479";
const MUTED = "#94a3b8";
const LINE = "#E4DBC7";
const PANEL = "#FBF8F2";
const serif = { fontFamily: "var(--font-serif)" } as const;

type Notif = { id: string; kind: string; title: string; body: string; href: string; read: boolean; at: string };

const KIND_LABEL: Record<string, string> = { notice: "공지", comment: "댓글", post: "토론글", assignment: "과제 제출", peer: "피어리뷰" };
const courseTitle = (id: string) => COURSES.find((c) => c.id === id)?.title ?? id;
function courseOf(href: string): string | null {
  const m = /^\/course\/([^/]+)/.exec(href);
  return m ? m[1] : null;
}
function fmt(iso: string) {
  try {
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  } catch {
    return "";
  }
}

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Notif[]>([]);
  const [ready, setReady] = useState(false);
  const [kind, setKind] = useState("all");
  const [course, setCourse] = useState("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/notifications?limit=300", { cache: "no-store" });
        const d = (await res.json()) as { items?: Notif[] };
        if (alive) setItems(Array.isArray(d.items) ? d.items : []);
        // 방문 시 모두 읽음 처리(배지 정리)
        void fetch("/api/notifications", { method: "POST" }).catch(() => {});
      } catch {
        /* 무시 */
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const kinds = useMemo(() => [...new Set(items.map((n) => n.kind))], [items]);
  const courses = useMemo(() => [...new Set(items.map((n) => courseOf(n.href)).filter((x): x is string => !!x))], [items]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter(
      (n) =>
        (kind === "all" || n.kind === kind) &&
        (course === "all" || courseOf(n.href) === course) &&
        (!needle || `${n.title} ${n.body}`.toLowerCase().includes(needle))
    );
  }, [items, kind, course, q]);

  const chip = (active: boolean) =>
    `shrink-0 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition ${active ? "" : "hover:border-[#8C6E59]"}`;

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 md:px-6">
      <h1 className="text-[26px] font-normal" style={{ ...serif, color: INK }}>알림</h1>
      <p className="mt-1 text-[13.5px]" style={{ color: SUB }}>변동 사항을 한 곳에서 확인하세요. 항목·강좌·검색으로 필터링됩니다.</p>

      {/* 필터 */}
      <div className="mt-5 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setKind("all")} className={chip(kind === "all")} style={kind === "all" ? { background: BROWN, color: "#fff", borderColor: BROWN } : { borderColor: LINE, color: SUB, background: "#fff" }}>전체</button>
          {kinds.map((k) => (
            <button key={k} type="button" onClick={() => setKind(k)} className={chip(kind === k)} style={kind === k ? { background: BROWN, color: "#fff", borderColor: BROWN } : { borderColor: LINE, color: SUB, background: "#fff" }}>
              {KIND_LABEL[k] ?? k}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {courses.length > 1 ? (
            <select value={course} onChange={(e) => setCourse(e.target.value)} className="h-9 max-w-[220px] rounded-[8px] border px-2.5 text-[13px]" style={{ borderColor: LINE, color: INK, background: "#fff" }}>
              <option value="all">전체 강좌</option>
              {courses.map((c) => (
                <option key={c} value={c}>{courseTitle(c)}</option>
              ))}
            </select>
          ) : null}
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름·내용 검색" className="h-9 w-56 max-w-full rounded-[8px] border px-3 text-[13px] outline-none focus:border-[#8C6E59]" style={{ borderColor: LINE, color: INK }} />
        </div>
      </div>

      <div className="mt-4 h-px w-full" style={{ background: LINE }} />

      {/* 목록 */}
      <ul className="mt-3 space-y-1.5">
        {!ready ? (
          <li className="py-16 text-center text-[14px]" style={{ color: MUTED }}>불러오는 중…</li>
        ) : filtered.length === 0 ? (
          <li className="py-16 text-center text-[15px]" style={{ color: SUB }}>알림이 없습니다.</li>
        ) : (
          filtered.map((n) => {
            const cid = courseOf(n.href);
            return (
              <li key={n.id}>
                <button type="button" onClick={() => router.push(n.href)} className="flex w-full items-start gap-3 rounded-[10px] border p-3.5 text-left transition hover:border-[#8C6E59] hover:bg-[#FBF8F2]" style={{ borderColor: LINE }}>
                  <span className="mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: PANEL, color: BROWN }}>{KIND_LABEL[n.kind] ?? n.kind}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold" style={{ color: INK }}>{n.title}</span>
                    {n.body ? <span className="mt-0.5 block line-clamp-2 text-[12.5px]" style={{ color: SUB }}>{n.body}</span> : null}
                    <span className="mt-1 block text-[11px]" style={{ color: MUTED }}>{cid ? `${courseTitle(cid)} · ` : ""}{fmt(n.at)}</span>
                  </span>
                  {!n.read ? <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: "#d1493a" }} /> : null}
                </button>
              </li>
            );
          })
        )}
      </ul>
    </main>
  );
}
