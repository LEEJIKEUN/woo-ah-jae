"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getStoredCourse } from "@/lib/course/store";

/* 홈(우아재) 서재 톤 — 흰 바탕 · 브라운 · 명조 */
const BROWN = "#8C6E59";
const DEEP = "#6B5342";
const NUM = "#B58F72";
const BODY = "#223039";
const INK = "#2C2823";
const SUB = "#8A8479";
const LINE = "#E4DBC7";
const PANEL = "#FBF8F2";
const serif = { fontFamily: "var(--font-serif)" } as const;
const heroGrad = "linear-gradient(180deg, #F7F1E6 0%, #F0E6D5 100%)";

export type IntroSession = { title: string; scheduleLabel?: string };
export type IntroModule = { label: string; period?: string; locked?: boolean; openLabel?: string; sessions: IntroSession[] };
export type IntroData = {
  id: string;
  programme: string;
  title: string;
  subtitle: string;
  objectives?: string; // 세부 목표 — 줄바꿈 구분(한 줄 = 목표 1개)
  audience?: string;
  format?: string;
  deliveryMode?: string;
  classDays?: string;
  timetable?: { day: string; time: string }[];
  periodLabel?: string;
  country?: string;
  summary: string;
  realtimeInfo?: string;
  instructor?: { name: string; initials: string };
  modules: IntroModule[];
  firstHref?: string;
};

const SECTIONS = [
  { id: "about", label: "강좌 소개" },
  { id: "schedule", label: "강좌 일정" },
  { id: "lessons", label: "강좌 차시" },
] as const;

export default function CourseIntro({ seed, courseId, authed = false, enrolled: enrolledInitial = false, isAdmin = false, isFacilitator = false, closed = false, editHref }: { seed: IntroData | null; courseId: string; authed?: boolean; enrolled?: boolean; isAdmin?: boolean; isFacilitator?: boolean; closed?: boolean; editHref?: string }) {
  const [intro, setIntro] = useState<IntroData | null>(seed);
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState(false); // 화면 직접(인라인) 편집 모드
  const [objs, setObjs] = useState<string[]>([]); // 편집 모드에서의 세부 목표 초안
  const [enrolled, setEnrolled] = useState(enrolledInitial);
  const [status, setStatus] = useState<{ applied: number; capacity: number; full: boolean } | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [active, setActive] = useState<string>("about");

  useEffect(() => {
    const es = new EventSource(`/api/courses/${courseId}/enrollment/stream`);
    es.onmessage = (e) => {
      try {
        setStatus(JSON.parse(e.data) as { applied: number; capacity: number; full: boolean });
      } catch {
        /* 무시 */
      }
    };
    return () => es.close();
  }, [courseId]);

  useEffect(() => {
    const stored = getStoredCourseSafe(courseId);
    if (stored) setIntro(stored);
    setReady(true);
  }, [courseId]);

  // 스크롤스파이: 섹션 진입 시 탭 활성화
  useEffect(() => {
    if (!intro) return;
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: "-30% 0px -60% 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [intro]);

  const lessons = useMemo(() => {
    if (!intro) return [] as { no: number; scheduleLabel?: string; title: string }[];
    const out: { no: number; scheduleLabel?: string; title: string }[] = [];
    intro.modules.forEach((m) => m.sessions.forEach((s) => out.push({ no: out.length + 1, scheduleLabel: s.scheduleLabel, title: s.title })));
    return out;
  }, [intro]);

  if (!intro) {
    return <div className="mx-auto max-w-[640px] px-6 py-40 text-center" style={{ color: SUB }}>{ready ? "강좌를 찾을 수 없습니다." : "불러오는 중…"}</div>;
  }

  const [periodStart, periodEnd] = (intro.periodLabel ?? "").split("~").map((s) => s.trim());
  // 히어로 스탯은 한 줄로 간결하게(시간대 괄호는 사이드바·강좌 일정에서 노출)
  const scheduleShort = intro.classDays ? intro.classDays.replace(/\s*\([^)]*\)\s*$/, "") : intro.deliveryMode;
  const stats = [
    ["수강 대상", intro.audience],
    ["형식", intro.format],
    ["방식", intro.deliveryMode],
    ["수업 일정", scheduleShort],
    ["수강 기간", intro.periodLabel],
  ].filter(([, v]) => v) as [string, string][];

  // 세부 목표 리스트 — 줄바꿈 구분, 관리자가 직접 입력한 앞머리 번호(1. / 1)) 는 제거하고 자체 번호로 렌더
  const objectiveList = (intro.objectives ?? "")
    .split("\n")
    .map((s) => s.replace(/^\s*\d+\s*[.)]\s*/, "").trim())
    .filter(Boolean);

  const full = status?.full ?? false;

  async function enroll() {
    if (status?.full || enrolling) return;
    setEnrolling(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/enrollment`, { method: "POST" });
      const data = (await res.json()) as { applied: number; capacity: number; full: boolean };
      setStatus(data);
      if (res.ok) {
        setEnrolled(true);
      }
    } catch {
      /* 무시 */
    } finally {
      setEnrolling(false);
    }
  }

  // ── 인라인(화면 직접) 편집 ──
  async function patchField(patch: Partial<IntroData>) {
    setIntro((p) => (p ? { ...p, ...patch } : p));
    try {
      await fetch(`/api/admin/courses/${courseId}/meta`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    } catch {
      /* 무시 — 다음 편집 때 재시도 */
    }
  }
  function commit(field: keyof IntroData, val: string) {
    const cur = ((intro?.[field] as string | undefined) ?? "").trim();
    if (cur !== val.trim()) patchField({ [field]: val } as Partial<IntroData>);
  }
  // 세부 목표 편집: objs(배열) 를 authoritative 로 두고, 변경 시 줄바꿈 문자열로 저장
  const splitObjRaw = (s?: string) => (s ?? "").split("\n").map((x) => x.replace(/^\s*\d+\s*[.)]\s*/, ""));
  const joinObjs = (arr: string[]) => arr.map((s) => s.trim()).filter(Boolean).join("\n");
  function enterEdit() {
    setObjs(splitObjRaw(intro?.objectives));
    setEdit(true);
  }
  const setObjAt = (i: number, v: string) => setObjs((prev) => prev.map((x, j) => (j === i ? v : x)));
  const commitObjs = () => patchField({ objectives: joinObjs(objs) });
  function addObj() {
    setObjs((prev) => [...prev, ""]);
  }
  function delObj(i: number) {
    const next = objs.filter((_, j) => j !== i);
    setObjs(next);
    patchField({ objectives: joinObjs(next) });
  }
  function moveObj(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= objs.length) return;
    const next = objs.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setObjs(next);
    patchField({ objectives: joinObjs(next) });
  }

  const editFieldCls = "w-full rounded-[8px] border border-dashed bg-white/70 px-3 py-2 outline-none focus:border-[#8C6E59]";

  return (
    <div style={{ background: "#fff", color: BODY }}>
      {/* ── 히어로 밴드 ── */}
      <section className="w-full" style={{ background: heroGrad }}>
        <div className="mx-auto max-w-[1120px] px-6 py-14">
          {isAdmin ? (
            <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
              {edit ? (
                <span className="mr-auto text-[13px] font-medium" style={{ color: BROWN }}>
                  ✎ 편집 모드 — 내용을 그 자리에서 수정하세요. 칸 밖을 클릭하면 자동 저장됩니다.
                </span>
              ) : null}
              {editHref && !edit ? (
                <Link href={editHref} className="rounded-full border px-4 py-1.5 text-[13px] font-semibold transition hover:bg-white" style={{ borderColor: BROWN, color: BROWN }}>
                  커리큘럼 편집
                </Link>
              ) : null}
              {!edit ? (
                <button type="button" onClick={() => setEditing(true)} className="rounded-full border px-4 py-1.5 text-[13px] font-semibold transition hover:bg-white" style={{ borderColor: BROWN, color: BROWN }}>
                  강좌 정보 편집
                </button>
              ) : null}
              <button type="button" onClick={() => (edit ? setEdit(false) : enterEdit())} className="rounded-full px-4 py-1.5 text-[13px] font-semibold text-white transition hover:opacity-90" style={{ background: edit ? DEEP : BROWN }}>
                {edit ? "편집 완료" : "화면 직접 편집"}
              </button>
            </div>
          ) : null}
          {edit ? (
            <input defaultValue={intro.programme} key={`pg-${intro.programme}`} onBlur={(e) => commit("programme", e.target.value)} placeholder="상단 라벨(교육과정 등)" className={`${editFieldCls} text-[12px] font-semibold uppercase`} style={{ letterSpacing: "0.2em", color: NUM, borderColor: NUM }} />
          ) : (
            <p className="text-[12px] font-semibold uppercase" style={{ letterSpacing: "0.2em", color: NUM }}>{intro.programme}</p>
          )}
          {edit ? (
            <input defaultValue={intro.title} key={`ti-${intro.title}`} onBlur={(e) => commit("title", e.target.value)} placeholder="강좌명" className={`${editFieldCls} mt-3 font-normal`} style={{ ...serif, color: INK, fontSize: "clamp(24px, 3.4vw, 36px)", letterSpacing: "-0.02em", borderColor: LINE }} />
          ) : (
            <h1 className="mt-3 font-normal" style={{ ...serif, color: INK, fontSize: "clamp(28px, 4vw, 40px)", letterSpacing: "-0.02em" }}>{intro.title}</h1>
          )}
          {edit ? (
            <input defaultValue={intro.subtitle} key={`sub-${intro.subtitle}`} onBlur={(e) => commit("subtitle", e.target.value)} placeholder="강좌 목표(부제) — 한 줄" className={`${editFieldCls} mt-3 text-[16px] leading-7`} style={{ color: SUB, borderColor: LINE }} />
          ) : intro.subtitle ? (
            <p className="mt-3 text-[16px] leading-7" style={{ color: SUB }}>{intro.subtitle}</p>
          ) : null}
          {stats.length > 0 ? (
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {stats.map(([k, v]) => (
                <div key={k} className="min-w-0 rounded-[10px] px-4 py-3" style={{ background: "rgba(255,255,255,0.55)" }}>
                  <p className="text-[13px]" style={{ color: SUB }}>{k}</p>
                  <p className="mt-1 truncate text-[14px] font-semibold" style={{ color: DEEP }}>{v}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {/* ── 본문: 메인 + 사이드 ── */}
      <div className="mx-auto max-w-[1120px] px-6">
        <div className="grid gap-10 pb-32 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          {/* 메인 */}
          <main className="min-w-0">
            {/* 탭바(스크롤스파이) */}
            <nav className="sticky top-[68px] z-30 flex gap-6 border-b bg-white/95 backdrop-blur" style={{ borderColor: LINE }}>
              {SECTIONS.map((s) => {
                const on = active === s.id;
                return (
                  <a key={s.id} href={`#${s.id}`} className="relative py-4 text-[16px] transition" style={{ ...serif, color: on ? BROWN : SUB, fontWeight: on ? 700 : 400 }}>
                    {s.label}
                    {on ? <span className="absolute inset-x-0 -bottom-px h-[2px]" style={{ background: BROWN }} /> : null}
                  </a>
                );
              })}
            </nav>

            {/* ① 강좌 소개 */}
            <Section id="about" title="강좌 소개">
              {!edit && intro.subtitle ? (
                <>
                  <h3 className="text-[15px] font-semibold" style={{ color: INK }}>강좌 목표</h3>
                  <p className="mt-2 text-[15px] leading-8" style={{ color: SUB }}>{intro.subtitle}</p>
                </>
              ) : null}

              {/* 세부 목표 */}
              {edit ? (
                <div className="mb-6 mt-2 rounded-[12px] border border-dashed p-4" style={{ borderColor: LINE, background: "#FCFAF5" }}>
                  <h3 className="text-[15px] font-semibold" style={{ color: INK }}>세부 목표</h3>
                  <ol className="mt-3 space-y-2">
                    {objs.map((o, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-bold" style={{ background: PANEL, color: BROWN }}>{i + 1}</span>
                        <input value={o} onChange={(e) => setObjAt(i, e.target.value)} onBlur={commitObjs} placeholder="예: 벡터를 정의하고 계산할 수 있다." className="min-w-0 flex-1 rounded-[8px] border px-3 py-2 text-[15px] outline-none focus:border-[#8C6E59]" style={{ borderColor: LINE, color: BODY }} />
                        <button type="button" onClick={() => moveObj(i, -1)} disabled={i === 0} title="위로" className="grid h-7 w-7 shrink-0 place-items-center rounded-md border text-[13px] disabled:opacity-30" style={{ borderColor: LINE, color: SUB }}>↑</button>
                        <button type="button" onClick={() => moveObj(i, 1)} disabled={i === objs.length - 1} title="아래로" className="grid h-7 w-7 shrink-0 place-items-center rounded-md border text-[13px] disabled:opacity-30" style={{ borderColor: LINE, color: SUB }}>↓</button>
                        <button type="button" onClick={() => delObj(i)} title="삭제" className="grid h-7 w-7 shrink-0 place-items-center rounded-md border text-[15px]" style={{ borderColor: LINE, color: "#a6402c" }}>×</button>
                      </li>
                    ))}
                  </ol>
                  <button type="button" onClick={addObj} className="mt-3 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition hover:bg-white" style={{ borderColor: BROWN, color: BROWN }}>＋ 목표 추가</button>
                </div>
              ) : objectiveList.length > 0 ? (
                <ol className="mb-6 mt-4 space-y-2.5">
                  {objectiveList.map((o, i) => (
                    <li key={i} className="flex gap-3 text-[15px] leading-8" style={{ color: SUB }}>
                      <span className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-bold" style={{ background: PANEL, color: BROWN }}>{i + 1}</span>
                      <span className="min-w-0">{o}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="mb-6" />
              )}
              <h3 className="text-[15px] font-semibold" style={{ color: INK }}>강좌 설명</h3>
              {edit ? (
                <textarea defaultValue={intro.summary} key={`sm-${intro.summary}`} onBlur={(e) => commit("summary", e.target.value)} rows={7} placeholder="강좌 설명" className={`${editFieldCls} mt-2 resize-y text-[15px] leading-8`} style={{ color: BODY, borderColor: LINE }} />
              ) : (
                <p className="mt-2 whitespace-pre-line text-[15px] leading-8" style={{ color: SUB }}>{intro.summary}</p>
              )}
            </Section>

            {/* ② 강좌 일정 */}
            <Section id="schedule" title="강좌 일정">
              <div className="grid gap-8 sm:grid-cols-2">
                <div>
                  <p className="text-[13px]" style={{ color: SUB }}>수강 기간</p>
                  <div className="mt-3 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[13px]" style={{ color: SUB }}>시작일</p>
                      <p className="mt-1 text-[17px] font-semibold" style={{ ...serif, color: INK }}>{periodStart || "-"}</p>
                    </div>
                    <div>
                      <p className="text-[13px]" style={{ color: SUB }}>종료일</p>
                      <p className="mt-1 text-[17px] font-semibold" style={{ ...serif, color: INK }}>{periodEnd || "-"}</p>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-[13px]" style={{ color: SUB }}>요일 및 시간</p>
                  <div className="mt-3 space-y-2">
                    {(intro.timetable ?? []).length > 0 ? (
                      intro.timetable!.map((t, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <span className="grid h-9 w-9 place-items-center rounded-full text-[14px] font-bold" style={{ background: PANEL, color: BROWN }}>{t.day}</span>
                          <span className="text-[15px]" style={{ color: BODY }}>{t.time}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-[15px]" style={{ color: BODY }}>{intro.classDays ?? "-"}</p>
                    )}
                  </div>
                  <p className="mt-2 text-[12px]" style={{ color: SUB }}>* 싱가포르 표준시</p>
                </div>
              </div>
            </Section>

            {/* ③ 강좌 차시 */}
            <Section id="lessons" title="강좌 차시">
              {lessons.length > 0 ? <p className="mb-2 text-[14px] font-semibold" style={{ color: INK }}>총 {lessons.length}강</p> : null}
              <ul>
                {lessons.map((l) => (
                  <li key={l.no} className="flex items-center gap-5 border-b py-4" style={{ borderColor: "#F0EBE0" }}>
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[13px] font-bold" style={{ background: PANEL, color: BROWN }}>{l.no}</span>
                    {l.scheduleLabel ? <span className="w-32 shrink-0 text-[13px]" style={{ color: BROWN }}>{l.scheduleLabel}</span> : null}
                    <span className="min-w-0 flex-1 text-[15px]" style={{ color: BODY }}>{l.title}</span>
                  </li>
                ))}
              </ul>
            </Section>

          </main>

          {/* ── 사이드바 (신청) ── */}
          <aside className="lg:sticky lg:top-[92px]">
            <div className="pt-6 lg:pt-[76px]">
              {enrolled ? (
                <Link href={`/course/${intro.id}/learn`} className="flex h-12 w-full items-center justify-center gap-2 rounded-full text-white transition hover:opacity-90" style={{ background: BROWN, fontSize: 16, ...serif }}>
                  강의실 입장 &rarr;
                </Link>
              ) : isFacilitator ? (
                <button type="button" disabled className="h-12 w-full cursor-not-allowed rounded-full text-white opacity-50" style={{ background: BROWN, fontSize: 15, fontWeight: 600, ...serif }}>
                  담당 강좌만 입장할 수 있어요
                </button>
              ) : closed ? (
                <button type="button" disabled className="h-12 w-full cursor-not-allowed rounded-full text-white opacity-50" style={{ background: BROWN, fontSize: 16, fontWeight: 600, ...serif }}>
                  신청 마감
                </button>
              ) : !authed ? (
                <Link href={`/login?next=/course/${intro.id}`} className="flex h-12 w-full items-center justify-center rounded-full text-white transition hover:opacity-90" style={{ background: BROWN, fontSize: 16, fontWeight: 600, ...serif }}>
                  수강 신청하기
                </Link>
              ) : (
                <button type="button" onClick={enroll} disabled={full || enrolling} className="h-12 w-full rounded-full text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50" style={{ background: BROWN, fontSize: 16, fontWeight: 600, ...serif }}>
                  {full ? "모집 마감" : enrolling ? "신청 중…" : "수강 신청하기"}
                </button>
              )}

              <div className="mt-6 rounded-[16px] border p-6" style={{ borderColor: LINE }}>
                <h3 className="text-[16px] font-semibold" style={{ ...serif, color: INK }}>실시간 수업 안내</h3>
                {edit ? (
                  <textarea defaultValue={intro.realtimeInfo ?? ""} key={`rt-${intro.realtimeInfo ?? ""}`} onBlur={(e) => commit("realtimeInfo", e.target.value)} rows={4} placeholder="실시간 수업 안내 문구" className={`${editFieldCls} mt-2 resize-y text-[13.5px] leading-6`} style={{ color: BODY, borderColor: LINE }} />
                ) : (
                  <p className="mt-2 whitespace-pre-line text-[13.5px] leading-6" style={{ color: SUB }}>{intro.realtimeInfo || "이 강좌는 정해진 요일·시간에 화상으로 진행되는 실시간 수업입니다. 강좌 일정을 확인하고 신청해 주세요."}</p>
                )}

                <p className="mt-5 text-[14px] font-semibold" style={{ color: INK }}>수업 일정</p>
                <p className="mt-1 text-[13.5px]" style={{ color: SUB }}>{intro.classDays ?? "-"}</p>

                {status ? (
                  <>
                    <p className="mt-4 text-[14px] font-semibold" style={{ color: INK }}>신청 현황</p>
                    <p className="mt-1 text-[13.5px]" style={{ color: SUB }}>
                      <b style={{ color: full ? "#a6402c" : BROWN }}>{status.applied}</b> / {status.capacity}명
                    </p>
                    <p className="mt-4 flex items-center gap-1.5 text-[14px] font-bold" style={{ color: enrolled ? BROWN : (full || closed) ? "#a6402c" : "#3E7E5B" }}>
                      <span style={{ fontSize: 10 }}>●</span>
                      {enrolled ? "수강신청 완료" : closed ? "신청 마감" : full ? "모집 마감" : "모집 중"}
                    </p>
                  </>
                ) : null}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {editing && isAdmin ? (
        <CourseEditModal courseId={courseId} intro={intro} onClose={() => setEditing(false)} onSaved={(next) => setIntro((p) => (p ? { ...p, ...next } : p))} />
      ) : null}
    </div>
  );
}

function CourseEditModal({ courseId, intro, onClose, onSaved }: { courseId: string; intro: IntroData; onClose: () => void; onSaved: (next: Partial<IntroData>) => void }) {
  const [f, setF] = useState({
    programme: intro.programme ?? "",
    title: intro.title ?? "",
    subtitle: intro.subtitle ?? "",
    objectives: intro.objectives ?? "",
    summary: intro.summary ?? "",
    audience: intro.audience ?? "",
    format: intro.format ?? "실시간수업",
    deliveryMode: intro.deliveryMode ?? "온라인",
    classDays: intro.classDays ?? "",
    periodLabel: intro.periodLabel ?? "",
    country: intro.country ?? "",
    realtimeInfo: intro.realtimeInfo ?? "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const inputCls = "mt-1 w-full rounded-[8px] border bg-white px-3 py-2 text-[14px] outline-none focus:border-[#8C6E59]";
  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/courses/${courseId}/meta`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      if (res.ok) { onSaved(f); onClose(); }
    } catch {
      /* 무시 */
    } finally {
      setSaving(false);
    }
  }
  const rows: { key: keyof typeof f; label: string; area?: boolean; options?: string[]; placeholder?: string; rows?: number }[] = [
    { key: "programme", label: "상단 라벨(교육과정 등)" },
    { key: "title", label: "강좌명" },
    { key: "subtitle", label: "강좌 목표(부제)" },
    { key: "objectives", label: "세부 목표 (한 줄에 하나씩 · 엔터로 줄 추가)", area: true, rows: 5, placeholder: "예)\n벡터·행렬을 정의하고 계산할 수 있다.\n고유값·고유벡터를 직접 구할 수 있다.\n특이값 분해로 데이터를 차원 축소할 수 있다." },
    { key: "summary", label: "강좌 설명", area: true },
    { key: "audience", label: "수강 대상" },
    { key: "format", label: "형식", options: ["자기주도학습", "관리형학습", "실시간수업", "세미나"] },
    { key: "deliveryMode", label: "방식", options: ["온라인", "오프라인"] },
    { key: "classDays", label: "수업 일정" },
    { key: "periodLabel", label: "수강 기간" },
    { key: "country", label: "국가" },
    { key: "realtimeInfo", label: "실시간 수업 안내", area: true },
  ];
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-[16px] bg-white p-6" style={{ border: `1px solid ${LINE}` }} onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[18px] font-semibold" style={{ ...serif, color: INK }}>강좌 정보 편집</h3>
        <p className="mt-1 text-[12.5px]" style={{ color: SUB }}>관리자만 보입니다. 마감일·상태는 홈 강좌 목록에서 수정하세요.</p>
        <div className="mt-4 space-y-3">
          {rows.map((r) => (
            <label key={r.key} className="block">
              <span className="text-[13px] font-semibold" style={{ color: INK }}>{r.label}</span>
              {r.options ? (
                <select value={f[r.key]} onChange={(e) => set(r.key, e.target.value)} className={inputCls} style={{ borderColor: LINE, color: BODY }}>
                  {r.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : r.area ? (
                <textarea value={f[r.key]} onChange={(e) => set(r.key, e.target.value)} rows={r.rows ?? 4} placeholder={r.placeholder} className={`${inputCls} resize-y leading-7`} style={{ borderColor: LINE, color: BODY }} />
              ) : (
                <input value={f[r.key]} onChange={(e) => set(r.key, e.target.value)} placeholder={r.placeholder} className={inputCls} style={{ borderColor: LINE, color: BODY }} />
              )}
            </label>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-[8px] border px-4 py-2 text-[14px] font-semibold" style={{ borderColor: LINE, color: SUB }}>취소</button>
          <button type="button" onClick={save} disabled={saving} className="rounded-[8px] px-5 py-2 text-[14px] font-bold text-white disabled:opacity-60" style={{ background: BROWN }}>{saving ? "저장 중…" : "저장"}</button>
        </div>
      </div>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ scrollMarginTop: 132 }} className="pt-12">
      <h2 className="mb-6 text-[22px] font-normal md:text-[26px]" style={{ ...serif, color: INK, letterSpacing: "-0.02em" }}>{title}</h2>
      {children}
    </section>
  );
}

/* 커스텀(개설) 강좌를 localStorage 에서 IntroData 로 해석 */
function getStoredCourseSafe(courseId: string): IntroData | null {
  const stored = getStoredCourse(courseId);
  if (!stored) return null;
  return {
    id: stored.id,
    programme: stored.programme || "우아재 강좌",
    title: stored.title,
    subtitle: stored.subtitle,
    audience: stored.audience,
    format: stored.format,
    deliveryMode: stored.deliveryMode,
    periodLabel: stored.periodLabel,
    country: stored.country,
    summary: stored.summary,
    instructor: { name: "우아재 서재", initials: "齋" },
    modules: stored.modules.map((m) => ({ label: m.label, sessions: (m.lessons ?? []).map((l) => ({ title: l.title })) })),
  };
}
