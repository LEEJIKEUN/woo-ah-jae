import { TopTab } from "@/lib/category-data";

type Props = {
  tabs: readonly TopTab[];
  activeTab: TopTab;
  onChangeTab: (tab: TopTab) => void;
};

export default function TopTabs({ tabs, activeTab, onChangeTab }: Props) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="대분류 탭">
      {tabs.map((tab) => {
        const active = tab === activeTab;
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChangeTab(tab)}
            className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30 ${
              active
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:border-slate-500"
            }`}
          >
            {tab}
          </button>
        );
      })}
    </div>
  );
}
