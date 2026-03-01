"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import LikeButton from "@/components/common/LikeButton";
import Card from "@/components/ui/Card";
import { ProjectListItem } from "@/lib/project-list-item";

type Props = {
  project: ProjectListItem;
};

const clientThumbnailCache = new Map<string, string | null>();

function thumbGradient(tab: string) {
  switch (tab) {
    case "교과":
      return "from-blue-500/35 to-cyan-500/35";
    case "창체":
      return "from-emerald-500/35 to-teal-500/35";
    case "교내대회":
      return "from-rose-500/35 to-orange-500/35";
    case "교외대회":
      return "from-amber-500/35 to-lime-500/35";
    case "공인시험":
      return "from-violet-500/35 to-fuchsia-500/35";
    default:
      return "from-slate-500/35 to-slate-600/35";
  }
}

export default function ProjectCard({ project }: Props) {
  const cacheKey = useMemo(() => project.id, [project.id]);
  const initialThumbnail = useMemo(() => {
    if (clientThumbnailCache.has(cacheKey)) {
      return clientThumbnailCache.get(cacheKey) ?? null;
    }
    return project.thumbnailUrl ?? project.posterUrl ?? null;
  }, [cacheKey, project.posterUrl, project.thumbnailUrl]);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(initialThumbnail);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    if (thumbnailUrl || clientThumbnailCache.has(cacheKey)) return;

    const params = new URLSearchParams({
      projectId: project.id,
      tab: project.tab,
      channel: project.channel,
      title: project.title,
      summary: project.summary,
    });

    fetch(`/api/thumbnail?${params.toString()}`)
      .then(async (res) => {
        const data = (await res.json()) as { url?: string | null };
        const url = data.url ?? null;
        clientThumbnailCache.set(cacheKey, url);
        setThumbnailUrl(url);
      })
      .catch(() => {
        clientThumbnailCache.set(cacheKey, null);
      });
  }, [cacheKey, project.channel, project.id, project.summary, project.tab, project.title, thumbnailUrl]);

  return (
    <Card className="group flex h-full min-h-[260px] flex-col gap-3 p-3.5 transition hover:bg-[color:var(--surface-elevated)]">
      <div className="flex items-start gap-3">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl">
          {thumbnailUrl && !imageFailed ? (
            <>
              <Image
                src={thumbnailUrl}
                alt={project.title}
                fill
                sizes="56px"
                className="object-cover"
                onError={() => setImageFailed(true)}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            </>
          ) : (
            <div className={`h-14 w-14 rounded-xl bg-gradient-to-br ${thumbGradient(project.tab)}`} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-slate-400">{project.tab} · {project.channel}</p>
          <h3 className="line-clamp-1 text-base font-semibold text-slate-100">{project.title}</h3>
          <p className="line-clamp-2 text-xs leading-5 text-slate-300">{project.summary}</p>
        </div>
      </div>

      <div className="grid gap-1 text-[11px] text-slate-400">
        <p>모집 상태: {project.status === "open" ? "모집중" : "마감"} · 인원 {project.capacity}명</p>
        <p className="line-clamp-1">역할: {project.targetRoles}</p>
        <p className="line-clamp-1">조건: {project.requirements}</p>
      </div>

      <div className="mt-auto flex items-center justify-between pt-1">
        <LikeButton projectId={project.id} initialCount={project.likeCount} className="inline-flex items-center gap-1 text-xs text-slate-300 hover:text-slate-100" />
        <Link href={`/projects/${project.id}`} className="text-xs font-medium text-slate-200 transition hover:text-white">상세 보기</Link>
      </div>
    </Card>
  );
}
