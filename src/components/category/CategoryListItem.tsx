import { PromoItem } from "@/lib/category-data";

type Props = {
  item: PromoItem;
};

export default function CategoryListItem({ item }: Props) {
  const badge = item.recruitStatus === "마감임박" ? "마감임박" : null;

  return (
    <li className="border-b border-[color:var(--border)] last:border-b-0">
      <article className="flex items-start justify-between gap-4 px-4 py-4 transition hover:bg-[color:var(--surface-elevated)]/70">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <h3 className="truncate text-[15px] font-semibold text-slate-100">{item.title}</h3>
            {badge ? (
              <span className="rounded-sm border border-amber-400/50 bg-amber-500/10 px-1.5 py-0.5 text-[11px] text-amber-200">
                {badge}
              </span>
            ) : null}
          </div>
          <p className="line-clamp-2 text-sm leading-relaxed text-slate-300">{item.summary}</p>
          <p className="mt-2 text-xs text-slate-400">
            {item.channel} · {item.tab} · {item.region}/{item.gradeBand} · {item.deadline ? `마감 ${item.deadline}` : "상시"} · {item.recruitStatus}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="mb-2 text-xs text-slate-400">♡ {item.likeCount} · 💬 {item.commentCount}</p>
          <p className="text-xs text-slate-500">{item.createdAt}</p>
        </div>
      </article>
    </li>
  );
}
