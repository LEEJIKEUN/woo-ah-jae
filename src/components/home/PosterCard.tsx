import Image from "next/image";
import Link from "next/link";
import { HomeProject } from "@/lib/mockProjects";

type Props = {
  item: HomeProject;
  rank?: number;
};

function posterTheme(tab: HomeProject["categoryTab"]) {
  switch (tab) {
    case "교과":
      return "linear-gradient(145deg, #1e1b4b 0%, #1e3a8a 45%, #0e7490 100%)";
    case "창체":
      return "linear-gradient(145deg, #052e16 0%, #115e59 45%, #155e75 100%)";
    case "교내대회":
      return "linear-gradient(145deg, #4c0519 0%, #991b1b 45%, #c2410c 100%)";
    case "교외대회":
      return "linear-gradient(145deg, #451a03 0%, #854d0e 45%, #3f6212 100%)";
    case "공인시험":
      return "linear-gradient(145deg, #2e1065 0%, #86198f 45%, #9d174d 100%)";
    default:
      return "linear-gradient(145deg, #1e293b 0%, #0f172a 50%, #020617 100%)";
  }
}

function shortChannelLabel(channel: string) {
  if (channel === "정보 관련 대회") return "정보";
  if (channel === "소논문 관련 대회") return "소논문";
  if (channel.includes("(")) return channel.split("(")[0];
  return channel;
}

export default function PosterCard({ item, rank }: Props) {
  return (
    <Link
      href={`/projects/${item.id}`}
      className="group relative block w-[188px] shrink-0 snap-start sm:w-[220px]"
      aria-label={`${item.title} 상세 보기`}
    >
      {rank ? (
        <span className="pointer-events-none absolute -left-2 -top-2 z-10 rounded-md bg-black/75 px-2 py-0.5 text-xs font-bold text-white/90 sm:-left-3 sm:-top-3">
          {rank}
        </span>
      ) : null}

      <div className="relative h-[282px] overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-950 transition duration-300 group-hover:-translate-y-1 group-hover:border-slate-500 sm:h-[330px]">
        <div className="relative h-full w-full">
          {item.posterUrl ? (
            <Image
              src={item.posterUrl}
              alt={item.title}
              fill
              className="object-cover transition duration-300 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="relative h-full w-full" style={{ backgroundImage: posterTheme(item.categoryTab) }}>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_84%_16%,rgba(255,255,255,0.24),transparent_42%),radial-gradient(circle_at_15%_82%,rgba(255,255,255,0.14),transparent_44%)]" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/10" />

              <div className="relative flex h-full flex-col justify-between p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="rounded-md border border-white/30 bg-black/30 px-2 py-1 text-[10px] font-semibold tracking-[0.04em] text-white/95">
                    {item.categoryTab}
                  </span>
                </div>

                <div className="space-y-3">
                  <p className="line-clamp-1 text-[28px] font-black uppercase leading-none tracking-tight text-white/80">
                    {shortChannelLabel(item.channel)}
                  </p>

                  <p className="line-clamp-3 text-[22px] font-extrabold leading-[1.15] text-white drop-shadow-[0_2px_6px_rgba(0,0,0,.45)]">
                    {item.title}
                  </p>
                  <p className="line-clamp-2 text-[12px] leading-[1.45] text-white/90">
                    {item.summary}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>

      <div className="mt-3 space-y-1.5 px-0.5">
        <p className="line-clamp-2 text-[15px] font-semibold leading-6 text-slate-100">{item.title}</p>
        <p className="text-[12px] leading-5 text-slate-400">
          {item.categoryTab} · {item.channel}
        </p>
        <p className="text-[12px] leading-5 text-slate-500">
          좋아요 {item.likeCount} · 댓글 {item.commentCount}
        </p>
      </div>
    </Link>
  );
}
