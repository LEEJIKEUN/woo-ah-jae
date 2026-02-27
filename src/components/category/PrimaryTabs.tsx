import Link from "next/link";
import { CategoryTab, PRIMARY_TABS, SortOption } from "@/lib/categoryConfig";

type Props = {
  activeTab: CategoryTab;
  query: URLSearchParams;
  preserveSort: SortOption;
};

export default function PrimaryTabs({ activeTab, query, preserveSort }: Props) {
  return (
    <div className="flex items-center gap-5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {PRIMARY_TABS.map((tab) => {
        const params = new URLSearchParams(query.toString());
        params.set("tab", tab);
        params.set("channel", "전체");
        params.set("sort", preserveSort);
        const active = tab === activeTab;

        return (
          <Link
            key={tab}
            href={`/category?${params.toString()}`}
            className={`shrink-0 border-b-2 pb-2 text-sm font-semibold transition ${
              active
                ? "border-slate-100 text-slate-100"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            {tab}
          </Link>
        );
      })}
    </div>
  );
}
