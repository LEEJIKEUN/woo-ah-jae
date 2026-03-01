"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

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
  const [editTitle, setEditTitle] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [editCapacity, setEditCapacity] = useState(1);
  const [editDescription, setEditDescription] = useState("");
  const [editRequirements, setEditRequirements] = useState("");
  const [editRolesNeeded, setEditRolesNeeded] = useState("");

  async function openEditor(item: Item) {
    setLoadingId(item.id);
    try {
      const res = await fetch(`/api/projects/${item.id}`, { cache: "no-store" });
      if (!res.ok) throw new Error("프로젝트를 불러오지 못했습니다.");
      const data = (await res.json()) as {
        item: {
          title: string;
          summary: string;
          description: string;
          capacity: number;
          requirements: string | null;
          rolesNeeded: string | null;
        };
      };

      setEditTitle(data.item.title);
      setEditSummary(data.item.summary ?? "");
      setEditDescription(data.item.description ?? "");
      setEditCapacity(data.item.capacity);
      setEditRequirements(data.item.requirements ?? "");
      setEditRolesNeeded(data.item.rolesNeeded ?? "");
      setEditingItem(item);
    } finally {
      setLoadingId(null);
    }
  }

  async function saveEdit() {
    if (!editingItem) return;
    setLoadingId(editingItem.id);
    try {
      const res = await fetch(`/api/me/projects/${editingItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          summary: editSummary.trim(),
          description: editDescription.trim(),
          capacity: editCapacity,
          requirements: editRequirements.trim(),
          rolesNeeded: editRolesNeeded.trim(),
        }),
      });
      if (!res.ok) throw new Error("프로젝트 수정 실패");

      setItems((prev) =>
        prev.map((entry) =>
          entry.id === editingItem.id
            ? {
                ...entry,
                title: editTitle.trim(),
                summary: editSummary.trim(),
                capacity: editCapacity,
              }
            : entry
        )
      );
      setEditingItem(null);
      router.refresh();
    } finally {
      setLoadingId(null);
    }
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
          <div className="w-full max-w-2xl space-y-3 rounded-xl border border-slate-700 bg-slate-900 p-4">
            <h3 className="text-lg font-semibold text-slate-100">프로젝트 수정</h3>
            <input
              value={editTitle}
              onChange={(event) => setEditTitle(event.target.value)}
              placeholder="제목"
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
            />
            <input
              value={editSummary}
              onChange={(event) => setEditSummary(event.target.value)}
              placeholder="요약"
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
            />
            <textarea
              value={editDescription}
              onChange={(event) => setEditDescription(event.target.value)}
              placeholder="상세 설명"
              rows={5}
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
            />
            <div className="grid gap-2 md:grid-cols-3">
              <input
                value={editRequirements}
                onChange={(event) => setEditRequirements(event.target.value)}
                placeholder="조건"
                className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
              />
              <input
                value={editRolesNeeded}
                onChange={(event) => setEditRolesNeeded(event.target.value)}
                placeholder="모집 역할"
                className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
              />
              <input
                type="number"
                min={1}
                max={100}
                value={editCapacity}
                onChange={(event) => setEditCapacity(Math.max(1, Number(event.target.value || 1)))}
                placeholder="모집 인원"
                className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-200"
              >
                취소
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={loadingId === editingItem.id}
                className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-900 disabled:opacity-60"
              >
                {loadingId === editingItem.id ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
