"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getStoredCourse, newId } from "@/lib/course/store";

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

export type IntroSession = { id?: string; title: string; scheduleLabel?: string; durationMin?: number };
export type IntroModule = { id?: string; label: string; weekStart?: string; weekEnd?: string; period?: string; locked?: boolean; openLabel?: string; sessions: IntroSession[] };
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
  capacity?: number;
  summary: string;
  realtimeInfo?: string;
  instructor?: { name: string; initials: string };
  modules: IntroModule[];
  firstHref?: string;
};

/** "매주 월·수 19:00~20:30 (…)" → [{day:'월',time:'19:00~20:30'}, …]. 요일·시간 표시용. */
function parseTimetable(classDays?: string): { day: string; time: string }[] {
  if (!classDays) return [];
  const tm = classDays.match(/(\d{1,2}:\d{2}\s*[~\-]\s*\d{1,2}:\d{2})/);
  const time = tm ? tm[1].replace(/\s+/g, "") : "";
  const days = [...new Set(classDays.match(/[월화수목금토일]/g) ?? [])];
  return days.map((day) => ({ day, time }));
}

const SECTIONS = [
  { id: "about", label: "강좌 소개" },
  { id: "schedule", label: "강좌 일정" },
  { id: "lessons", label: "강좌 차시" },
] as const;

export default function CourseIntro({ seed, courseId, authed = false, enrolled: enrolledInitial = false, isAdmin = false, isFacilitator = false, editHref, enrollBlock = null }: { seed: IntroData | null; courseId: string; authed?: boolean; enrolled?: boolean; isAdmin?: boolean; isFacilitator?: boolean; editHref?: string; enrollBlock?: { label: string; statusLabel: string; message?: string } | null }) {
  const [intro, setIntro] = useState<IntroData | null>(seed);
  const [ready, setReady] = useState(false);
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
  // 히어로 스탯 — 편집 모드에서 select/input 으로 그 자리 편집(CourseMeta 저장). country 는 편집 시에만 노출.
  const statFields: { key: keyof IntroData; label: string; options?: string[]; display?: string; editOnly?: boolean }[] = [
    { key: "audience", label: "수강 대상", options: ["초등학생", "중학생", "고등학생", "학부모"] },
    { key: "format", label: "형식", options: ["자기주도학습", "관리형학습", "실시간수업", "세미나"] },
    { key: "deliveryMode", label: "방식", options: ["온라인", "오프라인", "온·오프 동시"] },
    { key: "classDays", label: "수업 일정", display: scheduleShort ?? undefined },
    { key: "periodLabel", label: "수강 기간" },
    { key: "country", label: "국가", options: ["한국", "호치민", "하노이", "상해", "북경", "자카르타", "싱가포르"], editOnly: true },
  ];
  const statVisible = (f: { key: keyof IntroData; display?: string; editOnly?: boolean }) => f.display ?? (intro[f.key] as string | undefined);

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
      const data = (await res.json()) as { applied?: number; capacity?: number; full?: boolean; error?: string };
      if (res.ok && typeof data.applied === "number") {
        setStatus({ applied: data.applied, capacity: data.capacity ?? 20, full: !!data.full });
        setEnrolled(true);
      } else {
        // 신청 사이에 정원 마감·진행중 전환 등 상태 변동 → 안내 후 최신 상태로 새로고침
        alert(data.error ?? "지금은 수강신청을 받을 수 없어요.");
        window.location.reload();
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
  // 모집인원(정원) 편집 — 숫자. 저장 + 현재 표시(신청현황)도 즉시 반영.
  function commitCapacity(val: string) {
    const n = Math.floor(Number(val));
    if (!Number.isFinite(n) || n < 1) return;
    if (status?.capacity === n) return;
    setStatus((s) => (s ? { ...s, capacity: n, full: s.applied >= n } : s));
    patchField({ capacity: n });
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
              <button type="button" onClick={() => (edit ? setEdit(false) : enterEdit())} className="rounded-full px-4 py-1.5 text-[13px] font-semibold text-white transition hover:opacity-90" style={{ background: edit ? DEEP : BROWN }}>
                {edit ? "편집 완료" : "편집"}
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
          {edit || statFields.some((f) => !f.editOnly && statVisible(f)) ? (
            <div className="mt-9 flex flex-wrap gap-x-12 gap-y-5 border-t pt-6" style={{ borderColor: "rgba(140,110,89,0.2)" }}>
              {statFields.filter((f) => edit || (!f.editOnly && statVisible(f))).map((f) => {
                const val = (intro[f.key] as string | undefined) ?? "";
                return (
                  <div key={f.key} className="min-w-0">
                    <p className="text-[12.5px]" style={{ color: SUB }}>{f.label}</p>
                    {edit ? (
                      f.options ? (
                        <select value={val || f.options[0]} onChange={(e) => commit(f.key, e.target.value)} className="mt-1.5 rounded-[8px] border border-dashed bg-white/70 px-2.5 py-1.5 text-[14px] font-semibold outline-none focus:border-[#8C6E59]" style={{ color: DEEP, borderColor: LINE }}>
                          {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input defaultValue={val} key={`st-${String(f.key)}-${val}`} onBlur={(e) => commit(f.key, e.target.value)} placeholder={f.label} className="mt-1.5 w-48 rounded-[8px] border border-dashed bg-white/70 px-2.5 py-1.5 text-[14px] font-semibold outline-none focus:border-[#8C6E59]" style={{ color: DEEP, borderColor: LINE }} />
                      )
                    ) : (
                      <p className="mt-1.5 text-[15px] font-semibold" style={{ color: DEEP }}>{f.display ?? val}</p>
                    )}
                  </div>
                );
              })}
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
                  {edit ? (
                    <input defaultValue={intro.periodLabel ?? ""} key={`pl-${intro.periodLabel ?? ""}`} onBlur={(e) => commit("periodLabel", e.target.value)} placeholder="예: 2026.8.17.(월) ~ 2026.11.4.(수)" className={`${editFieldCls} mt-3 text-[15px]`} style={{ color: INK, borderColor: LINE }} />
                  ) : (
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
                  )}
                </div>
                <div>
                  <p className="text-[13px]" style={{ color: SUB }}>요일 및 시간</p>
                  {edit ? (
                    <>
                      <input defaultValue={intro.classDays ?? ""} key={`cd2-${intro.classDays ?? ""}`} onBlur={(e) => commit("classDays", e.target.value)} placeholder="예: 매주 월·수 19:00~20:30" className={`${editFieldCls} mt-3 text-[15px]`} style={{ color: INK, borderColor: LINE }} />
                      <p className="mt-1.5 text-[12px]" style={{ color: SUB }}>요일(월·수 등)과 시간을 적으면 아래 표에 자동 반영됩니다.</p>
                    </>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {(() => { const rows = parseTimetable(intro.classDays); return rows.length ? rows : (intro.timetable ?? []); })().length > 0 ? (
                        (() => { const rows = parseTimetable(intro.classDays); return rows.length ? rows : (intro.timetable ?? []); })().map((t, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <span className="grid h-9 w-9 place-items-center rounded-full text-[14px] font-bold" style={{ background: PANEL, color: BROWN }}>{t.day}</span>
                            <span className="text-[15px]" style={{ color: BODY }}>{t.time}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-[15px]" style={{ color: BODY }}>{intro.classDays ?? "-"}</p>
                      )}
                    </div>
                  )}
                  <p className="mt-2 text-[12px]" style={{ color: SUB }}>* 싱가포르 표준시</p>
                </div>
              </div>
            </Section>

            {/* ③ 강좌 차시 */}
            <Section id="lessons" title="강좌 차시">
              {edit ? (
                <CurriculumEditor courseId={courseId} initial={intro.modules} onChange={(mods) => setIntro((p) => (p ? { ...p, modules: mods } : p))} />
              ) : (
                <>
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
                </>
              )}
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
              ) : enrollBlock ? (
                <button type="button" disabled className="h-12 w-full cursor-not-allowed rounded-full text-white opacity-50" style={{ background: BROWN, fontSize: 15, fontWeight: 600, ...serif }}>
                  {enrollBlock.label}
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

              {!enrolled && !isFacilitator && enrollBlock?.message ? (
                <p className="mt-3 whitespace-nowrap rounded-[10px] px-3.5 py-2.5 text-center text-[12.5px]" style={{ background: "#FBF3EE", color: "#a6402c", border: "1px solid #F0D9CF" }}>{enrollBlock.message}</p>
              ) : null}

              <div className="mt-6 rounded-[16px] border p-6" style={{ borderColor: LINE }}>
                <h3 className="text-[16px] font-semibold" style={{ ...serif, color: INK }}>실시간 수업 안내</h3>
                {edit ? (
                  <textarea defaultValue={intro.realtimeInfo ?? ""} key={`rt-${intro.realtimeInfo ?? ""}`} onBlur={(e) => commit("realtimeInfo", e.target.value)} rows={4} placeholder="실시간 수업 안내 문구" className={`${editFieldCls} mt-2 resize-y text-[13.5px] leading-6`} style={{ color: BODY, borderColor: LINE }} />
                ) : (
                  <p className="mt-2 whitespace-pre-line text-[13.5px] leading-6" style={{ color: SUB }}>{intro.realtimeInfo || "이 강좌는 정해진 요일·시간에 화상으로 진행되는 실시간 수업입니다. 강좌 일정을 확인하고 신청해 주세요."}</p>
                )}

                <p className="mt-5 text-[14px] font-semibold" style={{ color: INK }}>수업 일정</p>
                {edit ? (
                  <input defaultValue={intro.classDays ?? ""} key={`cd-${intro.classDays ?? ""}`} onBlur={(e) => commit("classDays", e.target.value)} placeholder="예: 매주 월·수 19:00~20:30" className={`${editFieldCls} mt-1 text-[13.5px]`} style={{ color: BODY, borderColor: LINE }} />
                ) : (
                  <p className="mt-1 text-[13.5px]" style={{ color: SUB }}>{intro.classDays ?? "-"}</p>
                )}

                {status ? (
                  <>
                    <p className="mt-4 text-[14px] font-semibold" style={{ color: INK }}>신청 현황</p>
                    <p className="mt-1 flex items-center gap-1 text-[13.5px]" style={{ color: SUB }}>
                      <b style={{ color: full ? "#a6402c" : BROWN }}>{status.applied}</b> /{" "}
                      {edit ? (
                        <input type="number" min={1} defaultValue={status.capacity} key={`cap-${status.capacity}`} onBlur={(e) => commitCapacity(e.target.value)} className="w-16 rounded-[6px] border border-dashed px-2 py-0.5 text-center text-[13.5px] outline-none focus:border-[#8C6E59]" style={{ borderColor: NUM, color: INK }} />
                      ) : (
                        status.capacity
                      )}
                      명
                    </p>
                    <p className="mt-4 flex items-center gap-1.5 text-[14px] font-bold" style={{ color: enrolled ? BROWN : (enrollBlock || full) ? "#a6402c" : "#3E7E5B" }}>
                      <span style={{ fontSize: 10 }}>●</span>
                      {enrolled ? "수강신청 완료" : enrollBlock ? enrollBlock.statusLabel : full ? "모집 마감" : "모집 중"}
                    </p>
                  </>
                ) : null}
              </div>
            </div>
          </aside>
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

/* ── 강좌 차시(커리큘럼) 인라인 에디터 — 저장 시 강의실·출석·이수에 그대로 반영 ── */
type EditSession = { id: string; title: string; scheduleLabel: string; durationMin: string };
type EditModule = { id: string; label: string; weekStart: string; sessions: EditSession[] };

function CurriculumEditor({ courseId, initial, onChange }: { courseId: string; initial: IntroModule[]; onChange: (mods: IntroModule[]) => void }) {
  const [mods, setMods] = useState<EditModule[]>(() =>
    initial.map((m) => ({
      id: m.id || newId("m"),
      label: m.label,
      weekStart: m.weekStart || "",
      sessions: m.sessions.map((s) => ({ id: s.id || newId("s"), title: s.title, scheduleLabel: s.scheduleLabel || "", durationMin: s.durationMin ? String(s.durationMin) : "" })),
    }))
  );
  const [saveState, setSaveState] = useState<"idle" | "saving" | "done" | "error">("idle");

  const toIntro = (ms: EditModule[]): IntroModule[] =>
    ms.map((m) => ({ id: m.id, label: m.label, weekStart: m.weekStart || undefined, sessions: m.sessions.map((s) => ({ id: s.id, title: s.title, scheduleLabel: s.scheduleLabel || undefined, durationMin: s.durationMin ? Number(s.durationMin) : undefined })) }));

  async function doSave(ms: EditModule[]) {
    setSaveState("saving");
    try {
      const payload = { modules: ms.map((m) => ({ id: m.id, label: m.label.trim(), weekStart: m.weekStart || undefined, sessions: m.sessions.map((s) => ({ id: s.id, title: s.title.trim(), scheduleLabel: s.scheduleLabel.trim() || undefined, durationMin: s.durationMin ? Number(s.durationMin) : undefined })) })) };
      const res = await fetch(`/api/courses/${courseId}/curriculum`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      setSaveState(res.ok ? "done" : "error");
    } catch {
      setSaveState("error");
    }
  }
  // 로컬/미리보기 갱신(입력 중). save=true 면 즉시 저장(구조 변경).
  function apply(next: EditModule[], save = false) {
    setMods(next);
    onChange(toIntro(next));
    if (save) void doSave(next);
  }
  const saveNow = () => void doSave(mods);

  const patchMod = (mi: number, patch: Partial<EditModule>) => apply(mods.map((m, i) => (i === mi ? { ...m, ...patch } : m)));
  const patchSess = (mi: number, si: number, patch: Partial<EditSession>) => apply(mods.map((m, i) => (i === mi ? { ...m, sessions: m.sessions.map((s, j) => (j === si ? { ...s, ...patch } : s)) } : m)));
  const addSess = (mi: number) => apply(mods.map((m, i) => (i === mi ? { ...m, sessions: [...m.sessions, { id: newId("s"), title: "", scheduleLabel: "", durationMin: "" }] } : m)), true);
  const delSess = (mi: number, si: number) => apply(mods.map((m, i) => (i === mi ? { ...m, sessions: m.sessions.filter((_, j) => j !== si) } : m)), true);
  const moveSess = (mi: number, si: number, dir: -1 | 1) => {
    const m = mods[mi]; const j = si + dir; if (j < 0 || j >= m.sessions.length) return;
    const ss = m.sessions.slice(); [ss[si], ss[j]] = [ss[j], ss[si]];
    apply(mods.map((mm, i) => (i === mi ? { ...mm, sessions: ss } : mm)), true);
  };
  const addMod = () => apply([...mods, { id: newId("m"), label: "", weekStart: "", sessions: [{ id: newId("s"), title: "", scheduleLabel: "", durationMin: "" }] }], true);
  const delMod = (mi: number) => { if (!confirm("이 주차(모듈)를 삭제할까요? 안의 차시도 함께 목록에서 제거됩니다.")) return; apply(mods.filter((_, i) => i !== mi), true); };
  const moveMod = (mi: number, dir: -1 | 1) => { const j = mi + dir; if (j < 0 || j >= mods.length) return; const ms = mods.slice(); [ms[mi], ms[j]] = [ms[j], ms[mi]]; apply(ms, true); };

  const iCls = "w-full rounded-[8px] border bg-white px-3 py-2 text-[14px] outline-none focus:border-[#8C6E59]";
  const mBtn = "grid h-7 w-7 shrink-0 place-items-center rounded-md border text-[13px] disabled:opacity-30";

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="text-[13px] leading-6" style={{ color: SUB }}>주차(모듈)와 차시를 추가·수정·정렬하세요. <b style={{ color: BROWN }}>강의실·출석·이수에 그대로 반영</b>됩니다. 각 차시의 학습 콘텐츠는 강의실에서 차시를 열어 편집합니다.</p>
        <span className="shrink-0 text-[12px]" style={{ color: saveState === "error" ? "#C0392B" : SUB }}>
          {saveState === "saving" ? "저장 중…" : saveState === "done" ? "저장됨 ✓" : saveState === "error" ? "⚠ 저장 실패" : ""}
        </span>
      </div>

      <div className="space-y-4">
        {mods.map((m, mi) => (
          <div key={m.id} className="rounded-[12px] border p-4" style={{ borderColor: LINE, background: "#FCFAF5" }}>
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-[12px] font-bold" style={{ color: NUM }}>{String(mi + 1).padStart(2, "0")}</span>
              <input value={m.label} onChange={(e) => patchMod(mi, { label: e.target.value })} onBlur={saveNow} placeholder="주차/모듈명 (예: 1주차 · 미분의 기초)" className={`${iCls} flex-1`} style={{ borderColor: LINE, color: INK }} />
              <input type="date" value={m.weekStart} onChange={(e) => patchMod(mi, { weekStart: e.target.value })} onBlur={saveNow} title="주차 시작일(이 날 00:00에 열림)" className="shrink-0 rounded-[8px] border bg-white px-2 py-2 text-[13px] outline-none" style={{ borderColor: LINE, color: BODY }} />
              <button type="button" onClick={() => moveMod(mi, -1)} disabled={mi === 0} title="위로" className={mBtn} style={{ borderColor: LINE, color: SUB }}>↑</button>
              <button type="button" onClick={() => moveMod(mi, 1)} disabled={mi === mods.length - 1} title="아래로" className={mBtn} style={{ borderColor: LINE, color: SUB }}>↓</button>
              <button type="button" onClick={() => delMod(mi)} title="주차 삭제" className={mBtn} style={{ borderColor: LINE, color: "#a6402c" }}>×</button>
            </div>

            <div className="mt-3 space-y-2 pl-6">
              {m.sessions.map((s, si) => (
                <div key={s.id} className="flex items-center gap-2">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold" style={{ background: PANEL, color: BROWN }}>{si + 1}</span>
                  <input value={s.scheduleLabel} onChange={(e) => patchSess(mi, si, { scheduleLabel: e.target.value })} onBlur={saveNow} placeholder="일시(예: 8.17.(월) 19:00)" className="w-36 shrink-0 rounded-[8px] border bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-[#8C6E59]" style={{ borderColor: LINE, color: BROWN }} />
                  <div className="flex shrink-0 items-center gap-1">
                    <input type="number" min={0} value={s.durationMin} onChange={(e) => patchSess(mi, si, { durationMin: e.target.value })} onBlur={saveNow} placeholder="운영시간" title="운영시간(분)" className="w-20 rounded-[8px] border bg-white px-2 py-1.5 text-[13px] outline-none focus:border-[#8C6E59]" style={{ borderColor: LINE, color: BODY }} />
                    <span className="text-[12px]" style={{ color: SUB }}>분</span>
                  </div>
                  <input value={s.title} onChange={(e) => patchSess(mi, si, { title: e.target.value })} onBlur={saveNow} placeholder="차시 제목 (예: 1강 · 극한과 연속)" className="min-w-0 flex-1 rounded-[8px] border bg-white px-3 py-1.5 text-[14px] outline-none focus:border-[#8C6E59]" style={{ borderColor: LINE, color: BODY }} />
                  <button type="button" onClick={() => moveSess(mi, si, -1)} disabled={si === 0} title="위로" className={mBtn} style={{ borderColor: LINE, color: SUB }}>↑</button>
                  <button type="button" onClick={() => moveSess(mi, si, 1)} disabled={si === m.sessions.length - 1} title="아래로" className={mBtn} style={{ borderColor: LINE, color: SUB }}>↓</button>
                  <button type="button" onClick={() => delSess(mi, si)} title="차시 삭제" className={mBtn} style={{ borderColor: LINE, color: "#a6402c" }}>×</button>
                </div>
              ))}
              <button type="button" onClick={() => addSess(mi)} className="mt-1 inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition hover:bg-white" style={{ borderColor: BROWN, color: BROWN }}>＋ 차시 추가</button>
            </div>
          </div>
        ))}
      </div>

      <button type="button" onClick={addMod} className="mt-4 inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-[13.5px] font-semibold transition hover:bg-white" style={{ borderColor: BROWN, color: BROWN }}>＋ 주차(모듈) 추가</button>
    </div>
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
