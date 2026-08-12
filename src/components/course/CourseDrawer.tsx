"use client";

import Link from "next/link";
import { GraduationCap, MessagesSquare, FolderOpen } from "lucide-react";
import type { Course } from "@/lib/course/content";
import { completableActivityIds, courseActivityHref } from "@/lib/course/content";
import { percentDone } from "@/lib/course/progress";
import { IB } from "@/lib/course/theme";
import { useCompletion } from "./completion";
import ProgressDonut from "./ProgressDonut";

/** 코스 좌측 드로어 — 배너 + 진도 도넛 + 바로가기 + 요약 + 수강생. */
export default function CourseDrawer({ course }: { course: Course }) {
  const { done } = useCompletion();
  const ids = completableActivityIds(course);
  const doneValid = ids.filter((id) => done.has(id)).length;
  const pct = percentDone(doneValid, ids.length);

  const forumId = course.modules.flatMap((m) => m.blocks).flatMap((b) => b.activities).find((a) => a.kind === "forum")?.id;
  const folderId = course.modules.flatMap((m) => m.blocks).flatMap((b) => b.activities).find((a) => a.kind === "folder")?.id;

  return (
    <aside
      className="hidden w-[280px] shrink-0 border-r bg-white lg:block"
      style={{ borderColor: IB.border }}
    >
      <div className="h-[104px]" style={{ background: `linear-gradient(135deg, ${course.bannerFrom}, ${course.bannerTo})` }}>
        <span className="ml-4 mt-3 inline-block rounded-r-full bg-white/95 py-0.5 pl-2.5 pr-3 text-[11px] font-semibold" style={{ color: IB.navy }}>
          {course.programme}
        </span>
      </div>

      <div className="p-4">
        <div className="flex items-start gap-3">
          <h2 className="flex-1 text-[15px] font-bold leading-5" style={{ color: IB.ink }}>
            {course.title}
          </h2>
          <ProgressDonut percent={pct} size={46} />
        </div>

        <div className="mt-3 flex items-center gap-2">
          <QuickIcon label="성적" href={`/course/${course.id}`}>
            <GraduationCap size={17} />
          </QuickIcon>
          <QuickIcon label="토론" href={forumId ? courseActivityHref(course.id, forumId) : `/course/${course.id}`}>
            <MessagesSquare size={17} />
          </QuickIcon>
          <QuickIcon label="자료실" href={folderId ? courseActivityHref(course.id, folderId) : `/course/${course.id}`}>
            <FolderOpen size={17} />
          </QuickIcon>
        </div>

        <div className="mt-4">
          <h3 className="text-[13px] font-semibold" style={{ color: IB.ink }}>
            코스 소개
          </h3>
          <p className="mt-1.5 text-[12.5px] leading-5" style={{ color: IB.muted }}>
            {course.summary}
          </p>
        </div>

        <div className="mt-4">
          <h3 className="text-[13px] font-semibold" style={{ color: IB.ink }}>
            수강생 ({course.enrolled.length})
          </h3>
          <ul className="mt-2 space-y-2">
            {course.enrolled.map((u) => (
              <li key={u.name} className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-full text-[11px] font-semibold text-white" style={{ background: IB.navy }}>
                  {u.initials}
                </span>
                <span className="text-[13px]" style={{ color: IB.body }}>
                  {u.name}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  );
}

function QuickIcon({ label, href, children }: { label: string; href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      className="grid h-9 w-9 place-items-center rounded-md border transition hover:bg-slate-50"
      style={{ borderColor: IB.border, color: IB.navy }}
    >
      {children}
    </Link>
  );
}
