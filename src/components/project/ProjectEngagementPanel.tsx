"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";

type ProjectCommentItem = {
  id: string;
  projectId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  authorId: string;
  author: {
    id: string;
    name: string;
    school: string;
    grade: string;
  };
};

type Props = {
  projectId: string;
  initialLikeCount: number;
  initialCommentCount: number;
  initialLiked: boolean;
  currentUserId?: string;
  isAdmin: boolean;
};

export default function ProjectEngagementPanel({
  projectId,
  initialLikeCount,
  initialCommentCount,
  initialLiked,
  currentUserId,
  isAdmin,
}: Props) {
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [commentCount, setCommentCount] = useState(initialCommentCount);
  const [comments, setComments] = useState<ProjectCommentItem[]>([]);
  const [content, setContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingLike, setPendingLike] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);

  const loadComments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${projectId}/comments`, { cache: "no-store" });
      const json = (await res.json()) as { error?: string; items?: ProjectCommentItem[] };
      if (!res.ok) {
        setError(json.error ?? "댓글을 불러오지 못했습니다.");
        return;
      }
      setComments(json.items ?? []);
      setCommentCount(json.items?.length ?? 0);
      setError(null);
    } catch {
      setError("댓글을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  async function handleLike() {
    if (!currentUserId || pendingLike) return;
    setPendingLike(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/like`, { method: "POST" });
      const json = (await res.json()) as { error?: string; liked?: boolean; likeCount?: number };
      if (!res.ok || typeof json.liked !== "boolean" || typeof json.likeCount !== "number") {
        setError(json.error ?? "좋아요 처리에 실패했습니다.");
        return;
      }
      setLiked(json.liked);
      setLikeCount(json.likeCount);
      setError(null);
    } catch {
      setError("좋아요 처리에 실패했습니다.");
    } finally {
      setPendingLike(false);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!content.trim() || !currentUserId || pendingSubmit) return;

    setPendingSubmit(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const json = (await res.json()) as { error?: string; item?: ProjectCommentItem };
      if (!res.ok || !json.item) {
        setError(json.error ?? "댓글 작성에 실패했습니다.");
        return;
      }
      setContent("");
      setComments((prev) => [json.item!, ...prev]);
      setCommentCount((prev) => prev + 1);
      setError(null);
    } catch {
      setError("댓글 작성에 실패했습니다.");
    } finally {
      setPendingSubmit(false);
    }
  }

  async function handleDelete(id: string) {
    const ok = window.confirm("댓글을 삭제할까요?");
    if (!ok) return;

    const res = await fetch(`/api/project-comments/${id}`, { method: "DELETE" });
    const json = (await res.json()) as { error?: string; ok?: boolean };
    if (!res.ok || !json.ok) {
      setError(json.error ?? "댓글 삭제에 실패했습니다.");
      return;
    }
    setComments((prev) => prev.filter((item) => item.id !== id));
    setCommentCount((prev) => Math.max(0, prev - 1));
    setError(null);
  }

  async function handleSaveEdit(id: string) {
    if (!editingText.trim()) return;

    const res = await fetch(`/api/project-comments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: editingText }),
    });

    const json = (await res.json()) as { error?: string; item?: { id: string; updatedAt: string } };
    if (!res.ok || !json.item) {
      setError(json.error ?? "댓글 수정에 실패했습니다.");
      return;
    }

    setComments((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              content: editingText,
              updatedAt: json.item!.updatedAt,
            }
          : item
      )
    );
    setEditingId(null);
    setEditingText("");
    setError(null);
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-700/70 bg-[color:var(--surface)] p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-100">좋아요 · 댓글</h2>
        <div className="flex items-center gap-2 text-sm">
          {currentUserId ? (
            <button
              type="button"
              onClick={handleLike}
              disabled={pendingLike}
              className="rounded-md border border-slate-500/80 px-3 py-1.5 text-slate-100 hover:border-slate-300 disabled:opacity-60"
            >
              {liked ? "♥" : "♡"} 좋아요 {likeCount}
            </button>
          ) : (
            <Link href={`/login?next=/projects/${projectId}`} className="rounded-md border border-slate-500/80 px-3 py-1.5 text-slate-100 hover:border-slate-300">
              로그인 후 좋아요
            </Link>
          )}
          <span className="text-slate-300">댓글 {commentCount}</span>
        </div>
      </div>

      {currentUserId ? (
        <form onSubmit={handleSubmit} className="space-y-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="댓글을 입력하세요"
            maxLength={2000}
            className="h-24 w-full rounded-md border border-slate-600/80 bg-slate-900/40 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-slate-400"
          />
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{content.length}/2000</span>
            <button
              type="submit"
              disabled={pendingSubmit || !content.trim()}
              className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-900 disabled:opacity-50"
            >
              댓글 등록
            </button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-slate-400">댓글 작성은 로그인 후 가능합니다.</p>
      )}

      {error ? <p className="rounded-md bg-rose-500/15 px-3 py-2 text-sm text-rose-300">{error}</p> : null}

      <div className="space-y-3">
        {loading ? <p className="text-sm text-slate-400">댓글을 불러오는 중입니다...</p> : null}
        {!loading && comments.length === 0 ? <p className="text-sm text-slate-400">아직 댓글이 없습니다.</p> : null}

        {comments.map((item) => {
          const canEdit = Boolean(currentUserId && (currentUserId === item.authorId || isAdmin));
          const isEditing = editingId === item.id;

          return (
            <article key={item.id} className="rounded-md border border-slate-700/70 bg-slate-900/30 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-slate-400">{item.author.school} · {item.author.grade} · {item.author.name}</p>
                <p className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString("ko-KR", { hour12: false })}</p>
              </div>

              {isEditing ? (
                <div className="mt-2 space-y-2">
                  <textarea
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    maxLength={2000}
                    className="h-20 w-full rounded-md border border-slate-600/80 bg-slate-900/50 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-400"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        setEditingText("");
                      }}
                      className="rounded-md border border-slate-500/80 px-2 py-1 text-xs text-slate-200"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSaveEdit(item.id)}
                      className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-900"
                    >
                      저장
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-100">{item.content}</p>
              )}

              {canEdit && !isEditing ? (
                <div className="mt-2 flex justify-end gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(item.id);
                      setEditingText(item.content);
                    }}
                    className="text-slate-300 hover:text-white"
                  >
                    수정
                  </button>
                  <button type="button" onClick={() => void handleDelete(item.id)} className="text-rose-300 hover:text-rose-200">
                    삭제
                  </button>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
