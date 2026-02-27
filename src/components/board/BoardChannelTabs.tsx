"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BOARD_CHANNELS } from "@/lib/board-config";

export default function BoardChannelTabs({ activeSlug }: { activeSlug: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const querySuffix = (() => {
    const sp = new URLSearchParams(searchParams?.toString() ?? "");
    sp.delete("page");
    const q = sp.toString();
    return q ? `?${q}` : "";
  })();

  return (
    <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="커뮤니티 채널 탭">
      {BOARD_CHANNELS.map((channel) => (
        <Link
          key={channel.slug}
          href={`/boards/${channel.slug}${pathname?.startsWith("/boards/") ? querySuffix : ""}`}
          className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
            activeSlug === channel.slug
              ? "bg-slate-100 text-slate-900"
              : "border border-slate-600 text-slate-200 hover:border-slate-400"
          }`}
        >
          {channel.name}
        </Link>
      ))}
    </div>
  );
}
