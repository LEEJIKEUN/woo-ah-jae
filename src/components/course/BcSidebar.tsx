"use client";

import Link from "next/link";
import { ChevronDown, ChevronUp, Share2, Link2, SignalHigh, Lock } from "lucide-react";
import type { Course, Module } from "@/lib/course/content";
import { courseActivityHref, isModuleLocked } from "@/lib/course/content";
import { cn } from "@/lib/course/cn";
import { bcHeroGradient, BC } from "@/lib/course/theme";
import { useCompletion } from "./completion";

/** 부스트코스 스타일 좌측 사이드바 (320px). */
export default function BcSidebar({
  course,
  activeModuleId,
  onSelectModule,
  isStaff = false,
}: {
  course: Course;
  activeModuleId: string;
  onSelectModule?: (id: string) => void;
  isStaff?: boolean;
}) {
  return (
    <aside className="hidden w-[320px] shrink-0 border-r bg-white lg:block" style={{ borderColor: BC.borderSide }}>
      {/* 히어로 */}
      <div className="px-5 pb-5 pt-4 text-white" style={{ background: bcHeroGradient }}>
        <p className="flex items-center gap-1.5 text-[12px] font-medium text-white/90">
          <SignalHigh size={14} /> {course.level ?? "기본"}
        </p>
        <h1 className="mt-2 text-[20px] font-semibold leading-tight" style={{ fontFamily: "var(--font-serif)" }}>{course.title}</h1>
        <div className="mt-5 flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-white/25 text-[12px] font-bold">
            {course.instructor.initials}
          </span>
          <span className="flex-1 text-[13px] font-medium">{course.instructor.name}</span>
          <button
            type="button"
            aria-label="공유"
            className="grid h-8 w-8 place-items-center rounded-full bg-white/20 hover:bg-white/30"
          >
            <Share2 size={14} />
          </button>
        </div>
      </div>

      {/* 통계 */}
      <div className="flex items-center justify-center gap-3 border-b py-3 text-[12px]" style={{ borderColor: BC.borderSide }}>
        <span style={{ color: BC.meta }}>
          좋아요 <b style={{ color: BC.accentInk }}>{(course.stats?.likes ?? 0).toLocaleString()}</b>
        </span>
        <span style={{ color: "#E0E0E0" }}>|</span>
        <span style={{ color: BC.meta }}>
          수강생 <b style={{ color: BC.accentInk }}>{(course.stats?.students ?? 0).toLocaleString()}</b>
        </span>
      </div>

      <div className="px-5 py-4">
        {/* 게시판 */}
        <div className="space-y-2">
          <SideBox label="공지게시판" />
          <SideBox label="수강생 토론게시판" />
        </div>

        <div className="my-4 border-t" style={{ borderColor: BC.borderSide }} />

        {/* 챕터 아코디언 */}
        <div className="space-y-2">
          {course.modules.map((m) => (
            <AccordionItem
              key={m.id}
              course={course}
              module={m}
              active={m.id === activeModuleId}
              onSelectModule={onSelectModule}
              isStaff={isStaff}
            />
          ))}
        </div>

        <div className="my-4 border-t" style={{ borderColor: BC.borderSide }} />

        {/* 참고자료 */}
        {course.references && course.references.length > 0 ? (
          <div className="space-y-2">
            <p className="px-1 py-1 text-[14px] font-bold" style={{ color: BC.ink }}>
              참고자료
            </p>
            {course.references.map((r) => (
              <a
                key={r.label}
                href={r.href}
                className="flex h-12 items-center justify-between rounded-[4px] border border-[#F1F1F1] px-4 text-[13px] transition hover:border-[#8C6E59]"
                style={{ color: BC.sub }}
              >
                <span className="truncate">{r.label}</span>
                <Link2 size={14} style={{ color: BC.meta }} />
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function SideBox({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="flex h-12 w-full items-center rounded-[4px] border border-[#F1F1F1] px-4 text-left text-[14px] font-bold transition hover:border-[#8C6E59]"
      style={{ color: BC.ink }}
    >
      {label}
    </button>
  );
}

function AccordionItem({
  course,
  module,
  active,
  onSelectModule,
  isStaff = false,
}: {
  course: Course;
  module: Module;
  active: boolean;
  onSelectModule?: (id: string) => void;
  isStaff?: boolean;
}) {
  const { isDone } = useCompletion();
  const activities = module.blocks.flatMap((b) => b.activities);
  const locked = isModuleLocked(module, Date.now(), isStaff);

  const headerStyle = active
    ? { borderColor: BC.accent, color: BC.accentInk }
    : { borderColor: BC.borderSide, color: BC.ink };
  const headerInner = (
    <>
      <span className="flex items-center gap-1.5 truncate">
        {locked ? <Lock size={12} /> : null}
        {module.label}
      </span>
      {active ? <ChevronUp size={16} /> : <ChevronDown size={16} style={{ color: BC.meta }} />}
    </>
  );

  return (
    <div>
      {onSelectModule ? (
        <button
          type="button"
          onClick={() => onSelectModule(module.id)}
          className="flex h-12 w-full items-center justify-between rounded-[4px] border px-4 text-[14px] font-bold"
          style={headerStyle}
        >
          {headerInner}
        </button>
      ) : (
        <Link
          href={`/course/${course.id}?ch=${module.id}`}
          className="flex h-12 w-full items-center justify-between rounded-[4px] border px-4 text-[14px] font-bold"
          style={headerStyle}
        >
          {headerInner}
        </Link>
      )}

      {active ? (
        <div className="px-1 pb-1 pt-3">
          {activities.length === 0 ? (
            <p className="py-2 text-[13px]" style={{ color: BC.meta }}>
              준비 중인 챕터입니다.
            </p>
          ) : (
            <>
              <p className="mb-2 text-[12px]" style={{ color: BC.meta }}>
                {module.label}
              </p>
              <ul className="space-y-2.5">
                {activities.map((a) => {
                  const done = isDone(a.id);
                  return (
                    <li key={a.id}>
                      <Link
                        href={courseActivityHref(course.id, a.id)}
                        className="flex items-start gap-2 text-[13px] leading-5 hover:underline"
                        style={{ color: BC.sub }}
                      >
                        <span
                          className="mt-0.5 inline-block h-3 w-3 shrink-0 rounded-full border-2"
                          style={{
                            borderColor: BC.accent,
                            background: done ? BC.accent : "transparent",
                          }}
                        />
                        <span className="min-w-0">{a.title}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <Link
                href={`/course/${course.id}?ch=${module.id}`}
                className="mt-3 flex h-9 items-center justify-center rounded-[4px] border text-[12.5px] font-medium"
                style={{ borderColor: BC.borderSide, color: BC.sub }}
              >
                강좌 전체목록보기
              </Link>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
