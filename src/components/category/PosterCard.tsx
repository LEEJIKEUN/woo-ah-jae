"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import LikeButton from "@/components/common/LikeButton";
import { MockProject } from "@/lib/mockProjects";

type Props = {
  item: MockProject;
  rank?: number;
};

function gradientByTab(tab: MockProject["tab"]) {
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

export default function PosterCard({ item, rank }: Props) {
  return (
    <Link href={`/projects/${item.id}`} className="group relative block w-[172px] shrink-0 snap-start sm:w-[200px]" aria-label={`${item.title} 상세 보기`}>
      {rank ? (
        <span className="pointer-events-none absolute -left-2 -top-2 z-20 rounded-md bg-black/70 px-2 py-0.5 text-xs font-bold text-white sm:-left-3 sm:-top-3">
          {rank}
        </span>
      ) : null}

      <motion.article
        whileHover={{ scale: 1.03 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        className="relative h-[258px] overflow-hidden rounded-2xl bg-slate-900 sm:h-[300px]"
      >
        <div className="absolute inset-0" style={{ backgroundImage: gradientByTab(item.tab) }} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent" />

        <div className="absolute left-2 top-2 rounded-md bg-black/25 px-2 py-0.5 text-[10px] text-white/90">
          {item.channel}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="absolute right-2 top-2 z-10 opacity-0"
        >
          <LikeButton
            projectId={item.id}
            initialCount={item.likeCount}
            className="inline-flex items-center gap-1 rounded-md bg-black/35 px-2 py-1 text-[11px] text-slate-100"
          />
        </motion.div>

        <div className="absolute inset-x-0 bottom-0 p-3">
          <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-white">{item.title}</h3>
          <p className="mt-1 line-clamp-1 text-[11px] text-slate-300">{item.status === "open" ? "모집중" : "마감"} · {item.capacity}명</p>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="pointer-events-none absolute inset-0 flex flex-col justify-end bg-black/68 p-3 opacity-0"
        >
          <p className="line-clamp-1 text-xs font-semibold text-slate-100">{item.title}</p>
          <p className="mt-1 line-clamp-1 text-xs text-slate-200">{item.summary}</p>
          <p className="mt-1 line-clamp-1 text-[11px] text-slate-300">{item.status === "open" ? "모집중" : "마감"} · 좋아요 {item.likeCount}</p>
        </motion.div>
      </motion.article>
    </Link>
  );
}
