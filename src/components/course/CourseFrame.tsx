"use client";

import Link from "next/link";
import { Info, ListTree, GraduationCap, StickyNote, LayoutGrid, BookOpen, CalendarDays, HelpCircle } from "lucide-react";
import type { Course } from "@/lib/course/content";
import { railGradient, IB } from "@/lib/course/theme";
import { CompletionProvider } from "./completion";
import CourseDrawer from "./CourseDrawer";

/**
 * 코스 화면 공통 프레임: 완료 컨텍스트 + 좌측 아이콘 레일 + 드로어 + 콘텐츠 슬롯.
 * 코스 홈/활동 상세가 children 으로 각자의 히어로+본문을 넣는다.
 */
export default function CourseFrame({ course, children }: { course: Course; children: React.ReactNode }) {
  return (
    <CompletionProvider courseId={course.id}>
      <div className="flex w-full flex-1">
        <IconRail courseId={course.id} />
        <CourseDrawer course={course} />
        <div className="min-w-0 flex-1" style={{ background: IB.pageBg }}>
          {children}
        </div>
      </div>
    </CompletionProvider>
  );
}

function IconRail({ courseId }: { courseId: string }) {
  const items = [Info, ListTree, GraduationCap, StickyNote, LayoutGrid, BookOpen, CalendarDays];
  return (
    <nav
      className="hidden w-[56px] shrink-0 flex-col items-center gap-1 py-4 text-white md:flex"
      style={{ background: railGradient }}
    >
      {items.map((Icon, i) => (
        <Link
          key={i}
          href={`/course/${courseId}`}
          className="grid h-9 w-9 place-items-center rounded-md text-white/85 transition hover:bg-white/10 hover:text-white"
        >
          <Icon size={18} />
        </Link>
      ))}
      <span className="mt-auto grid h-9 w-9 place-items-center rounded-md text-white/70 hover:bg-white/10">
        <HelpCircle size={18} />
      </span>
    </nav>
  );
}
