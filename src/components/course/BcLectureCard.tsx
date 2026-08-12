"use client";

import Link from "next/link";
import { BookOpen, Folder, ClipboardList, MessageSquare, ChevronRight, Check } from "lucide-react";
import type { Activity, ActivityKind } from "@/lib/course/content";
import { courseActivityHref } from "@/lib/course/content";
import { BC } from "@/lib/course/theme";
import { useCompletion } from "./completion";

const KIND: Record<ActivityKind, { label: string; Icon: typeof BookOpen }> = {
  page: { label: "페이지", Icon: BookOpen },
  resource: { label: "강의자료", Icon: BookOpen },
  folder: { label: "자료실", Icon: Folder },
  assignment: { label: "과제", Icon: ClipboardList },
  forum: { label: "토론", Icon: MessageSquare },
};

/** 부스트코스 강의 카드 — 타일 아이콘 + 제목 + 메타 + ›. hover 시 시안 보더. */
export default function BcLectureCard({
  courseId,
  activity,
  index,
}: {
  courseId: string;
  activity: Activity;
  index: number;
}) {
  const { isDone } = useCompletion();
  const done = isDone(activity.id);
  const { label, Icon } = KIND[activity.kind];
  const num = String(index + 1).padStart(2, "0");

  return (
    <Link
      href={courseActivityHref(courseId, activity.id)}
      className="group flex items-center gap-4 rounded-[4px] border bg-white px-4 py-4 transition-colors"
      style={{ borderColor: BC.borderCard }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = BC.accent)}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = BC.borderCard)}
    >
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-[4px]" style={{ background: BC.tile }}>
        <Icon size={22} style={{ color: BC.tileIcon }} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px]" style={{ color: BC.ink }}>
          {num}. {activity.title}
        </span>
        <span className="mt-1 flex items-center gap-2 text-[11px]" style={{ color: BC.meta }}>
          <span>{label}</span>
          {activity.durationMin ? (
            <>
              <span style={{ color: "#E0E0E0" }}>|</span>
              <span>학습 {activity.durationMin}분</span>
            </>
          ) : null}
          {done ? (
            <>
              <span style={{ color: "#E0E0E0" }}>|</span>
              <span className="inline-flex items-center gap-0.5 font-bold" style={{ color: BC.accentInk }}>
                <Check size={11} strokeWidth={3} /> 완료
              </span>
            </>
          ) : null}
        </span>
      </span>

      <ChevronRight size={20} className="shrink-0" style={{ color: BC.meta }} />
    </Link>
  );
}
