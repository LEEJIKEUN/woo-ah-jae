"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Lock, ClipboardCheck, MonitorPlay, Menu, X } from "lucide-react";
import { getCourse, isModuleLocked, weekOpenLabel, weekActivationMs, type Course } from "@/lib/course/content";
import { getStoredCourse, type StoredCourse } from "@/lib/course/store";
import { CompletionProvider, useCompletion } from "@/components/course/completion";
import CourseSummaryBox from "@/components/course/CourseSummaryBox";
import ParentProgressDonut from "@/components/course/ParentProgressDonut";

/**
 * 강의실(LearningHome) 좌측 사이드바를 다른 페이지(탐구활동 멘토링 등)에서도
 * 그대로 재사용하기 위한 컴포넌트. 강좌명·진도 도넛·강좌 소개·공지/토론/멘토링·커리큘럼.
 */
const BROWN = "#8C6E59";
const INK = "#2C2823";
const SUB = "#8A8479";
const LINE = "#E4DBC7";
const serif = { fontFamily: "var(--font-serif)" } as const;
const heroGrad = "linear-gradient(135deg, #A98B6E, #6B5342)";

type ClassLesson = { id: string; title: string };
type ClassModule = { label: string; locked: boolean; openLabel?: string; completableIds: string[]; lessons: ClassLesson[] };
type Classroom = { id: string; title: string; summary: string; format?: string; modules: ClassModule[] };

function fromSeed(c: Course, isStaff = false): Classroom {
  return {
    id: c.id,
    title: c.title,
    summary: c.summary,
    format: c.format,
    modules: c.modules.map((m) => {
      const acts = m.blocks.flatMap((b) => b.activities);
      return {
        label: m.label,
        locked: isModuleLocked(m, Date.now(), isStaff),
        openLabel: m.weekStart ? weekOpenLabel(m.weekStart) : undefined,
        completableIds: acts.filter((a) => a.completion !== "none").map((a) => a.id),
        lessons: acts.map((a) => ({ id: a.id, title: a.title })),
      };
    }),
  };
}
function fromStored(c: StoredCourse): Classroom {
  return {
    id: c.id,
    title: c.title,
    summary: c.summary,
    modules: c.modules.map((m) => ({
      label: m.label,
      locked: false,
      completableIds: (m.lessons ?? []).map((l) => l.id),
      lessons: (m.lessons ?? []).map((l) => ({ id: l.id, title: l.title })),
    })),
  };
}

export default function ClassroomSidebar({ courseId, isStaff = false, isParent = false }: { courseId: string; isStaff?: boolean; isParent?: boolean }) {
  const seedRoom = useMemo(() => {
    const c = getCourse(courseId);
    return c ? fromSeed(c, isStaff) : null;
  }, [courseId, isStaff]);
  const [room, setRoom] = useState<Classroom | null>(seedRoom);
  useEffect(() => {
    if (!seedRoom) {
      const s = getStoredCourse(courseId);
      if (s) setRoom(fromStored(s));
    }
  }, [courseId, seedRoom]);

  // 편집(강좌명·커리큘럼)을 사이드바에 반영: 실효 강좌명 + 차시 편집 반영(없으면 하드코딩과 동일)
  useEffect(() => {
    if (!seedRoom) return; // 하드코딩 강좌만 대상
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/courses/${courseId}/curriculum`, { cache: "no-store" });
        if (!res.ok) return;
        const d = (await res.json()) as { title?: string; format?: string; modules?: { label: string; weekStart?: string; sessions: { id: string; title: string; completable?: boolean }[] }[] };
        if (!alive || !d.modules) return;
        const nowMs = Date.now();
        const mods: ClassModule[] = d.modules.map((m) => ({
          label: m.label,
          locked: !!m.weekStart && !isStaff && nowMs < weekActivationMs(m.weekStart),
          openLabel: m.weekStart ? weekOpenLabel(m.weekStart) : undefined,
          completableIds: m.sessions.filter((s) => s.completable !== false).map((s) => s.id),
          lessons: m.sessions.map((s) => ({ id: s.id, title: s.title })),
        }));
        setRoom((prev) => (prev ? { ...prev, title: d.title ?? prev.title, format: d.format ?? prev.format, modules: mods } : prev));
      } catch {
        /* 무시 — 하드코딩 유지 */
      }
    })();
    return () => { alive = false; };
  }, [courseId, isStaff, seedRoom]);

  // 관리형·자기주도: 도넛 %를 '내 수강 현황' 페이지와 동일하게(완강=100% 시청 / 전체 동영상) 계산·폴링.
  // 실시간수업은 기존 완료(LessonCompletion) 기준 유지.
  const watchFormat = room?.format === "자기주도학습" || room?.format === "관리형학습";
  const [watchPct, setWatchPct] = useState<number | null>(null);
  useEffect(() => {
    if (!watchFormat || isStaff || isParent) { setWatchPct(null); return; }
    let alive = true;
    const pull = async () => {
      try {
        const res = await fetch(`/api/courses/${courseId}/watch/me`, { cache: "no-store" });
        if (!res.ok || !alive) return;
        const d = (await res.json()) as { sessions?: { watchedSec: number; totalSec: number }[] };
        const sessions = d.sessions ?? [];
        const done = sessions.filter((s) => s.totalSec > 0 && s.watchedSec >= s.totalSec).length;
        if (alive) setWatchPct(sessions.length ? Math.round((done / sessions.length) * 100) : 0);
      } catch {
        /* 무시 */
      }
    };
    void pull();
    const t = setInterval(() => void pull(), 4000);
    return () => { alive = false; clearInterval(t); };
  }, [courseId, watchFormat, isStaff, isParent]);

  if (!room) return null;
  return (
    <CompletionProvider courseId={courseId}>
      <SidebarInner room={room} isStaff={isStaff} isParent={isParent} watchPct={watchPct} />
    </CompletionProvider>
  );
}

function SidebarInner({ room, isStaff = false, isParent = false, watchPct = null }: { room: Classroom; isStaff?: boolean; isParent?: boolean; watchPct?: number | null }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* 데스크톱(lg+): 좌측 고정 사이드바 */}
      <aside className="sticky top-[68px] hidden w-[320px] shrink-0 self-start overflow-y-auto border-r lg:block" style={{ borderColor: LINE, maxHeight: "calc(100vh - 68px)" }}>
        <SidebarContent room={room} isStaff={isStaff} isParent={isParent} watchPct={watchPct} />
      </aside>

      {/* 모바일: 좌하단 '강의 메뉴' 토글 버튼 */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed bottom-5 left-4 z-40 flex items-center gap-1.5 rounded-full px-4 py-3 text-[13px] font-bold text-white shadow-lg lg:hidden"
        style={{ background: BROWN }}
        aria-label="강의 메뉴 열기"
      >
        <Menu size={16} /> 강의 메뉴
      </button>

      {/* 모바일: 배경 오버레이 */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 lg:hidden ${mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden={!mobileOpen}
      />

      {/* 모바일: 좌측 슬라이드 드로어 */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-[86%] max-w-[340px] transform overflow-y-auto bg-white shadow-2xl transition-transform duration-300 lg:hidden ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
        role="dialog"
        aria-modal="true"
        aria-label="강의 메뉴"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-4 py-3" style={{ borderColor: LINE }}>
          <span className="text-[14px] font-bold" style={{ color: INK }}>강의 메뉴</span>
          <button type="button" onClick={() => setMobileOpen(false)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-[#F0EBE0]" style={{ color: SUB }} aria-label="닫기"><X size={18} /></button>
        </div>
        <SidebarContent room={room} isStaff={isStaff} isParent={isParent} watchPct={watchPct} onNavigate={() => setMobileOpen(false)} />
      </div>
    </>
  );
}

function SidebarContent({ room, isStaff = false, isParent = false, watchPct = null, onNavigate }: { room: Classroom; isStaff?: boolean; isParent?: boolean; watchPct?: number | null; onNavigate?: () => void }) {
  const { done } = useCompletion();
  const completable = room.modules.flatMap((m) => m.completableIds);
  const completionPct = completable.length ? Math.round((completable.filter((id) => done.has(id)).length / completable.length) * 100) : 0;
  // 관리형·자기주도: '내 수강 현황'과 동일한 시청 진도율(watchPct), 그 외(실시간)는 완료 기준
  const watchFormat = room.format === "자기주도학습" || room.format === "관리형학습";
  const pct = watchFormat && watchPct != null ? watchPct : completionPct;
  const [open, setOpen] = useState<number>(0);

  return (
    <>
      <div className="flex items-center gap-2 px-5 py-6 text-white" style={{ background: heroGrad }}>
        <Link href={`/course/${room.id}/learn`} onClick={onNavigate} className="min-w-0 flex-1 truncate text-[18px] font-semibold leading-snug transition hover:underline" style={serif} title="강의실 홈으로">
          <h1 className="truncate">{room.title}</h1>
        </Link>
        {isParent ? (
          <ParentProgressDonut courseId={room.id} />
        ) : isStaff ? (
          // 형식별: 실시간수업=출석·이수 관리 / 관리형·자기주도=강의 수강 현황
          room.format === "자기주도학습" || room.format === "관리형학습" ? (
            <Link href={`/course/${room.id}/watch`} onClick={onNavigate} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/20 transition hover:bg-white/30" title="강의 수강 현황" aria-label="강의 수강 현황"><MonitorPlay size={19} /></Link>
          ) : (
            <Link href={`/course/${room.id}/attendance`} onClick={onNavigate} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/20 transition hover:bg-white/30" title="출석 체크" aria-label="출석 체크"><ClipboardCheck size={19} /></Link>
          )
        ) : room.format === "자기주도학습" || room.format === "관리형학습" ? (
          // 관리형·자기주도: 학생 진도율 도넛 → 내 수강 현황 페이지
          <Link href={`/course/${room.id}/my-progress`} onClick={onNavigate} className="shrink-0 rounded-full transition hover:opacity-90" title="내 수강 현황 보기" aria-label="내 수강 현황 보기"><Donut percent={pct} /></Link>
        ) : (
          <Donut percent={pct} />
        )}
      </div>

      <div className="px-5 py-5">
        <CourseSummaryBox courseId={room.id} initialSummary={room.summary} isStaff={isStaff} />

        <div className="mt-5 space-y-2">
          <SideBox label="공지사항" href={`/course/${room.id}/notices`} onNavigate={onNavigate} />
          <SideBox label="수강생 토론 게시판" href={`/course/${room.id}/board`} onNavigate={onNavigate} />
          {/* 자기주도학습 형식은 멘토링·세특 잠금 */}
          {room.format !== "자기주도학습" ? <SideBox label="탐구활동 멘토링" href={`/course/${room.id}/mentoring`} onNavigate={onNavigate} /> : null}
          <SideBox label="시험" href={`/course/${room.id}/exam`} onNavigate={onNavigate} />
          {isStaff && room.format !== "자기주도학습" ? <SideBox label="세특·과제 현황" href={`/course/${room.id}/status`} onNavigate={onNavigate} /> : null}
          {isStaff ? <SideBox label="강의 수강 현황" href={`/course/${room.id}/watch`} onNavigate={onNavigate} /> : null}
        </div>

        <div className="my-4 border-t" style={{ borderColor: LINE }} />

        <h2 className="mb-2 text-[13px] font-semibold" style={{ ...serif, color: BROWN }}>커리큘럼</h2>
        <div className="space-y-2">
          {room.modules.map((m, mi) => {
            const isOpen = open === mi;
            return (
              <div key={mi}>
                <button type="button" onClick={() => setOpen(isOpen ? -1 : mi)} className="flex h-11 w-full items-center justify-between rounded-[8px] border px-3.5 text-left text-[13.5px] font-bold" style={{ borderColor: isOpen ? BROWN : LINE, color: m.locked ? SUB : isOpen ? BROWN : INK }}>
                  <span className="flex min-w-0 items-center gap-1.5">
                    {m.locked ? <Lock size={12} className="shrink-0" style={{ color: "#a6402c" }} /> : null}
                    <span className="truncate">{m.label}</span>
                  </span>
                  {isOpen ? <ChevronUp size={15} className="shrink-0" /> : <ChevronDown size={15} className="shrink-0" style={{ color: SUB }} />}
                </button>
                {isOpen ? (
                  <ul className="space-y-2 px-2 pb-1 pt-3">
                    {m.locked ? (
                      <li className="text-[12px]" style={{ color: "#a6402c" }}>🔒 {m.openLabel} 개설 예정</li>
                    ) : m.lessons.length === 0 ? (
                      <li className="text-[12px]" style={{ color: SUB }}>준비 중</li>
                    ) : (
                      m.lessons.map((l) => {
                        const d = done.has(l.id);
                        const inner = (
                          <>
                            <span className="mt-0.5 inline-block h-3 w-3 shrink-0 rounded-full border-2" style={{ borderColor: BROWN, background: d ? BROWN : "transparent" }} />
                            <span className="min-w-0">{l.title}</span>
                          </>
                        );
                        return (
                          <li key={l.id}>
                            {isParent ? (
                              <span className="flex cursor-default items-start gap-2 text-[12.5px] leading-5" style={{ color: SUB }}>{inner}</span>
                            ) : (
                              <Link href={`/course/${room.id}/a/${l.id}`} onClick={onNavigate} className="flex items-start gap-2 text-[12.5px] leading-5 hover:underline" style={{ color: SUB }}>{inner}</Link>
                            )}
                          </li>
                        );
                      })
                    )}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function Donut({ percent }: { percent: number }) {
  const r = 20, c = 2 * Math.PI * r, off = c * (1 - percent / 100);
  return (
    <svg width={44} height={44} viewBox="0 0 48 48" className="shrink-0">
      <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="4" />
      <circle cx="24" cy="24" r={r} fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 24 24)" />
      <text x="24" y="24" textAnchor="middle" dominantBaseline="central" style={{ fill: "#fff", fontSize: 12, fontWeight: 700 }}>{percent}%</text>
    </svg>
  );
}
function SideBox({ label, href, icon, onNavigate }: { label: string; href?: string; icon?: ReactNode; onNavigate?: () => void }) {
  const cls = "flex h-11 w-full items-center gap-2 rounded-[8px] border px-4 text-left text-[13.5px] font-bold transition hover:border-[#8C6E59]";
  const st = { borderColor: LINE, color: INK } as const;
  const inner = (
    <>
      {icon}
      {label}
    </>
  );
  if (href) return <Link href={href} onClick={onNavigate} className={cls} style={st}>{inner}</Link>;
  return <button type="button" className={cls} style={st}>{inner}</button>;
}
