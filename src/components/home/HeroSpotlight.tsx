import Link from "next/link";
import { HomeProject } from "@/lib/mockProjects";

type Props = {
  item: HomeProject;
};

export default function HeroSpotlight({ item }: Props) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-7 md:p-12">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-400/15 via-transparent to-cyan-300/10" />
      <div className="relative max-w-3xl space-y-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Today&apos;s Spotlight</p>
        <h2 className="text-3xl font-extrabold leading-[1.18] tracking-tight text-[color:var(--primary)] md:text-5xl">
          {item.title}
        </h2>
        <p className="max-w-2xl text-base leading-8 text-slate-300">{item.summary}</p>
        <p className="text-sm leading-6 text-slate-400">
          {item.categoryTab} · {item.channel} · 좋아요 {item.likeCount} · 댓글 {item.commentCount}
        </p>
        <div className="flex items-center gap-3">
          <Link
            href={`/projects/${item.id}`}
            className="rounded-md border border-slate-200/80 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-white"
          >
            상세 보기
          </Link>
          <Link
            href="/category"
            className="rounded-md border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-700/50"
          >
            카테고리 이동
          </Link>
        </div>
      </div>
    </section>
  );
}
