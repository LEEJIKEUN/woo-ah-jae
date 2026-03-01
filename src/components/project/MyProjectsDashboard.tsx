"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import ProjectCreateForm from "./ProjectCreateForm";

type Item = {
  id: string;
  title: string;
  summary: string;
  status: "open" | "closed";
  achievedAt?: string | null;
  capacity: number;
  applicationCount: number;
  memberCount: number;
  createdAt: string;
  ownerName?: string;
  ownerEmail?: string;
};

export default function MyProjectsDashboard({
  initialItems,
  isAdmin = false,
  emptyText,
}: {
  initialItems: Item[];
  isAdmin?: boolean;
  emptyText?: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  // legacy edit state 제거, ProjectCreateForm 재사용

  async function openEditor(item: Item) {
    setEditingItem(item);
  }

  async function removeProject(item: Item) {
    const ok = window.confirm(`"${item.title}" 프로젝트를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`);
    if (!ok) return;

    setLoadingId(item.id);
    try {
      const res = await fetch(`/api/me/projects/${item.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("삭제 실패");

      setItems((prev) => prev.filter((entry) => entry.id !== item.id));
      router.refresh();
    } finally {
      setLoadingId(null);
    }
  }

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

  async function toggleAchieved(item: Item) {
    setLoadingId(item.id);
    const nextAchieved = !item.achievedAt;
    try {
      const res = await fetch(`/api/me/projects/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ achieved: nextAchieved }),
      });
      if (!res.ok) throw new Error("Achieved 상태 변경 실패");

      setItems((prev) =>
        prev.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                achievedAt: nextAchieved ? new Date().toISOString() : null,
                status: nextAchieved ? "closed" : entry.status,
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
    return <p className="text-sm text-slate-400">{emptyText ?? "아직 만든 프로젝트가 없습니다. 상단의 내 프로젝트 만들기 버튼으로 시작하세요."}</p>;
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <article key={item.id} className="rounded-xl border border-slate-700/70 bg-[color:var(--surface)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-slate-100">{item.title}</h2>
              <p className="text-sm text-slate-300">{item.summary}</p>
              {isAdmin ? (
                <p className="text-xs text-slate-400">
                  소유자: {item.ownerName ?? "-"} ({item.ownerEmail ?? "-"})
                </p>
              ) : null}
              <p className="text-xs text-slate-400">
                상태: {item.achievedAt ? "Achieved" : item.status === "open" ? "모집중" : "마감"} · 모집 {item.capacity}명 · 지원 {item.applicationCount}건 · 확정 {item.memberCount}명
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={loadingId === item.id}
                onClick={() => toggleAchieved(item)}
                className="rounded-md border border-emerald-500/70 px-3 py-1.5 text-xs text-emerald-200 hover:border-emerald-300 disabled:opacity-60"
              >
                {loadingId === item.id ? "변경 중..." : item.achievedAt ? "Achieved 해제" : "Achieved 이동"}
              </button>
              {!item.achievedAt ? (
                <button
                  type="button"
                  disabled={loadingId === item.id}
                  onClick={() => toggleStatus(item)}
                  className="rounded-md border border-slate-500 px-3 py-1.5 text-xs text-slate-100 hover:border-slate-300 disabled:opacity-60"
                >
                  {loadingId === item.id ? "변경 중..." : item.status === "open" ? "모집 마감" : "모집 재개"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => openEditor(item)}
                disabled={loadingId === item.id}
                className="rounded-md border border-slate-500 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:border-slate-300 disabled:opacity-60"
              >
                수정
              </button>
              <Link
                href={`/me/projects/${item.id}/applications`}
                className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-white"
              >
                지원자 관리
              </Link>
              <Link
                href={`/projects/${item.id}`}
                className="rounded-md border border-slate-500 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:border-slate-300"
              >
                상세 열람
              </Link>
              <Link
                href={`/workspace/${item.id}`}
                className="rounded-md border border-slate-500 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:border-slate-300"
              >
                프로젝트 공간
              </Link>
              <button
                type="button"
                onClick={() => removeProject(item)}
                disabled={loadingId === item.id}
                className="rounded-md bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-400 disabled:opacity-60"
              >
                삭제
              </button>
            </div>
          </div>
        </article>
      ))}

      {editingItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-5xl space-y-4 rounded-xl border border-slate-700 bg-slate-900 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-100">프로젝트 수정</h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-200"
                >
                  취소
                </button>
              </div>
            </div>

            <ProjectCreateForm
              mode="edit"
              projectId={editingItem.id}
              initialData={{
                title: editingItem.title,
                summary: editingItem.summary,
                description: (editingItem as any).description ?? "",
                tab: (editingItem as any).tab ?? "교과",
                channel: (editingItem as any).channel ?? undefined,
                capacity: (editingItem as any).capacity ?? 4,
                requirements: (editingItem as any).requirements ?? "",
                rolesNeeded: (editingItem as any).rolesNeeded ?? "",
                question1: (editingItem as any).question1 ?? "",
                question2: (editingItem as any).question2 ?? "",
                question3: (editingItem as any).question3 ?? "",
                deadline: (editingItem as any).deadline ?? null,
                status: ((editingItem as any).status as any)?.toUpperCase?.() === "CLOSED" ? "CLOSED" : "OPEN",
                thumbnailUrl: (editingItem as any).thumbnailUrl ?? null,
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
