import Link from "next/link";
import LikeButton from "@/components/common/LikeButton";
import { MockProject } from "@/lib/mockProjects";

type Props = {
  item: MockProject;
};

function heroGradient(tab: MockProject["tab"]) {
  switch (tab) {
    case "교과":
      return "linear-gradient(130deg, #0f172a 0%, #1e3a8a 45%, #0e7490 100%)";
    case "창체":
      return "linear-gradient(130deg, #0b1720 0%, #115e59 45%, #155e75 100%)";
    case "교내대회":
      return "linear-gradient(130deg, #1f121f 0%, #7f1d1d 45%, #b45309 100%)";
    case "교외대회":
      return "linear-gradient(130deg, #1b1910 0%, #854d0e 45%, #3f6212 100%)";
    case "공인시험":
      return "linear-gradient(130deg, #1a1333 0%, #6b21a8 45%, #9d174d 100%)";
    default:
      return "linear-gradient(130deg, #111827 0%, #1f2937 45%, #0f172a 100%)";
  }
}

function statusLabel(status: MockProject["status"]) {
  return status === "open" ? "모집중" : "마감";
}

export default function FeaturedHero({ item }: Props) {
  return (
    <section className="relative min-h-[60vh] overflow-hidden rounded-3xl px-6 py-8 md:min-h-[68vh] md:px-10 md:py-10">
      <div className="absolute inset-0" style={{ backgroundImage: heroGradient(item.tab) }} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(255,255,255,0.22),transparent_42%),linear-gradient(to_top,rgba(0,0,0,0.7),rgba(0,0,0,0.25)_45%,rgba(0,0,0,0.15))]" />

      <div className="relative flex h-full min-h-[52vh] flex-col justify-end gap-5 md:min-h-[58vh]">
        <div className="inline-flex w-fit items-center gap-2 rounded-full bg-black/30 px-3 py-1 text-xs text-slate-200">
          <span className="font-semibold">Top 1</span>
          <span>{item.tab}</span>
          <span>·</span>
          <span>{item.channel}</span>
        </div>

        <div className="max-w-3xl space-y-3">
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-white md:text-5xl">{item.title}</h1>
          <p className="text-sm leading-7 text-slate-200 md:text-base">{item.summary}</p>
        </div>

        <div className="grid max-w-3xl gap-2 text-sm text-slate-200 md:grid-cols-2">
          <p>모집 대상/역할: {item.targetRoles}</p>
          <p>모집 인원: {item.capacity}명</p>
          <p>조건: {item.requirements}</p>
          <p>모집 상태: {statusLabel(item.status)}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <LikeButton
            projectId={item.id}
            initialCount={item.likeCount}
            className="inline-flex items-center gap-1.5 rounded-full bg-black/35 px-3 py-1.5 text-sm text-white"
          />
          <span className="text-sm font-semibold text-white/95">좋아요 {item.likeCount}+</span>
          <Link href={`/projects/${item.id}`} className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100">
            상세보기
          </Link>
        </div>
      </div>
    </section>
  );
}
