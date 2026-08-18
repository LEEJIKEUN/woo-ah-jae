"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, ClipboardList, Folder, MessageSquare, Check, Lock } from "lucide-react";
import { getCourse, isModuleLocked, weekOpenLabel, weekPeriodLabel, type Course, type ActivityKind } from "@/lib/course/content";
import { getStoredCourse, type StoredCourse } from "@/lib/course/store";
import { CompletionProvider, useCompletion } from "@/components/course/completion";
import ClassroomSidebar from "@/components/course/ClassroomSidebar";

const BROWN = "#8C6E59";
const NUM = "#B58F72";
const INK = "#2C2823";
const BODY = "#223039";
const SUB = "#8A8479";
const PANEL = "#FBF8F2";
const serif = { fontFamily: "var(--font-serif)" } as const;

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

export default function LearningHome({ courseId, course, isStaff = false, isParent = false }: { courseId: string; course?: Course; isStaff?: boolean; isParent?: boolean }) {
  const seedRoom = useMemo(() => {
    const c = course ?? getCourse(courseId); // 서버가 넘긴 실효 강좌(커리큘럼 편집 반영) 우선
    return c ? fromSeed(c, isStaff) : null;
  }, [courseId, course, isStaff]);
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
        <ClassroomSidebar courseId={courseId} isStaff={isStaff} isParent={isParent} />
        <Content room={room} isParent={isParent} />
      </div>
    </CompletionProvider>
  );
}

/* ── 오른쪽 콘텐츠 ── */
function Content({ room, isParent = false }: { room: Classroom; isParent?: boolean }) {
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
                {m.lessons.length === 0 ? <p className="py-3 pl-9 text-[14px]" style={{ color: SUB }}>등록된 강의가 없습니다.</p> : m.lessons.map((l) => <LessonRow key={l.id} courseId={room.id} lesson={l} isDone={done.has(l.id)} locked={m.locked} isParent={isParent} />)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LessonRow({ courseId, lesson, isDone, locked, isParent = false }: { courseId: string; lesson: ClassLesson; isDone: boolean; locked: boolean; isParent?: boolean }) {
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
  if (isParent) {
    // 학부모 뷰어: 레슨 열람(이동) 차단
    return (
      <div className="flex cursor-default items-center gap-4 border-b py-4" style={{ borderColor: "#F0EBE0" }}>
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
