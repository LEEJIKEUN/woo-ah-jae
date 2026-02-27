import { TOP_TABS, TopTab } from "@/lib/category-data";

type Props = {
  activeTab: TopTab;
  onChangeTab: (tab: TopTab) => void;
};

export default function CategoryHeader({ activeTab, onChangeTab }: Props) {
  return (
    <header className="space-y-4 border-b border-[color:var(--border)] pb-4">
      <nav aria-label="breadcrumb" className="text-xs text-[color:var(--muted)]">
        커뮤니티 &gt; 카테고리 &gt; {activeTab}
      </nav>

      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-[color:var(--primary)]">카테고리 탐색</h1>
        <p className="text-sm leading-relaxed text-[color:var(--muted)]">
          대학 입학 공지 페이지처럼 정돈된 목록에서 관심 분야의 모집글을 빠르게 탐색하세요.
        </p>
      </div>

      <div role="tablist" aria-label="카테고리 대분류" className="flex flex-wrap gap-4 border-b border-[color:var(--border)]">
        {TOP_TABS.map((tab) => {
          const active = tab === activeTab;
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChangeTab(tab)}
              className={`-mb-px border-b-2 px-0 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/70 ${
                active
                  ? "border-slate-100 font-semibold text-slate-100"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>
    </header>
  );
}
