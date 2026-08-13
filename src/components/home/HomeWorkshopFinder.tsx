"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Search, MapPin, X, ChevronDown, ChevronUp } from "lucide-react";

/* 서재 톤 강좌 찾기 — 필터 + 강좌 리스트. */
const PANEL = "#FBF8F2";
const LINE = "#E4DBC7";
const BROWN = "#8C6E59";
const INK = "#2C2823";
const BODY = "#223039";
const SUB = "#8A8479";
const LABEL = { fontFamily: "var(--font-serif)", fontSize: 15 } as const; // 5개 라벨 공통 폰트

const TARGETS = ["초등학생", "중학생", "고등학생", "학부모"];
// 형식: 저장값=한글(ko), 표시=영문 키워드(en) + 한글
const FORMAT_OPTIONS = [
  { en: "SELF", ko: "자기주도학습" },
  { en: "CARE", ko: "관리형학습" },
  { en: "LIVE", ko: "실시간수업" },
  { en: "SEMINAR", ko: "세미나" },
];
const MODES = ["온라인", "오프라인"];
const COUNTRIES = ["전체", "한국", "호치민", "하노이", "상해", "북경", "자카르타", "싱가포르"];

type Row = {
  id: string;
  name: string;
  target: string;
  format: string;
  mode: string;
  from: string; // YYYY-MM-DD (필터용)
  to: string;
  periodLabel: string; // 표시용
  country: string;
  capacity?: number; // 모집인원(관리자 설정). 미설정 시 20 기본
  applied?: number; // 현재 신청 인원. 미설정 시 0
  deadline?: string | null; // 마감일 ISO
  status: string; // private|prep|open|full|ongoing
  href: string;
};

// 신청현황 정원: 자기주도학습(SELF)은 999, 나머지는 모집인원(기본 20)
function capacityFor(format: string, capacity?: number) {
  return format === "자기주도학습" ? 999 : capacity ?? 20;
}

const STATUS_LABEL: Record<string, string> = { private: "비공개", prep: "오픈 준비중", open: "접수중", full: "마감", ongoing: "진행중" };
const STATUS_LIST = ["private", "prep", "open", "full", "ongoing"];
const STATUS_COLOR: Record<string, string> = { private: "#8A8479", prep: "#B58F72", open: "#3E7E5B", full: "#a6402c", ongoing: "#8C6E59" };
function fmtDeadline(iso?: string | null) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
  } catch {
    return "";
  }
}
function toDateInput(iso?: string | null) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  } catch {
    return "";
  }
}

export default function HomeWorkshopFinder() {
  const [targets, setTargets] = useState<string[]>([]);
  const [formats, setFormats] = useState<string[]>([]);
  const [modes, setModes] = useState<string[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [country, setCountry] = useState("전체");
  const [show, setShow] = useState(false); // 필터 기본 숨김
  const [liveApplied, setLiveApplied] = useState<Record<string, number>>({});
  const [rows, setRows] = useState<Row[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  // 카탈로그 로드(강좌 목록 + 관리자 여부, 비공개는 서버에서 필터)
  useEffect(() => {
    let alive = true;
    fetch("/api/courses/catalog", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { rows: [], isAdmin: false }))
      .then((d) => { if (alive) { setRows(Array.isArray(d.rows) ? d.rows : []); setIsAdmin(!!d.isAdmin); } })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // 신청 현황 실시간 구독(SSE 푸시) — 목록 로드 후
  useEffect(() => {
    if (!rows.length) return;
    const sources = rows.map((r) => {
      const es = new EventSource(`/api/courses/${r.id}/enrollment/stream`);
      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data) as { applied: number };
          setLiveApplied((prev) => ({ ...prev, [r.id]: data.applied }));
        } catch {
          /* 무시 */
        }
      };
      return es;
    });
    return () => sources.forEach((es) => es.close());
  }, [rows]);

  // 관리자 인라인 편집 → 메타 저장
  async function patchMeta(id: string, patch: Record<string, unknown>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...normalizePatch(patch) } : r)));
    try {
      await fetch(`/api/admin/courses/${id}/meta`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    } catch {
      /* 무시 */
    }
  }
  function normalizePatch(patch: Record<string, unknown>): Partial<Row> {
    const out: Partial<Row> = {};
    if ("status" in patch) out.status = String(patch.status);
    if ("deadline" in patch) out.deadline = (patch.deadline as string) || null;
    return out;
  }

  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const results = useMemo(
    () =>
      rows.filter((r) => {
        if (targets.length && !targets.includes(r.target)) return false;
        if (formats.length && !formats.includes(r.format)) return false;
        if (modes.length && !modes.includes(r.mode)) return false;
        if (country !== "전체" && r.country !== country) return false;
        if (from && r.to < from) return false;
        if (to && r.from > to) return false;
        return true;
      }),
    [rows, targets, formats, modes, country, from, to]
  );

  const chips: { key: string; label: string; remove: () => void }[] = [
    ...targets.map((t) => ({ key: `t-${t}`, label: t, remove: () => setTargets(targets.filter((x) => x !== t)) })),
    ...formats.map((f) => ({ key: `f-${f}`, label: f, remove: () => setFormats(formats.filter((x) => x !== f)) })),
    ...modes.map((m) => ({ key: `m-${m}`, label: m, remove: () => setModes(modes.filter((x) => x !== m)) })),
    ...(country !== "전체" ? [{ key: "c", label: country, remove: () => setCountry("전체") }] : []),
    ...(from || to ? [{ key: "d", label: `${from || "…"} ~ ${to || "…"}`, remove: () => { setFrom(""); setTo(""); } }] : []),
  ];

  return (
    <section id="find" className="mx-auto max-w-[1000px] px-6 pb-40">
      {/* 필터 펼치기 (기본=숨김) */}
      {!show ? (
        <div className="flex justify-center">
          <button type="button" onClick={() => setShow(true)} className="flex items-center gap-2 text-[15px]" style={{ color: BROWN }}>
            필터 펼치기 <ChevronDown size={17} />
          </button>
        </div>
      ) : null}

      {/* 필터 패널 */}
      {show ? (
      <div className="p-6 md:p-9" style={{ background: PANEL, borderRadius: 24 }}>
        {/* 대상 · 형식 · (방식+국가 위 / 기간 아래) — 4컬럼 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: "2rem", alignItems: "start" }}>
          <CheckCol title="대상" items={TARGETS.map((t) => ({ value: t, node: t }))} sel={targets} onToggle={(v) => toggle(targets, setTargets, v)} />
          <CheckCol title="형식" items={FORMAT_OPTIONS.map((f) => ({ value: f.ko, node: <FormatLabel en={f.en} ko={f.ko} /> }))} sel={formats} onToggle={(v) => toggle(formats, setFormats, v)} />
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", alignItems: "start" }}>
              <CheckCol title="방식" items={MODES.map((m) => ({ value: m, node: m }))} sel={modes} onToggle={(v) => toggle(modes, setModes, v)} />
              <div>
                <p style={{ ...LABEL, color: INK }}>국가</p>
                <select value={country} onChange={(e) => setCountry(e.target.value)} className="mt-3 w-full rounded-[10px] border bg-white text-[14px] outline-none" style={{ borderColor: LINE, color: INK, height: 31, padding: "0 12px" }}>
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c === "전체" ? "전체 국가" : c}</option>
                  ))}
                </select>
              </div>
            </div>
            {/* 기간 — 방식·국가 아래, 두 컬럼 폭 */}
            <div style={{ marginTop: 28 }}>
              <p style={{ ...LABEL, color: INK }}>기간</p>
              <div className="mt-3 flex items-center gap-3">
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="flex-1 rounded-[10px] border bg-white text-[14px] outline-none" style={{ borderColor: LINE, color: INK, height: 31, padding: "0 12px" }} />
                <span style={{ color: SUB }}>~</span>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="flex-1 rounded-[10px] border bg-white text-[14px] outline-none" style={{ borderColor: LINE, color: INK, height: 31, padding: "0 12px" }} />
              </div>
            </div>
          </div>
        </div>

        {/* 검색 버튼 (0.7x) */}
        <div className="mt-8 flex justify-end">
          <a href="#find-results" className="inline-flex items-center gap-1.5 font-medium text-white transition hover:opacity-90" style={{ background: BROWN, borderRadius: 8, padding: "8px 15px", fontSize: 12, boxShadow: "0 2px 6px rgba(140,110,89,0.22)" }}>
            <Search size={13} /> 검색
          </a>
        </div>
      </div>
      ) : null}

      {/* 필터 숨기기 */}
      {show ? (
        <div className="mt-6 flex justify-center">
          <button type="button" onClick={() => setShow(false)} className="flex items-center gap-2 text-[15px]" style={{ color: BROWN }}>
            필터 숨기기 <ChevronUp size={17} />
          </button>
        </div>
      ) : null}

      {/* 결과 */}
      <div id="find-results" className="mt-16">
        {chips.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {chips.map((c) => (
              <button key={c.key} type="button" onClick={c.remove} className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[13px] text-white" style={{ background: BROWN }}>
                {c.label} <X size={13} />
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[960px] text-left">
            <thead>
              <tr className="border-b" style={{ borderColor: "#D8CFBD" }}>
                {["강좌명", "대상", "형식", "방식", "기간", "국가", "신청현황", "마감", "상태"].map((h) => (
                  <th key={h} className="pb-3 pr-4 text-[14px] font-semibold" style={{ color: INK }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id} className="border-b" style={{ borderColor: "#EFEAE0" }}>
                  <td className="py-5 pr-4">
                    <Link href={r.href} className="text-[14px] hover:underline" style={{ color: BODY }}>{r.name}</Link>
                  </td>
                  <td className="py-5 pr-4 text-[14px]" style={{ color: BODY }}>{r.target}</td>
                  <td className="py-5 pr-4 text-[14px]" style={{ color: BODY }}>{r.format}</td>
                  <td className="py-5 pr-4 text-[14px]" style={{ color: BODY }}>{r.mode}</td>
                  <td className="py-5 pr-4 text-[14px]" style={{ color: BODY }}>{r.periodLabel}</td>
                  <td className="py-5 pr-4 text-[14px]" style={{ color: BODY }}>
                    <span className="inline-flex items-center gap-1.5">{r.country} <MapPin size={14} style={{ color: BROWN }} /></span>
                  </td>
                  <td className="py-5 pr-4 text-[14px]" style={{ color: BODY }}>
                    {(() => {
                      const applied = liveApplied[r.id] ?? r.applied ?? 0;
                      const cap = capacityFor(r.format, r.capacity);
                      const isFull = applied >= cap;
                      return (
                        <>
                          <span style={{ color: isFull ? "#a6402c" : BODY, fontWeight: isFull ? 600 : 400 }}>{applied}</span>
                          <span style={{ color: SUB }}>/</span>
                          <span style={{ color: BROWN, fontWeight: 600 }}>{cap}</span>
                          {isFull ? <span className="ml-1.5 text-[12px]" style={{ color: "#a6402c" }}>마감</span> : null}
                        </>
                      );
                    })()}
                  </td>
                  {/* 마감 */}
                  <td className="py-5 pr-4 text-[14px]" style={{ color: BODY }}>
                    {isAdmin ? (
                      <input type="date" value={toDateInput(r.deadline)} onChange={(e) => patchMeta(r.id, { deadline: e.target.value })} className="rounded-[8px] border bg-white px-2 py-1 text-[13px]" style={{ borderColor: LINE, color: INK }} />
                    ) : (
                      <span style={{ color: r.deadline ? BODY : SUB }}>{fmtDeadline(r.deadline) || "-"}</span>
                    )}
                  </td>
                  {/* 상태 */}
                  <td className="py-5 text-[14px]">
                    {isAdmin ? (
                      <select value={r.status} onChange={(e) => patchMeta(r.id, { status: e.target.value })} className="rounded-[8px] border bg-white px-2 py-1 text-[13px] font-semibold" style={{ borderColor: LINE, color: STATUS_COLOR[r.status] ?? INK }}>
                        {STATUS_LIST.map((s) => (
                          <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: STATUS_COLOR[r.status] ?? INK }}>
                        <span style={{ fontSize: 9 }}>●</span>{STATUS_LABEL[r.status] ?? r.status}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {results.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-[15px]" style={{ color: SUB }}>조건에 맞는 강좌가 없습니다.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

type CheckItem = { value: string; node: ReactNode };

function CheckCol({ title, items, sel, onToggle }: { title: string; items: CheckItem[]; sel: string[]; onToggle: (v: string) => void }) {
  return (
    <div>
      <p style={{ ...LABEL, color: INK }}>{title}</p>
      <div className="mt-4 space-y-3">
        {items.map((it) => (
          <label key={it.value} className="flex cursor-pointer items-center gap-2.5 text-[14px]" style={{ color: BODY }}>
            <input type="checkbox" checked={sel.includes(it.value)} onChange={() => onToggle(it.value)} className="h-[18px] w-[18px] accent-[#8C6E59]" />
            {it.node}
          </label>
        ))}
      </div>
    </div>
  );
}

function FormatLabel({ en, ko }: { en: string; ko: string }) {
  return (
    <span className="inline-flex items-baseline gap-2">
      <span style={{ color: BROWN, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em" }}>{en}</span>
      <span>{ko}</span>
    </span>
  );
}
