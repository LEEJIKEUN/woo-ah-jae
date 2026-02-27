"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatKstDateTime } from "@/lib/date-format";

type CommentItem = {
  id: string;
  postId: string;
  parentCommentId: string | null;
  content: string;
  status: "ACTIVE" | "HIDDEN" | "DELETED";
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    name: string;
    school: string;
    grade: string;
  };
};

type PostDetail = {
  id: string;
  channel: { slug: string; name: string };
  author: { id: string; name: string; school: string; grade: string };
  categoryTag: string | null;
  title: string;
  content: string;
  attachments: Array<{ url: string; name: string; mimeType: string; size: number }>;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  isNotice: boolean;
  isPinned: boolean;
  status: "ACTIVE" | "HIDDEN" | "DELETED";
  createdAt: string;
  updatedAt: string;
  likedByMe: boolean;
};

type Props = {
  post: PostDetail;
  initialComments: CommentItem[];
  user: { id: string; role: "ADMIN" | "STUDENT" } | null;
};

const REPORT_REASONS = [
  { value: "SPAM", label: "스팸/광고" },
  { value: "ABUSE", label: "욕설/비방" },
  { value: "PRIVACY", label: "개인정보 노출" },
  { value: "COPYRIGHT", label: "저작권 침해" },
  { value: "OTHER", label: "기타" },
] as const;

export default function BoardPostDetailClient({ post, initialComments, user }: Props) {
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [liked, setLiked] = useState(post.likedByMe);
  const [comments, setComments] = useState<CommentItem[]>(initialComments);
  const [commentInput, setCommentInput] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parentComments = useMemo(
    () => comments.filter((x) => !x.parentCommentId).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [comments]
  );

  const childrenMap = useMemo(() => {
    const map = new Map<string, CommentItem[]>();
    for (const comment of comments) {
      if (!comment.parentCommentId) continue;
      const prev = map.get(comment.parentCommentId) ?? [];
      prev.push(comment);
      map.set(comment.parentCommentId, prev);
    }
    for (const [k, arr] of map) {
      map.set(k, arr.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)));
    }
    return map;
  }, [comments]);

  async function refreshComments() {
    const res = await fetch(`/api/board-posts/${post.id}/comments`, { cache: "no-store" });
    const json = (await res.json()) as { items?: CommentItem[]; error?: string };
    if (!res.ok || !json.items) throw new Error(json.error ?? "댓글 조회 실패");
    setComments(json.items);
  }

  async function toggleLike() {
    if (!user) {
      alert("로그인 후 추천할 수 있습니다.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/board-posts/${post.id}/like`, { method: "POST" });
      const json = (await res.json()) as { error?: string; liked?: boolean; likeCount?: number };
      if (!res.ok || typeof json.liked !== "boolean" || typeof json.likeCount !== "number") {
        throw new Error(json.error ?? "추천 처리 실패");
      }
      setLiked(json.liked);
      setLikeCount(json.likeCount);
    } catch (e) {
      setError(e instanceof Error ? e.message : "추천 처리 실패");
    } finally {
      setLoading(false);
    }
  }

  async function submitComment() {
    if (!user) {
      alert("로그인 후 댓글 작성이 가능합니다.");
      return;
    }
    if (!commentInput.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/board-posts/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: commentInput.trim(), parentCommentId: replyTo }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "댓글 등록 실패");
      setCommentInput("");
      setReplyTo(null);
      await refreshComments();
    } catch (e) {
      setError(e instanceof Error ? e.message : "댓글 등록 실패");
    } finally {
      setLoading(false);
    }
  }

  async function editComment(commentId: string, currentContent: string) {
    const next = window.prompt("댓글 수정", currentContent);
    if (!next || !next.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/board-comments/${commentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: next.trim() }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "댓글 수정 실패");
      await refreshComments();
    } catch (e) {
      alert(e instanceof Error ? e.message : "댓글 수정 실패");
    } finally {
      setLoading(false);
    }
  }

  async function removeComment(commentId: string) {
    const ok = window.confirm("댓글을 삭제할까요?");
    if (!ok) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/board-comments/${commentId}`, { method: "DELETE" });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "댓글 삭제 실패");
      await refreshComments();
    } catch (e) {
      alert(e instanceof Error ? e.message : "댓글 삭제 실패");
    } finally {
      setLoading(false);
    }
  }

  async function reportTarget(targetType: "POST" | "COMMENT", targetId: string) {
    if (!user) {
      alert("로그인 후 신고할 수 있습니다.");
      return;
    }
    const reason = window.prompt(`신고 사유를 입력하세요: ${REPORT_REASONS.map((x) => x.value).join(", ")}`, "OTHER");
    const selected = REPORT_REASONS.find((x) => x.value === reason)?.value ?? "OTHER";
    const detail = window.prompt("상세 내용을 입력하세요 (선택)", "") ?? "";
    const res = await fetch("/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType, targetId, reasonCode: selected, detail }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      alert(json.error ?? "신고 실패");
      return;
    }
    alert("신고가 접수되었습니다.");
  }

  const canEditPost = !!user && (user.role === "ADMIN" || user.id === post.author.id);

  return (
    <section className="space-y-4">
      <article className="space-y-4 rounded-xl border border-slate-700/70 bg-[color:var(--surface)] p-5">
        <p className="text-xs text-slate-400">
          {post.channel.name}
          {post.categoryTag ? ` · ${post.categoryTag}` : ""}
          {post.isPinned ? " · [고정]" : ""}
          {post.isNotice ? " · [공지]" : ""}
        </p>
        <h1 className="text-2xl font-bold text-slate-100">{post.title}</h1>
        <p className="text-xs text-slate-400">
          {post.author.school} · {post.author.grade} · {post.author.name} · {formatKstDateTime(post.createdAt)}
        </p>
        <div className="whitespace-pre-wrap text-sm leading-7 text-slate-200">{post.content}</div>

        {post.attachments.length ? (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-200">첨부파일</p>
            <ul className="space-y-1 text-sm">
              {post.attachments.map((a) => (
                <li key={a.url}>
                  <a href={a.url} target="_blank" rel="noreferrer" className="text-cyan-300 hover:text-cyan-200">
                    {a.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span>조회 {post.viewCount}</span>
          <span>추천 {likeCount}</span>
          <span>댓글 {comments.length}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleLike}
            disabled={loading}
            aria-label="추천"
            className={`rounded-md border px-3 py-1.5 text-sm font-semibold ${
              liked ? "border-rose-400/70 text-rose-300" : "border-slate-500 text-slate-200"
            }`}
          >
            {liked ? "추천 취소" : "추천"} ({likeCount})
          </button>
          <button type="button" onClick={() => reportTarget("POST", post.id)} className="rounded-md border border-slate-500 px-3 py-1.5 text-sm text-slate-200">
            신고
          </button>
          {canEditPost ? (
            <>
              <Link href={`/boards/posts/${post.id}/edit`} className="rounded-md border border-slate-500 px-3 py-1.5 text-sm text-slate-200">
                수정
              </Link>
              <button
                type="button"
                className="rounded-md border border-rose-400/70 px-3 py-1.5 text-sm text-rose-300"
                onClick={async () => {
                  const ok = window.confirm("게시글을 삭제할까요?");
                  if (!ok) return;
                  const res = await fetch(`/api/board-posts/${post.id}`, { method: "DELETE" });
                  if (res.ok) window.location.href = `/boards/${post.channel.slug}`;
                }}
              >
                삭제
              </button>
            </>
          ) : null}
          <Link href={`/boards/${post.channel.slug}`} className="rounded-md border border-slate-500 px-3 py-1.5 text-sm text-slate-200">
            목록
          </Link>
        </div>
      </article>

      <section className="space-y-3 rounded-xl border border-slate-700/70 bg-[color:var(--surface)] p-5">
        <h2 className="text-lg font-semibold text-slate-100">댓글 {comments.length}</h2>
        {replyTo ? (
          <p className="text-xs text-slate-400">
            답글 작성 중 · <button className="text-slate-200 underline" onClick={() => setReplyTo(null)}>취소</button>
          </p>
        ) : null}
        <textarea
          value={commentInput}
          onChange={(e) => setCommentInput(e.target.value)}
          rows={4}
          placeholder="댓글을 입력하세요."
          className="w-full rounded-md border border-slate-600/80 bg-[color:var(--surface)] px-3 py-2 text-sm text-slate-100"
        />
        <div className="flex items-center gap-2">
          <button type="button" onClick={submitComment} disabled={loading || !commentInput.trim()} className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-900 disabled:opacity-50">
            댓글 등록
          </button>
        </div>

        {error ? <p className="text-sm text-rose-300">{error}</p> : null}

        <div className="space-y-2">
          {parentComments.map((item) => {
            const canEdit = !!user && (user.role === "ADMIN" || user.id === item.author.id);
            const replies = childrenMap.get(item.id) ?? [];
            return (
              <article key={item.id} className="space-y-2 rounded-md border border-slate-700/80 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                  <p>
                    {item.author.school} · {item.author.grade} · {item.author.name}
                  </p>
                  <p>{formatKstDateTime(item.createdAt)}</p>
                </div>
                <p className="whitespace-pre-wrap text-sm text-slate-100">{item.content}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <button className="text-slate-300 hover:text-white" onClick={() => setReplyTo(item.id)}>
                    답글
                  </button>
                  <button className="text-slate-300 hover:text-white" onClick={() => reportTarget("COMMENT", item.id)}>
                    신고
                  </button>
                  {canEdit ? (
                    <>
                      <button className="text-slate-300 hover:text-white" onClick={() => editComment(item.id, item.content)}>
                        수정
                      </button>
                      <button className="text-rose-300 hover:text-rose-200" onClick={() => removeComment(item.id)}>
                        삭제
                      </button>
                    </>
                  ) : null}
                </div>

                {replies.length ? (
                  <div className="space-y-2 pl-4">
                    {replies.map((reply) => {
                      const canEditReply = !!user && (user.role === "ADMIN" || user.id === reply.author.id);
                      return (
                        <div key={reply.id} className="rounded-md border border-slate-800/80 bg-slate-900/40 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                            <p>
                              {reply.author.school} · {reply.author.grade} · {reply.author.name}
                            </p>
                            <p>{formatKstDateTime(reply.createdAt)}</p>
                          </div>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-100">{reply.content}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                            <button className="text-slate-300 hover:text-white" onClick={() => reportTarget("COMMENT", reply.id)}>
                              신고
                            </button>
                            {canEditReply ? (
                              <>
                                <button className="text-slate-300 hover:text-white" onClick={() => editComment(reply.id, reply.content)}>
                                  수정
                                </button>
                                <button className="text-rose-300 hover:text-rose-200" onClick={() => removeComment(reply.id)}>
                                  삭제
                                </button>
                              </>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
    </section>
  );
}
