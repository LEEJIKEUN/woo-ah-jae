import { PromoItem } from "@/lib/category-data";

type Props = {
  item: PromoItem;
};

function pickBadge(item: PromoItem) {
  if (item.recruitStatus === "마감임박") return "마감임박";
  if (item.popularityScore > 850) return "인기";
  return "추천";
}

export default function PromoCard({ item }: Props) {
  const badge = pickBadge(item);

  return (
    <article className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md">
      <div className="relative overflow-hidden">
        <div
          className="aspect-video w-full bg-[radial-gradient(circle_at_20%_20%,#fde68a,transparent_40%),radial-gradient(circle_at_80%_0%,#bae6fd,transparent_35%),linear-gradient(135deg,#f8fafc,#e2e8f0)] transition duration-300 group-hover:scale-[1.03]"
          style={item.thumbnailUrl ? { backgroundImage: `url(${item.thumbnailUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
          aria-label={`${item.title} 썸네일`}
        />
        <span className="absolute left-3 top-3 rounded-full bg-slate-900/85 px-2.5 py-1 text-[11px] font-semibold text-white">
          {badge}
        </span>
      </div>

      <div className="space-y-3 p-4">
        <div>
          <h3 className="line-clamp-2 text-base font-bold leading-snug text-slate-900">{item.title}</h3>
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-600">{item.summary}</p>
        </div>

        <div className="text-xs text-slate-500">
          <p>{item.channel} · {item.tab}</p>
          <p>{item.region} · {item.gradeBand}</p>
          <p>{item.deadline ? `마감 ${item.deadline}` : "상시 모집"} · {item.recruitStatus}</p>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs text-slate-500">
          <div className="flex flex-wrap gap-1.5">
            {item.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px]">#{tag}</span>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span aria-label="좋아요">♡ {item.likeCount}</span>
            <span aria-label="댓글">💬 {item.commentCount}</span>
          </div>
        </div>
      </div>
    </article>
  );
}
