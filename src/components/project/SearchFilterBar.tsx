import { Search } from "lucide-react";
import { FILTER_OPTIONS, SortOption } from "@/lib/categoryConfig";

type FilterState = {
  query: string;
  date: string;
  grade: string;
  recruit: string;
  kind: string;
};

type Props = {
  channels?: string[];
  activeChannel?: string;
  onChannelClick?: (channel: string) => void;
  sort: SortOption;
  filters: FilterState;
  onSortChange: (sort: SortOption) => void;
  onFilterChange: (key: keyof FilterState, value: string) => void;
};

const INPUT_CLASS =
  "h-10 rounded-md border border-slate-600/80 bg-[color:var(--surface)] px-3 text-sm text-slate-100 outline-none transition focus:border-slate-400";

export type { FilterState };

export default function SearchFilterBar({
  channels,
  activeChannel,
  onChannelClick,
  sort,
  filters,
  onSortChange,
  onFilterChange,
}: Props) {
  return (
    <section className="space-y-3">
      {channels?.length ? (
        <div className="overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="inline-flex items-center gap-1 text-base">
            {["전체", ...channels].map((channel) => (
              <span key={channel} className="inline-flex items-center">
                <button
                  type="button"
                  onClick={() => onChannelClick?.(channel)}
                  className={`whitespace-nowrap px-4 transition ${
                    activeChannel === channel
                      ? "font-semibold text-slate-100"
                      : "text-slate-300 hover:text-slate-100"
                  }`}
                  aria-label={`${channel} 채널`}
                >
                  {channel}
                </button>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
        <label className="relative min-w-0 sm:col-span-2 xl:col-span-2">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={filters.query}
            onChange={(e) => onFilterChange("query", e.target.value)}
            placeholder="제목 + 내용 검색"
            aria-label="검색"
            className={`${INPUT_CLASS} w-full pl-9`}
          />
        </label>

        <select value={sort} onChange={(e) => onSortChange(e.target.value as SortOption)} className={`${INPUT_CLASS} min-w-0`} aria-label="정렬">
          <option value="popular">인기순</option>
          <option value="latest">최신순</option>
        </select>

        <select value={filters.date} onChange={(e) => onFilterChange("date", e.target.value)} className={`${INPUT_CLASS} min-w-0`} aria-label="날짜">
          {FILTER_OPTIONS.date.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>

        <select value={filters.grade} onChange={(e) => onFilterChange("grade", e.target.value)} className={`${INPUT_CLASS} min-w-0`} aria-label="학년">
          {FILTER_OPTIONS.grade.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>

        <select value={filters.recruit} onChange={(e) => onFilterChange("recruit", e.target.value)} className={`${INPUT_CLASS} min-w-0`} aria-label="모집 상태">
          {FILTER_OPTIONS.recruit.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>

        <select value={filters.kind} onChange={(e) => onFilterChange("kind", e.target.value)} className={`${INPUT_CLASS} min-w-0`} aria-label="유형">
          {FILTER_OPTIONS.kind.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
    </section>
  );
}
