"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Folder, MoreVertical } from "lucide-react";
import type { Course } from "@/lib/course/content";
import { completableActivityIds } from "@/lib/course/content";
import { doneKey, percentDone } from "@/lib/course/progress";
import { BC } from "@/lib/course/theme";

/** 대시보드 코스 카드 — 부스트코스 톤(라이트·시안·플랫). */
export default function CourseCard({ course }: { course: Course }) {
  const total = completableActivityIds(course).length;
  const [done, setDone] = useState(0);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(doneKey(course.id));
      const ids: string[] = raw ? JSON.parse(raw) : [];
      const valid = new Set(completableActivityIds(course));
      setDone(ids.filter((id) => valid.has(id)).length);
    } catch {
      /* ignore */
    }
  }, [course]);

  const pct = percentDone(done, total);

  return (
    <div className="flex w-full max-w-[280px] flex-col overflow-hidden rounded-[6px] border" style={{ borderColor: BC.borderCard }}>
      {/* 썸네일 */}
      <div className="relative aspect-video" style={{ background: "linear-gradient(135deg, #8C6E59, #6B5342)" }}>
        <span className="absolute left-0 top-4 rounded-r-full bg-white py-1 pl-3 pr-4 text-[12px] font-bold" style={{ color: BC.accentInk }}>
          {course.programme}
        </span>
        <button type="button" aria-label="더보기" className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full text-white" style={{ background: "rgba(0,0,0,0.18)" }}>
          <MoreVertical size={16} />
        </button>
        <span className="absolute bottom-3 left-4 text-[22px] font-extrabold tracking-tight text-white/95">우아재</span>
      </div>

      {/* 본문 */}
      <div className="flex flex-1 flex-col p-3.5">
        <Link href={`/course/${course.id}`} className="line-clamp-2 text-[16px] font-semibold leading-6 hover:underline" style={{ color: BC.ink }}>
          {course.title}
        </Link>
        <p className="mt-1.5 flex items-center gap-1.5 text-[13px]" style={{ color: BC.meta }}>
          <Folder size={14} /> {course.category}
        </p>

        <Link
          href={`/course/${course.id}`}
          className="mt-3.5 w-full rounded-[4px] py-2 text-center text-[14px] font-bold text-white transition hover:opacity-95"
          style={{ background: BC.accentInk }}
        >
          이 강의 입장
        </Link>

        <div className="mt-3.5">
          <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "#E9ECEF" }}>
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: BC.accent }} />
          </div>
          <p className="mt-1.5 text-[12px]" style={{ color: BC.meta }}>{pct}% 완료</p>
        </div>
      </div>
    </div>
  );
}
