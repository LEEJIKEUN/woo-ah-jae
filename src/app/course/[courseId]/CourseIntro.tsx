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
  audience?: string;
  deliveryMode?: string;
  classDays?: string;
  timetable?: { day: string; time: string }[];
  periodLabel?: string;
  country?: string;
  summary: string;
  instructor?: { name: string; initials: string };
  modules: IntroModule[];
  firstHref?: string;
};

const SECTIONS = [
  { id: "about", label: "강좌 소개" },
  { id: "schedule", label: "강좌 일정" },
  { id: "lessons", label: "강좌 차시" },
] as const;

export default function CourseIntro({ seed, courseId, authed = false, enrolled: enrolledInitial = false }: { seed: IntroData | null; courseId: string; authed?: boolean; enrolled?: boolean }) {
  const [intro, setIntro] = useState<IntroData | null>(seed);
  const [ready, setReady] = useState(false);
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
    ["수업 일정", scheduleShort],
    ["수강 기간", intro.periodLabel],
  ].filter(([, v]) => v) as [string, string][];

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

  return (
    <div style={{ background: "#fff", color: BODY }}>
      {/* ── 히어로 밴드 ── */}
      <section className="w-full" style={{ background: heroGrad }}>
        <div className="mx-auto max-w-[1120px] px-6 py-14">
          <p className="text-[12px] font-semibold uppercase" style={{ letterSpacing: "0.2em", color: NUM }}>{intro.programme}</p>
          <h1 className="mt-3 font-normal" style={{ ...serif, color: INK, fontSize: "clamp(28px, 4vw, 40px)", letterSpacing: "-0.02em" }}>{intro.title}</h1>
          {intro.subtitle ? <p className="mt-3 text-[16px] leading-7" style={{ color: SUB }}>{intro.subtitle}</p> : null}
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
              {intro.subtitle ? (
                <>
                  <h3 className="text-[15px] font-semibold" style={{ color: INK }}>강좌 목표</h3>
                  <p className="mb-6 mt-2 text-[15px] leading-8" style={{ color: SUB }}>{intro.subtitle}</p>
                </>
              ) : null}
              <h3 className="text-[15px] font-semibold" style={{ color: INK }}>강좌 설명</h3>
              <p className="mt-2 whitespace-pre-line text-[15px] leading-8" style={{ color: SUB }}>{intro.summary}</p>
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
                <p className="mt-2 text-[13.5px] leading-6" style={{ color: SUB }}>이 강좌는 정해진 요일·시간에 화상으로 진행되는 실시간 수업입니다. 강좌 일정을 확인하고 신청해 주세요.</p>

                <p className="mt-5 text-[14px] font-semibold" style={{ color: INK }}>수업 일정</p>
                <p className="mt-1 text-[13.5px]" style={{ color: SUB }}>{intro.classDays ?? "-"}</p>

                {status ? (
                  <>
                    <p className="mt-4 text-[14px] font-semibold" style={{ color: INK }}>신청 현황</p>
                    <p className="mt-1 text-[13.5px]" style={{ color: SUB }}>
                      <b style={{ color: full ? "#a6402c" : BROWN }}>{status.applied}</b> / {status.capacity}명
                    </p>
                    <p className="mt-4 flex items-center gap-1.5 text-[14px] font-bold" style={{ color: enrolled ? BROWN : full ? "#a6402c" : "#3E7E5B" }}>
                      <span style={{ fontSize: 10 }}>●</span>
                      {enrolled ? "수강신청 완료" : full ? "모집 마감" : "모집 중"}
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
    deliveryMode: stored.deliveryMode,
    periodLabel: stored.periodLabel,
    country: stored.country,
    summary: stored.summary,
    instructor: { name: "우아재 서재", initials: "齋" },
    modules: stored.modules.map((m) => ({ label: m.label, sessions: (m.lessons ?? []).map((l) => ({ title: l.title })) })),
  };
}
