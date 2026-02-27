"use client";

import { useRef } from "react";
import PosterCard from "@/components/category/PosterCard";
import { useHorizontalScroll } from "@/components/home/useHorizontalScroll";
import { MockProject } from "@/lib/mockProjects";

type Props = {
  title: string;
  items: MockProject[];
  rankingStart?: number;
};

function ArrowButton({ direction, onClick }: { direction: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hidden h-8 w-8 items-center justify-center rounded-full bg-black/40 text-slate-300 transition hover:bg-black/60 hover:text-slate-100 md:inline-flex"
      aria-label={direction === "left" ? "이전" : "다음"}
    >
      {direction === "left" ? "‹" : "›"}
    </button>
  );
}

export default function PosterRail({ title, items, rankingStart }: Props) {
  const railRef = useRef<HTMLDivElement>(null);
  const { scrollNext, scrollPrev } = useHorizontalScroll(railRef);

  if (!items.length) return null;

  return (
    <section className="group/rail space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
        <div className="flex items-center gap-2 opacity-0 transition group-hover/rail:opacity-100">
          <ArrowButton direction="left" onClick={scrollPrev} />
          <ArrowButton direction="right" onClick={scrollNext} />
        </div>
      </div>

      <div ref={railRef} className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item, index) => (
          <PosterCard key={item.id} item={item} rank={typeof rankingStart === "number" ? rankingStart + index : undefined} />
        ))}
      </div>
    </section>
  );
}
