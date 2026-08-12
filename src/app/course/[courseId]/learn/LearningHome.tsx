"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { BookOpen, ClipboardList, Folder, MessageSquare, Check, ChevronDown, ChevronUp, Lock } from "lucide-react";
import { getCourse, isModuleLocked, weekOpenLabel, weekPeriodLabel, type Course, type ActivityKind } from "@/lib/course/content";
import { getStoredCourse, type StoredCourse } from "@/lib/course/store";
import { CompletionProvider, useCompletion } from "@/components/course/completion";

const BROWN = "#8C6E59";
const NUM = "#B58F72";
const INK = "#2C2823";
const BODY = "#223039";
const SUB = "#8A8479";
const LINE = "#E4DBC7";
const PANEL = "#FBF8F2";
const serif = { fontFamily: "var(--font-serif)" } as const;
const heroGrad = "linear-gradient(135deg, #A98B6E, #6B5342)";

type ClassLesson = { id: string; title: string; kind: string; durationMin?: number; scheduleLabel?: string; completable: boolean };
type ClassModule = { label: string; locked: boolean; periodLabel?: string; openLabel?: string; lessons: ClassLesson[] };
type Classroom = { id: string; title: string; programme: string; instructor: string; summary: string; modules: ClassModule[] };

function fromSeed(c: Course, isStaff = false): Classroom {
  return {
    id: c.id,
    title: c.title,
    programme: c.programme,
    instructor: c.instructor.name,
    summary: c.summary,
    modules: c.modules.map((m) => ({
      label: m.label,
      locked: isModuleLocked(m, Date.now(), isStaff),
      periodLabel: m.weekStart ? weekPeriodLabel(m.weekStart, m.weekEnd) : undefined,
      openLabel: m.weekStart ? weekOpenLabel(m.weekStart) : undefined,
      lessons: m.blocks.flatMap((b) => b.activities).map((a) => ({ id: a.id, title: a.title, kind: a.kind as ActivityKind, durationMin: a.durationMin, scheduleLabel: a.scheduleLabel, completable: a.completion !== "none" })),
    })),
  };
}
function fromStored(c: StoredCourse): Classroom {
  return {
    id: c.id,
    title: c.title,
    programme: c.programme || "우아재 강좌",
    instructor: "우아재",
    summary: c.summary,
    modules: c.modules.map((m) => ({ label: m.label, locked: false, lessons: (m.lessons ?? []).map((l) => ({ id: l.id, title: l.title, kind: l.kind, completable: true })) })),
  };
}

const KIND_LABEL: Record<string, string> = { page: "강의자료", resource: "강의자료", material: "강의자료", folder: "자료실", assignment: "과제", forum: "토론" };
function KindIcon({ kind }: { kind: string }) {
  const I = kind === "assignment" ? ClipboardList : kind === "folder" ? Folder : kind === "forum" ? MessageSquare : BookOpen;
  return <I size={18} style={{ color: BROWN }} />;
}

export default function LearningHome({ courseId, isStaff = false }: { courseId: string; isStaff?: boolean }) {
  const seedRoom = useMemo(() => {
    const c = getCourse(courseId);
    return c ? fromSeed(c, isStaff) : null;
  }, [courseId, isStaff]);
  const [room, setRoom] = useState<Classroom | null>(seedRoom);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!seedRoom) {
      const s = getStoredCourse(courseId);
      if (s) setRoom(fromStored(s));
    }
    setReady(true);
  }, [courseId, seedRoom]);

  if (!room) return <div className="mx-auto max-w-[640px] px-6 py-40 text-center" style={{ color: SUB }}>{ready ? "강좌를 찾을 수 없습니다." : "불러오는 중…"}</div>;

  return (
    <CompletionProvider courseId={courseId}>
      <div className="flex w-full flex-1 items-start" style={{ background: "#fff" }}>
        <Sidebar room={room} />
        <Content room={room} />
      </div>
    </CompletionProvider>
  );
}

/* ── 왼쪽 사이드바 ── */
function Sidebar({ room }: { room: Classroom }) {
  const { done } = useCompletion();
  const completable = room.modules.flatMap((m) => m.lessons).filter((l) => l.completable);
  const pct = completable.length ? Math.round((completable.filter((l) => done.has(l.id)).length / completable.length) * 100) : 0;
  const [open, setOpen] = useState<number>(0);

  return (
    <aside className="sticky top-[68px] hidden w-[320px] shrink-0 self-start overflow-y-auto border-r lg:block" style={{ borderColor: LINE, maxHeight: "calc(100vh - 68px)" }}>
      {/* 헤더 밴드 + 진도 도넛 */}
      <div className="flex items-center gap-3 px-5 py-6 text-white" style={{ background: heroGrad }}>
        <h1 className="min-w-0 flex-1 text-[18px] font-semibold leading-snug" style={serif}>{room.title}</h1>
        <Donut percent={pct} />
      </div>

      <div className="px-5 py-5">
        {/* 강좌 소개 */}
        <h2 className="text-[13px] font-semibold" style={{ ...serif, color: BROWN }}>강좌 소개</h2>
        <p className="mt-2 text-[12.5px] leading-5" style={{ color: SUB }}>{room.summary}</p>

        {/* 공지 · 토론 · 탐구활동 멘토링 */}
        <div className="mt-5 space-y-2">
          <SideBox label="공지사항" href={`/course/${room.id}/notices`} />
          <SideBox label="수강생 토론 게시판" href={`/course/${room.id}/board`} />
          <SideBox label="탐구활동 멘토링" href={`/course/${room.id}/mentoring`} />
        </div>

        <div className="my-4 border-t" style={{ borderColor: LINE }} />

        {/* 커리큘럼 아코디언 */}
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

/* ── 오른쪽 콘텐츠 ── */
function Content({ room }: { room: Classroom }) {
  const { done } = useCompletion();

  return (
    <div className="min-w-0 flex-1 px-6 py-12 md:px-14">
      <div className="mx-auto max-w-[720px]">
        <p className="text-[12px] font-semibold uppercase" style={{ letterSpacing: "0.24em", color: NUM }}>MY CLASSROOM</p>
        <h2 className="mt-3 font-normal" style={{ ...serif, color: INK, fontSize: "clamp(24px, 3.4vw, 32px)", letterSpacing: "-0.02em" }}>강의실</h2>

        {/* 커리큘럼 */}
        <div className="mt-14 space-y-9">
          {room.modules.map((m, mi) => (
            <div key={mi}>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-[13px]" style={{ color: NUM }}>{String(mi + 1).padStart(2, "0")}</span>
                <h3 className="text-[18px]" style={{ ...serif, color: INK }}>{m.label}</h3>
                {m.periodLabel ? <span className="text-[12px]" style={{ color: SUB }}>{m.periodLabel}</span> : null}
                {m.locked ? (
                  <span className="inline-flex items-center gap-1 text-[12px] font-medium" style={{ color: "#a6402c" }}>
                    <Lock size={12} /> {m.openLabel}
                  </span>
                ) : null}
              </div>
              <div className="mt-2">
                {m.lessons.length === 0 ? <p className="py-3 pl-9 text-[14px]" style={{ color: SUB }}>등록된 강의가 없습니다.</p> : m.lessons.map((l) => <LessonRow key={l.id} courseId={room.id} lesson={l} isDone={done.has(l.id)} locked={m.locked} />)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LessonRow({ courseId, lesson, isDone, locked }: { courseId: string; lesson: ClassLesson; isDone: boolean; locked: boolean }) {
  const inner = (
    <>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px]" style={{ background: PANEL }}>
        <KindIcon kind={lesson.kind} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px]" style={{ color: BODY }}>{lesson.title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px]" style={{ color: SUB }}>
          {lesson.scheduleLabel ? <><span style={{ color: BROWN }}>{lesson.scheduleLabel}</span><span style={{ color: "#ddd" }}>·</span></> : null}
          <span>{KIND_LABEL[lesson.kind] ?? "강의"}</span>
          {lesson.durationMin ? <><span style={{ color: "#ddd" }}>·</span><span>학습 {lesson.durationMin}분</span></> : null}
        </span>
      </span>
      {locked ? (
        <span className="inline-flex items-center gap-1 text-[13px]" style={{ color: "#b9a99a" }}><Lock size={13} /> 잠김</span>
      ) : isDone ? (
        <span className="inline-flex items-center gap-1 text-[13px] font-bold" style={{ color: BROWN }}><Check size={14} strokeWidth={3} /> 완료</span>
      ) : (
        <span className="text-[13px]" style={{ color: "#c9c2b6" }}>미완료</span>
      )}
    </>
  );

  if (locked) {
    return (
      <div className="flex cursor-not-allowed items-center gap-4 border-b py-4" style={{ borderColor: "#F0EBE0", opacity: 0.55 }}>
        {inner}
      </div>
    );
  }
  return (
    <Link href={`/course/${courseId}/a/${lesson.id}`} className="flex items-center gap-4 border-b py-4 transition hover:opacity-70" style={{ borderColor: "#F0EBE0" }}>
      {inner}
    </Link>
  );
}
