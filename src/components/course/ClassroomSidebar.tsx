"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Lock } from "lucide-react";
import { getCourse, isModuleLocked, weekOpenLabel, type Course } from "@/lib/course/content";
import { getStoredCourse, type StoredCourse } from "@/lib/course/store";
import { CompletionProvider, useCompletion } from "@/components/course/completion";

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
type Classroom = { id: string; title: string; summary: string; modules: ClassModule[] };

function fromSeed(c: Course, isStaff = false): Classroom {
  return {
    id: c.id,
    title: c.title,
    summary: c.summary,
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

  if (!room) return null;
  // 학부모: 자녀 학습 현황 + 탐구활동 멘토링 두 가지만
  if (isParent) return <ParentSidebar room={room} />;
  return (
    <CompletionProvider courseId={courseId}>
      <SidebarInner room={room} />
    </CompletionProvider>
  );
}

function ParentSidebar({ room }: { room: Classroom }) {
  return (
    <aside className="sticky top-[68px] hidden w-[320px] shrink-0 self-start overflow-y-auto border-r lg:block" style={{ borderColor: LINE, maxHeight: "calc(100vh - 68px)" }}>
      <div className="flex items-center gap-3 px-5 py-6 text-white" style={{ background: heroGrad }}>
        <h1 className="min-w-0 flex-1 text-[18px] font-semibold leading-snug" style={serif}>{room.title}</h1>
      </div>
      <div className="space-y-2 px-5 py-5">
        <p className="mb-1 text-[12px]" style={{ color: SUB }}>학부모 메뉴</p>
        <SideBox label="자녀 학습 현황" href="/me/children" />
        <SideBox label="탐구활동 멘토링" href={`/course/${room.id}/mentoring`} />
      </div>
    </aside>
  );
}

function SidebarInner({ room }: { room: Classroom }) {
  const { done } = useCompletion();
  const completable = room.modules.flatMap((m) => m.completableIds);
  const pct = completable.length ? Math.round((completable.filter((id) => done.has(id)).length / completable.length) * 100) : 0;
  const [open, setOpen] = useState<number>(0);

  return (
    <aside className="sticky top-[68px] hidden w-[320px] shrink-0 self-start overflow-y-auto border-r lg:block" style={{ borderColor: LINE, maxHeight: "calc(100vh - 68px)" }}>
      <div className="flex items-center gap-3 px-5 py-6 text-white" style={{ background: heroGrad }}>
        <h1 className="min-w-0 flex-1 text-[18px] font-semibold leading-snug" style={serif}>{room.title}</h1>
        <Donut percent={pct} />
      </div>

      <div className="px-5 py-5">
        <h2 className="text-[13px] font-semibold" style={{ ...serif, color: BROWN }}>강좌 소개</h2>
        <p className="mt-2 text-[12.5px] leading-5" style={{ color: SUB }}>{room.summary}</p>

        <div className="mt-5 space-y-2">
          <SideBox label="공지사항" href={`/course/${room.id}/notices`} />
          <SideBox label="수강생 토론 게시판" href={`/course/${room.id}/board`} />
          <SideBox label="탐구활동 멘토링" href={`/course/${room.id}/mentoring`} />
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
                        return (
                          <li key={l.id}>
                            <Link href={`/course/${room.id}/a/${l.id}`} className="flex items-start gap-2 text-[12.5px] leading-5 hover:underline" style={{ color: SUB }}>
                              <span className="mt-0.5 inline-block h-3 w-3 shrink-0 rounded-full border-2" style={{ borderColor: BROWN, background: d ? BROWN : "transparent" }} />
                              <span className="min-w-0">{l.title}</span>
                            </Link>
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
    </aside>
  );
}

function Donut({ percent }: { percent: number }) {
  const r = 20, c = 2 * Math.PI * r, off = c * (1 - percent / 100);
  return (
    <svg width={48} height={48} viewBox="0 0 48 48" className="shrink-0">
      <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="4" />
      <circle cx="24" cy="24" r={r} fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 24 24)" />
      <text x="24" y="24" textAnchor="middle" dominantBaseline="central" style={{ fill: "#fff", fontSize: 12, fontWeight: 700 }}>{percent}%</text>
    </svg>
  );
}
function SideBox({ label, href, icon }: { label: string; href?: string; icon?: ReactNode }) {
  const cls = "flex h-11 w-full items-center gap-2 rounded-[8px] border px-4 text-left text-[13.5px] font-bold transition hover:border-[#8C6E59]";
  const st = { borderColor: LINE, color: INK } as const;
  const inner = (
    <>
      {icon}
      {label}
    </>
  );
  if (href) return <Link href={href} className={cls} style={st}>{inner}</Link>;
  return <button type="button" className={cls} style={st}>{inner}</button>;
}
