"use client";

import { useRef } from "react";
import PosterCard from "@/components/home/PosterCard";
import { HomeProject } from "@/lib/mockProjects";
import { useHorizontalScroll } from "@/components/home/useHorizontalScroll";

type Props = {
  title: string;
  items: HomeProject[];
};

function ArrowButton({ direction, onClick }: { direction: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hidden h-9 w-9 items-center justify-center rounded-full border border-slate-600 bg-slate-900 text-slate-200 transition hover:bg-slate-800 md:inline-flex"
      aria-label={direction === "left" ? "이전" : "다음"}
    >
      {direction === "left" ? "‹" : "›"}
    </button>
  );
}

export default function HorizontalRail({ title, items }: Props) {
  const railRef = useRef<HTMLDivElement>(null);
  const { scrollPrev, scrollNext } = useHorizontalScroll(railRef);

  return (
    <section className="group/rail space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight text-[color:var(--primary)]">{title}</h2>
        <div className="flex items-center gap-2 opacity-0 transition group-hover/rail:opacity-100">
          <ArrowButton direction="left" onClick={scrollPrev} />
          <ArrowButton direction="right" onClick={scrollNext} />
        </div>
      </div>

      <div
        ref={railRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => (
          <PosterCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
