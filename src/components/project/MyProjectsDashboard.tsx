"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Item = {
  id: string;
  title: string;
  summary: string;
  status: "open" | "closed";
  capacity: number;
  applicationCount: number;
  memberCount: number;
  createdAt: string;
};

export default function MyProjectsDashboard({ initialItems }: { initialItems: Item[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function toggleStatus(item: Item) {
    setLoadingId(item.id);
    const nextStatus = item.status === "open" ? "CLOSED" : "OPEN";

    try {
      const res = await fetch(`/api/me/projects/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error("상태 변경 실패");

      setItems((prev) =>
        prev.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                status: nextStatus === "OPEN" ? "open" : "closed",
              }
            : entry
        )
      );
      router.refresh();
    } finally {
      setLoadingId(null);
    }
  }

  if (!items.length) {
    return <p className="text-sm text-slate-400">아직 만든 프로젝트가 없습니다. 상단의 내 프로젝트 만들기 버튼으로 시작하세요.</p>;
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <article key={item.id} className="rounded-xl border border-slate-700/70 bg-[color:var(--surface)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-slate-100">{item.title}</h2>
              <p className="text-sm text-slate-300">{item.summary}</p>
              <p className="text-xs text-slate-400">
                상태: {item.status === "open" ? "모집중" : "마감"} · 모집 {item.capacity}명 · 지원 {item.applicationCount}건 · 확정 {item.memberCount}명
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={loadingId === item.id}
                onClick={() => toggleStatus(item)}
                className="rounded-md border border-slate-500 px-3 py-1.5 text-xs text-slate-100 hover:border-slate-300 disabled:opacity-60"
              >
                {loadingId === item.id ? "변경 중..." : item.status === "open" ? "모집 마감" : "모집 재개"}
              </button>
              <Link
                href={`/me/projects/${item.id}/applications`}
                className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-white"
              >
                지원자 관리
              </Link>
              <Link
                href={`/workspace/${item.id}`}
                className="rounded-md border border-slate-500 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:border-slate-300"
              >
                프로젝트 공간
              </Link>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
