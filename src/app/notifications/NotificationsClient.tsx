"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const BROWN = "#8C6E59";
const INK = "#2C2823";
const SUB = "#8A8479";
const MUTED = "#94a3b8";
const LINE = "#E4DBC7";
const PANEL = "#FBF8F2";
const serif = { fontFamily: "var(--font-serif)" } as const;

type Notif = { id: string; kind: string; title: string; body: string; href: string; read: boolean; at: string };
type Course = { id: string; title: string };
type Group = { key: string; label: string; kinds: string[] };

const KIND_LABEL: Record<string, string> = { notice: "공지", comment: "댓글", post: "토론글", assignment: "과제 제출", peer: "피어리뷰", mention: "멘션" };

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

export default function NotificationsClient({ role, myName, childNames, courses }: { role: string; myName: string; childNames: string[]; courses: Course[] }) {
  const router = useRouter();
  const [items, setItems] = useState<Notif[]>([]);
  const [ready, setReady] = useState(false);
  const [course, setCourse] = useState("all");
  const [group, setGroup] = useState("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/notifications?limit=300", { cache: "no-store" });
        const d = (await res.json()) as { items?: Notif[] };
        if (alive) setItems(Array.isArray(d.items) ? d.items : []);
        void fetch("/api/notifications", { method: "POST" }).catch(() => {}); // 방문 시 읽음 처리(배지 정리)
      } catch {
        /* 무시 */
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => { alive = false; };
  }, []);

  const isStaff = role === "ADMIN" || role === "FACILITATOR";
  const mentionLabel = role === "PARENT" ? (childNames.length === 1 ? `@${childNames[0]}` : "@자녀") : `@${myName || "나"}`;

  const groups: Group[] = useMemo(
    () =>
      isStaff
        ? [
            { key: "board", label: "게시·댓글", kinds: ["post", "comment", "mention"] },
            { key: "task", label: "과제", kinds: ["assignment", "peer"] },
            { key: "notice", label: "공지", kinds: ["notice"] },
          ]
        : [
            { key: "me", label: mentionLabel, kinds: ["mention", "comment"] },
            { key: "notice", label: "공지", kinds: ["notice", "post"] },
            { key: "task", label: "과제", kinds: ["peer"] },
          ],
    [isStaff, mentionLabel]
  );
  const groupKinds = (k: string) => groups.find((g) => g.key === k)?.kinds ?? [];

  const showCourseRow = courses.length >= 1;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter(
      (n) =>
        (course === "all" || courseOf(n.href) === course) &&
        (group === "all" || groupKinds(group).includes(n.kind)) &&
        (!needle || `${n.title} ${n.body}`.toLowerCase().includes(needle))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, course, group, q, groups]);

  const countCourse = (cid: string) => (cid === "all" ? items.length : items.filter((n) => courseOf(n.href) === cid).length);
  const countGroup = (g: Group | null) => (g ? items.filter((n) => g.kinds.includes(n.kind)).length : items.length);

  const filteredIds = filtered.map((n) => n.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));
  function toggleSel(id: string) {
    setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  async function removeIds(ids: string[]) {
    if (!ids.length || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/notifications", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
      if (res.ok) {
        setItems((prev) => prev.filter((n) => !ids.includes(n.id)));
        setSelected(new Set());
      }
    } catch { /* 무시 */ } finally { setBusy(false); }
  }
  async function removeAll() {
    if (busy || !window.confirm("모든 알림을 삭제할까요? 되돌릴 수 없습니다.")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/notifications", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) });
      if (res.ok) { setItems([]); setSelected(new Set()); }
    } catch { /* 무시 */ } finally { setBusy(false); }
  }

  const banner = (active: boolean) =>
    `shrink-0 rounded-[12px] border px-4 py-2.5 text-left transition ${active ? "" : "hover:border-[#8C6E59]"}`;
  const bannerStyle = (active: boolean) => (active ? { background: BROWN, color: "#fff", borderColor: BROWN } : { background: "#fff", color: INK, borderColor: LINE });

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 md:px-6">
      <h1 className="text-[26px] font-normal" style={{ ...serif, color: INK }}>알림</h1>
      <p className="mt-1 text-[13.5px]" style={{ color: SUB }}>
        {isStaff ? "구성원 활동을 강좌·유형별로 확인하고, 선택해 한 번에 삭제할 수 있어요." : "나에게 온 알림을 강좌·유형별로 확인하고, 선택해 한 번에 삭제할 수 있어요."}
      </p>

      {/* 강좌 배너 (수강/담당 강좌가 2개 이상일 때) */}
      {showCourseRow ? (
        <div className="mt-5">
          <p className="mb-1.5 text-[12px] font-semibold" style={{ color: MUTED }}>강좌</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button type="button" onClick={() => setCourse("all")} className={banner(course === "all")} style={bannerStyle(course === "all")}>
              <span className="text-[13.5px] font-bold">전체 강좌</span>
              <span className="ml-2 text-[12px] opacity-70">{countCourse("all")}</span>
            </button>
            {courses.map((c) => (
              <button key={c.id} type="button" onClick={() => setCourse(c.id)} className={banner(course === c.id)} style={bannerStyle(course === c.id)}>
                <span className="flex items-center">
                  <span className="max-w-[240px] truncate text-[13.5px] font-bold">{c.title}</span>
                  <span className="ml-2 shrink-0 text-[12px] opacity-70">{countCourse(c.id)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* 유형 배너 */}
      <div className="mt-4">
        <p className="mb-1.5 text-[12px] font-semibold" style={{ color: MUTED }}>유형</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setGroup("all")} className={banner(group === "all")} style={bannerStyle(group === "all")}>
            <span className="text-[13.5px] font-bold">전체</span>
            <span className="ml-2 text-[12px] opacity-70">{countGroup(null)}</span>
          </button>
          {groups.map((g) => (
            <button key={g.key} type="button" onClick={() => setGroup(g.key)} className={banner(group === g.key)} style={bannerStyle(group === g.key)}>
              <span className="text-[13.5px] font-bold">{g.label}</span>
              <span className="ml-2 text-[12px] opacity-70">{countGroup(g)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름·내용 검색" className="h-9 w-full max-w-xs rounded-[8px] border px-3 text-[13px] outline-none focus:border-[#8C6E59]" style={{ borderColor: LINE, color: INK }} />
      </div>

      {/* 선택·삭제 도구 */}
      {ready && filtered.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => (allSelected ? setSelected(new Set()) : setSelected(new Set(filteredIds)))} className="rounded-full border px-3 py-1.5 text-[12.5px] font-semibold" style={{ borderColor: LINE, color: SUB, background: "#fff" }}>
            {allSelected ? "전체 해제" : "전체 선택"}
          </button>
          <button type="button" disabled={busy || selected.size === 0} onClick={() => void removeIds([...selected])} className="rounded-full border px-3 py-1.5 text-[12.5px] font-semibold disabled:opacity-40" style={{ borderColor: "#E6C4C4", color: "#B4544B", background: "#fff" }}>
            선택 삭제{selected.size ? ` (${selected.size})` : ""}
          </button>
          <button type="button" disabled={busy || items.length === 0} onClick={() => void removeAll()} className="rounded-full border px-3 py-1.5 text-[12.5px] font-semibold disabled:opacity-40" style={{ borderColor: "#E6C4C4", color: "#B4544B", background: "#fff" }}>
            전체 삭제
          </button>
        </div>
      ) : null}

      <div className="mt-3 h-px w-full" style={{ background: LINE }} />

      {/* 목록 */}
      <ul className="mt-3 space-y-1.5">
        {!ready ? (
          <li className="py-16 text-center text-[14px]" style={{ color: MUTED }}>불러오는 중…</li>
        ) : filtered.length === 0 ? (
          <li className="py-16 text-center text-[15px]" style={{ color: SUB }}>알림이 없습니다.</li>
        ) : (
          filtered.map((n) => {
            const cid = courseOf(n.href);
            const cTitle = cid ? courses.find((c) => c.id === cid)?.title ?? cid : "";
            return (
              <li key={n.id} className="flex items-start gap-2">
                <input type="checkbox" checked={selected.has(n.id)} onChange={() => toggleSel(n.id)} className="mt-5 h-4 w-4 shrink-0 accent-[#8C6E59]" aria-label="선택" />
                <button type="button" onClick={() => router.push(n.href)} className="flex min-w-0 flex-1 items-start gap-3 rounded-[10px] border p-3.5 text-left transition hover:border-[#8C6E59] hover:bg-[#FBF8F2]" style={{ borderColor: LINE }}>
                  <span className="mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: PANEL, color: BROWN }}>{KIND_LABEL[n.kind] ?? n.kind}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold" style={{ color: INK }}>{n.title}</span>
                    {n.body ? <span className="mt-0.5 block line-clamp-2 text-[12.5px]" style={{ color: SUB }}>{n.body}</span> : null}
                    <span className="mt-1 block text-[11px]" style={{ color: MUTED }}>{cTitle ? `${cTitle} · ` : ""}{fmt(n.at)}</span>
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
