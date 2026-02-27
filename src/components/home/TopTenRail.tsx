"use client";

import { useRef } from "react";
import PosterCard from "@/components/home/PosterCard";
import { HomeProject } from "@/lib/mockProjects";
import { useHorizontalScroll } from "@/components/home/useHorizontalScroll";

type Props = {
  items: HomeProject[];
};

export default function TopTenRail({ items }: Props) {
  const railRef = useRef<HTMLDivElement>(null);
  const { scrollPrev, scrollNext } = useHorizontalScroll(railRef);

  return (
    <section className="group/rail space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight text-[color:var(--primary)]">Trending Top 10</h2>
        <div className="hidden items-center gap-2 opacity-0 transition group-hover/rail:opacity-100 md:flex">
          <button type="button" onClick={scrollPrev} className="h-9 w-9 rounded-full border border-slate-600 bg-slate-900 text-slate-200 transition hover:bg-slate-800">‹</button>
          <button type="button" onClick={scrollNext} className="h-9 w-9 rounded-full border border-slate-600 bg-slate-900 text-slate-200 transition hover:bg-slate-800">›</button>
        </div>
      </div>

      <div ref={railRef} className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item, index) => (
          <PosterCard key={item.id} item={item} rank={index + 1} />
        ))}
      </div>
    </section>
  );
}
