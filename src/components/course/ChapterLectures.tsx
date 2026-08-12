"use client";

import { useMemo, useState } from "react";
import { HelpCircle, Search } from "lucide-react";
import type { Course, Module } from "@/lib/course/content";
import { BC } from "@/lib/course/theme";
import BcLectureCard from "./BcLectureCard";

/** 코스 홈 우측 콘텐츠 — 챕터명 + 역순정렬/검색 + 섹션별 강의 카드 리스트. */
export default function ChapterLectures({ course, module }: { course: Course; module: Module }) {
  const [reverse, setReverse] = useState(false);
  const [query, setQuery] = useState("");

  // 모듈 내 활동 전역 인덱스(번호용)
  const indexOf = useMemo(() => {
    const map = new Map<string, number>();
    let i = 0;
    for (const b of module.blocks) for (const a of b.activities) map.set(a.id, i++);
    return map;
  }, [module]);

  const q = query.trim();
  const blocks = module.blocks
    .map((b) => {
      let acts = b.activities.filter((a) => !q || a.title.includes(q));
      if (reverse) acts = [...acts].reverse();
      return { banner: b.banner, activities: acts };
    })
    .filter((b) => b.activities.length > 0);

  return (
    <div>
      {/* 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-[28px] font-extrabold md:text-[32px]" style={{ color: BC.ink }}>
          {module.label}
          <HelpCircle size={20} style={{ color: BC.meta }} />
        </h1>
        {module.blocks.length > 0 ? (
          <div className="flex items-center gap-4">
            <label className="flex cursor-pointer items-center gap-1.5 text-[14px]" style={{ color: BC.ink }}>
              <input
                type="checkbox"
                checked={reverse}
                onChange={(e) => setReverse(e.target.checked)}
                className="h-4 w-4 accent-[#8C6E59]"
              />
              역순 정렬
            </label>
            <div className="flex items-center gap-2 rounded-[20px] px-3.5 py-2" style={{ background: BC.borderCard }}>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="제목을 입력하세요."
                className="w-40 bg-transparent text-[13px] outline-none"
                style={{ color: BC.ink }}
              />
              <Search size={15} style={{ color: BC.meta }} />
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-5 border-t" style={{ borderColor: BC.borderCard }} />

      {/* 강의 리스트 */}
      {module.blocks.length === 0 ? (
        <p className="mt-16 text-center text-[15px]" style={{ color: BC.meta }}>
          아직 준비 중인 챕터입니다. 곧 강의가 열립니다.
        </p>
      ) : blocks.length === 0 ? (
        <p className="mt-16 text-center text-[15px]" style={{ color: BC.meta }}>
          &lsquo;{q}&rsquo; 검색 결과가 없습니다.
        </p>
      ) : (
        <div className="mt-8 space-y-8">
          {blocks.map((b, bi) => (
            <section key={bi}>
              <p className="mb-3 text-[13px]" style={{ color: BC.meta }}>
                {b.banner}
              </p>
              <div className="space-y-4">
                {b.activities.map((a) => (
                  <BcLectureCard key={a.id} courseId={course.id} activity={a} index={indexOf.get(a.id) ?? 0} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
