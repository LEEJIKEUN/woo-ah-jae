"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import ProjectGrid from "@/components/project/ProjectGrid";
import SearchFilterBar, { FilterState } from "@/components/project/SearchFilterBar";
import { CategoryTab, CHANNELS_BY_TAB, PRIMARY_TABS, SortOption } from "@/lib/categoryConfig";
import { MOCK_PROJECTS } from "@/lib/mockProjects";

type Props = {
  tab: string;
  channel: string;
  sort: string;
  query: string;
  date: string;
  grade: string;
  recruit: string;
  kind: string;
};

function asTab(value: string): CategoryTab {
  if (PRIMARY_TABS.includes(value as CategoryTab)) return value as CategoryTab;
  return "교과";
}

function asSort(value: string): SortOption {
  return value === "latest" ? "latest" : "popular";
}

function normalizeFilter(value: string | undefined, allowed: string[]) {
  if (!value) return "all";
  return allowed.includes(value) ? value : "all";
}

export default function HomePortal(props: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const activeTab = asTab(props.tab);
  const channels = CHANNELS_BY_TAB[activeTab];
  const activeChannel = ["전체", ...channels].includes(props.channel) ? props.channel : "전체";
  const sort = asSort(props.sort);

  const filters: FilterState = useMemo(
    () => ({
      query: props.query ?? "",
      date: normalizeFilter(props.date, ["all", "7d", "30d"]),
      grade: normalizeFilter(props.grade, ["all", "G9-G11", "G10-G12", "G11-G13"]),
      recruit: normalizeFilter(props.recruit, ["all", "open", "closed"]),
      kind: normalizeFilter(props.kind, ["all", "온라인", "오프라인", "하이브리드"]),
    }),
    [props.date, props.grade, props.kind, props.query, props.recruit]
  );

  function replaceQuery(next: Partial<{ tab: string; channel: string; sort: string } & FilterState>) {
    const params = new URLSearchParams();
    params.set("tab", next.tab ?? activeTab);
    params.set("channel", next.channel ?? activeChannel);
    params.set("sort", next.sort ?? sort);

    const merged: FilterState = {
      query: next.query ?? filters.query,
      date: next.date ?? filters.date,
      grade: next.grade ?? filters.grade,
      recruit: next.recruit ?? filters.recruit,
      kind: next.kind ?? filters.kind,
    };

    Object.entries(merged).forEach(([key, value]) => {
      if (value && value !== "all") params.set(key, value);
    });

    router.replace(`${pathname}?${params.toString()}`);
  }

  const filtered = useMemo(() => {
    const list = MOCK_PROJECTS.filter((item) => {
      if (item.tab !== activeTab) return false;
      if (activeChannel !== "전체" && item.channel !== activeChannel) return false;

      if (filters.query.trim()) {
        const q = filters.query.toLowerCase();
        if (!item.title.toLowerCase().includes(q) && !item.summary.toLowerCase().includes(q)) return false;
      }

      if (filters.grade !== "all" && item.gradeBand !== filters.grade) return false;
      if (filters.recruit !== "all" && item.status !== filters.recruit) return false;
      if (filters.kind !== "all" && item.kind !== filters.kind) return false;
      return true;
    });

    if (sort === "latest") {
      return [...list].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    }

    return [...list].sort((a, b) => b.popularityScore - a.popularityScore);
  }, [activeChannel, activeTab, filters, sort]);

  const popular = [...filtered].sort((a, b) => b.popularityScore - a.popularityScore).slice(0, 6);
  const open = filtered.filter((x) => x.status === "open").slice(0, 6);
  const latest = [...filtered].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 6);

  return (
    <main className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <section className="mx-auto max-w-6xl space-y-7 px-4 py-6 md:px-6 md:py-8">
        <SearchFilterBar
          channels={channels}
          activeChannel={activeChannel}
          onChannelClick={(channel) => replaceQuery({ channel, sort: "popular" })}
          sort={sort}
          filters={filters}
          onSortChange={(nextSort) => replaceQuery({ sort: nextSort })}
          onFilterChange={(key, value) => replaceQuery({ [key]: value } as Partial<FilterState>)}
        />

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-100">인기 프로젝트</h2>
          <ProjectGrid projects={popular} />
        </section>

        <section className="space-y-4 pt-6 md:pt-8">
          <h2 className="text-xl font-semibold text-slate-100">최신</h2>
          <ProjectGrid projects={latest} />
        </section>

        <section className="space-y-4 pt-6 md:pt-8">
          <h2 className="text-xl font-semibold text-slate-100">모집중</h2>
          <ProjectGrid projects={open} />
        </section>
      </section>
    </main>
  );
}
