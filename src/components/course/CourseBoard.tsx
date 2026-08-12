"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronDown, ChevronUp, PenLine, X, MessageSquare, Trash2, CornerDownRight, Send } from "lucide-react";
import ClassroomSidebar from "@/components/course/ClassroomSidebar";

const BROWN = "#8C6E59";
const DEEP = "#6B5342";
const INK = "#2C2823";
const BODY = "#334155";
const SUB = "#8A8479";
const MUTED = "#94a3b8";
const LINE = "#E4DBC7";
const CARD = "#EFEBE1";
const PANEL = "#FBF8F2";
const serif = { fontFamily: "var(--font-serif)" } as const;

type Post = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  commentCount: number;
};
type Comment = {
  id: string;
  body: string;
  parentCommentId: string | null;
  createdAt: string;
  authorId: string;
  authorName: string;
  authorRole: string;
};

function fmtDate(iso: string) {
  try {
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  } catch {
    return "";
  }
}
function roleBadge(role: string) {
  return role === "ADMIN" ? "관리자" : role === "FACILITATOR" ? "퍼실리테이터" : null;
}

export default function CourseBoard({
  courseId,
  kind,
  isStaff = false,
  isParent = false,
  role,
  currentUserId,
}: {
  courseId: string;
  kind: "NOTICE" | "DISCUSSION";
  isStaff?: boolean;
  isParent?: boolean;
  role: string;
  currentUserId: string;
}) {
  const title = kind === "NOTICE" ? "공지사항" : "수강생 토론 게시판";
  const canWrite = kind === "NOTICE" ? isStaff : isStaff || role === "STUDENT";
  const canComment = isStaff || role === "STUDENT";
  const canModerate = isStaff;

  const [posts, setPosts] = useState<Post[]>([]);
  const [ready, setReady] = useState(false);
  const [composing, setComposing] = useState(false);
  const [pTitle, setPTitle] = useState("");
  const [pBody, setPBody] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [commentsByPost, setCommentsByPost] = useState<Record<string, Comment[]>>({});

  const loadPosts = useCallback(async () => {
    try {
      const res = await fetch(`/api/courses/${courseId}/posts?kind=${kind}`, { cache: "no-store" });
      const data = (await res.json()) as { posts?: Post[] };
      if (Array.isArray(data.posts)) setPosts(data.posts);
    } catch {
      /* ignore */
    } finally {
      setReady(true);
    }
  }, [courseId, kind]);
  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const loadComments = useCallback(
    async (postId: string) => {
      try {
        const res = await fetch(`/api/courses/${courseId}/posts/${postId}/comments`, { cache: "no-store" });
        const data = (await res.json()) as { comments?: Comment[] };
        if (Array.isArray(data.comments)) setCommentsByPost((m) => ({ ...m, [postId]: data.comments! }));
      } catch {
        /* ignore */
      }
    },
    [courseId]
  );

  async function submitPost() {
    const t = pTitle.trim();
    if (!t) return;
    const res = await fetch(`/api/courses/${courseId}/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, title: t, body: pBody }),
    });
    if (res.ok) {
      setPTitle("");
      setPBody("");
      setComposing(false);
      await loadPosts();
    } else {
      const d = (await res.json()) as { error?: string };
      alert(d.error ?? "등록에 실패했습니다.");
    }
  }

  async function deletePost(id: string) {
    if (!confirm("이 게시글을 삭제할까요?")) return;
    const res = await fetch(`/api/courses/${courseId}/posts/${id}`, { method: "DELETE" });
    if (res.ok) {
      if (openId === id) setOpenId(null);
      await loadPosts();
    }
  }

  function toggle(postId: string) {
    setOpenId((prev) => {
      const next = prev === postId ? null : postId;
      if (next && !commentsByPost[postId]) void loadComments(postId);
      return next;
    });
  }

  async function submitComment(postId: string, body: string, parentCommentId: string | null) {
    const t = body.trim();
    if (!t) return false;
    const res = await fetch(`/api/courses/${courseId}/posts/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: t, parentCommentId }),
    });
    if (res.ok) {
      await loadComments(postId);
      setPosts((ps) => ps.map((p) => (p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p)));
      return true;
    }
    const d = (await res.json()) as { error?: string };
    alert(d.error ?? "댓글 등록에 실패했습니다.");
    return false;
  }

  async function deleteComment(postId: string, commentId: string) {
    if (!confirm("댓글을 삭제할까요? (대댓글도 함께 삭제됩니다)")) return;
    const res = await fetch(`/api/courses/${courseId}/posts/${postId}/comments/${commentId}`, { method: "DELETE" });
    if (res.ok) await loadComments(postId);
  }

  return (
    <div className="flex w-full items-start" style={{ background: "#fff" }}>
      <ClassroomSidebar courseId={courseId} isStaff={isStaff} isParent={isParent} />

      <main className="min-w-0 flex-1 px-6 py-10 lg:px-10">
        <div className="mx-auto max-w-[880px]">
          <Link href={`/course/${courseId}/learn`} className="mb-2 inline-flex items-center gap-1 text-[13px]" style={{ color: BROWN }}>
            <ChevronLeft size={14} /> 강의실
          </Link>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-[30px] font-normal" style={{ ...serif, color: INK, letterSpacing: "-0.02em" }}>{title}</h1>
            {canWrite ? (
              <button
                type="button"
                onClick={() => setComposing((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-[8px] px-4 py-2.5 text-[14px] font-bold text-white transition hover:opacity-90"
                style={{ background: BROWN }}
              >
                {composing ? <X size={15} /> : <PenLine size={15} />} {composing ? "취소" : "글쓰기"}
              </button>
            ) : null}
          </div>

          <div className="mt-6 border-t" style={{ borderColor: LINE }} />

          {composing ? (
            <div className="mt-4 space-y-3 rounded-[14px] p-5" style={{ background: PANEL, border: `1px solid ${LINE}` }}>
              <input value={pTitle} onChange={(e) => setPTitle(e.target.value)} placeholder="제목" className="w-full rounded-[8px] border bg-white px-3.5 py-2.5 text-[15px] outline-none focus:border-[#8C6E59]" style={{ borderColor: "#E7E2D6", color: INK }} />
              <textarea value={pBody} onChange={(e) => setPBody(e.target.value)} rows={5} placeholder="내용을 입력하세요." className="w-full resize-y rounded-[8px] border bg-white px-3.5 py-2.5 text-[14px] leading-7 outline-none focus:border-[#8C6E59]" style={{ borderColor: "#E7E2D6", color: BODY }} />
              <div className="flex justify-end">
                <button type="button" onClick={submitPost} className="rounded-[8px] px-5 py-2.5 text-[14px] font-bold text-white transition hover:opacity-90" style={{ background: BROWN }}>등록</button>
              </div>
            </div>
          ) : null}

          <ul className="mt-2">
            {!ready ? (
              <li className="py-16 text-center text-[14px]" style={{ color: MUTED }}>불러오는 중…</li>
            ) : posts.length === 0 ? (
              <li className="py-16 text-center text-[15px]" style={{ color: SUB }}>{kind === "NOTICE" ? "등록된 공지가 없습니다." : "게시글이 없습니다. 첫 글을 남겨보세요."}</li>
            ) : (
              posts.map((p) => {
                const isOpen = openId === p.id;
                const canDeletePost = canModerate || p.authorId === currentUserId;
                const badge = roleBadge(p.authorRole);
                return (
                  <li key={p.id} className="border-b" style={{ borderColor: "#F0EBE0" }}>
                    <button type="button" onClick={() => toggle(p.id)} className="flex w-full items-center gap-4 py-5 text-left transition hover:opacity-80">
                      <div className="min-w-0 flex-1">
                        <p className="text-[18px] font-semibold" style={{ color: INK }}>{p.title}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px]" style={{ color: SUB }}>
                          <span className="grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold" style={{ background: CARD, color: BROWN }}>{p.authorName.slice(0, 1)}</span>
                          <span style={{ color: BODY }}>{p.authorName}</span>
                          {badge ? <span style={{ color: BROWN }}>{badge}</span> : null}
                          <span style={{ color: "#ddd" }}>|</span>
                          <span style={{ color: MUTED }}>{fmtDate(p.createdAt)}</span>
                          <span style={{ color: "#ddd" }}>|</span>
                          <span className="inline-flex items-center gap-1"><MessageSquare size={14} style={{ color: MUTED }} /> 댓글 <b style={{ color: INK }}>{p.commentCount}</b></span>
                        </div>
                      </div>
                      {isOpen ? <ChevronUp size={20} style={{ color: MUTED }} /> : <ChevronDown size={20} style={{ color: MUTED }} />}
                    </button>

                    {isOpen ? (
                      <div className="pb-6">
                        <div className="rounded-[12px] px-5 py-4 text-[15px] leading-8 whitespace-pre-line" style={{ background: PANEL, color: BODY }}>
                          {p.body || <span style={{ color: MUTED }}>(내용 없음)</span>}
                        </div>
                        {canDeletePost ? (
                          <div className="mt-2 flex justify-end">
                            <button type="button" onClick={() => deletePost(p.id)} className="inline-flex items-center gap-1 text-[12.5px]" style={{ color: "#a6402c" }}>
                              <Trash2 size={13} /> 삭제
                            </button>
                          </div>
                        ) : null}

                        <CommentsSection
                          comments={commentsByPost[p.id] ?? null}
                          canComment={canComment}
                          canModerate={canModerate}
                          currentUserId={currentUserId}
                          onSubmit={(body, parentId) => submitComment(p.id, body, parentId)}
                          onDelete={(commentId) => deleteComment(p.id, commentId)}
                        />
                      </div>
                    ) : null}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </main>
    </div>
  );
}

/* ── 댓글 영역(대댓글 트리) ── */
type Node = Comment & { children: Node[] };
function buildTree(comments: Comment[]): Node[] {
  const map = new Map<string, Node>();
  comments.forEach((c) => map.set(c.id, { ...c, children: [] }));
  const roots: Node[] = [];
  map.forEach((n) => {
    if (n.parentCommentId && map.has(n.parentCommentId)) map.get(n.parentCommentId)!.children.push(n);
    else roots.push(n);
  });
  return roots;
}

function CommentsSection({
  comments,
  canComment,
  canModerate,
  currentUserId,
  onSubmit,
  onDelete,
}: {
  comments: Comment[] | null;
  canComment: boolean;
  canModerate: boolean;
  currentUserId: string;
  onSubmit: (body: string, parentCommentId: string | null) => Promise<boolean>;
  onDelete: (commentId: string) => void;
}) {
  const [text, setText] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const tree = comments ? buildTree(comments) : [];

  async function addTop() {
    const ok = await onSubmit(text, null);
    if (ok) setText("");
  }

  return (
    <div className="mt-4">
      <p className="mb-2 text-[13px] font-bold" style={{ color: DEEP }}>
        댓글 {comments ? comments.length : ""}
      </p>

      {comments === null ? (
        <p className="py-3 text-[13px]" style={{ color: MUTED }}>불러오는 중…</p>
      ) : tree.length === 0 ? (
        <p className="py-2 text-[13px]" style={{ color: SUB }}>아직 댓글이 없습니다.</p>
      ) : (
        <ul className="space-y-3">
          {tree.map((n) => (
            <CommentNode
              key={n.id}
              node={n}
              depth={0}
              canComment={canComment}
              canModerate={canModerate}
              currentUserId={currentUserId}
              replyingTo={replyingTo}
              setReplyingTo={setReplyingTo}
              onSubmit={onSubmit}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}

      {canComment ? (
        <div className="mt-3 flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void addTop();
              }
            }}
            placeholder="댓글을 입력하세요"
            className="h-10 flex-1 rounded-[8px] border px-3 text-[13.5px] outline-none focus:border-[#8C6E59]"
            style={{ borderColor: "#E7E2D6", color: BODY }}
          />
          <button type="button" onClick={() => void addTop()} className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] text-white" style={{ background: BROWN }} aria-label="댓글 등록">
            <Send size={16} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function CommentNode({
  node,
  depth,
  canComment,
  canModerate,
  currentUserId,
  replyingTo,
  setReplyingTo,
  onSubmit,
  onDelete,
}: {
  node: Node;
  depth: number;
  canComment: boolean;
  canModerate: boolean;
  currentUserId: string;
  replyingTo: string | null;
  setReplyingTo: (id: string | null) => void;
  onSubmit: (body: string, parentCommentId: string | null) => Promise<boolean>;
  onDelete: (commentId: string) => void;
}) {
  const [reply, setReply] = useState("");
  const badge = roleBadge(node.authorRole);
  const canDelete = canModerate || node.authorId === currentUserId;
  const isReplying = replyingTo === node.id;
  const indent = Math.min(depth, 4) * 20;

  async function sendReply() {
    const ok = await onSubmit(reply, node.id);
    if (ok) {
      setReply("");
      setReplyingTo(null);
    }
  }

  return (
    <li style={{ marginLeft: indent }}>
      <div className="rounded-[10px] px-3.5 py-2.5" style={{ background: depth === 0 ? PANEL : "#fff", border: `1px solid ${depth === 0 ? "transparent" : LINE}` }}>
        <div className="flex items-center gap-2 text-[12px]" style={{ color: SUB }}>
          {depth > 0 ? <CornerDownRight size={12} style={{ color: MUTED }} /> : null}
          <span className="font-bold" style={{ color: INK }}>{node.authorName}</span>
          {badge ? <span style={{ color: BROWN }}>{badge}</span> : null}
          <span style={{ color: MUTED }}>· {fmtDate(node.createdAt)}</span>
        </div>
        <p className="mt-1 whitespace-pre-line text-[14px] leading-6" style={{ color: BODY }}>{node.body}</p>
        <div className="mt-1.5 flex items-center gap-3 text-[12px]">
          {canComment ? (
            <button type="button" onClick={() => setReplyingTo(isReplying ? null : node.id)} style={{ color: DEEP }}>답글</button>
          ) : null}
          {canDelete ? (
            <button type="button" onClick={() => onDelete(node.id)} style={{ color: "#a6402c" }}>삭제</button>
          ) : null}
        </div>

        {isReplying ? (
          <div className="mt-2 flex items-center gap-2">
            <input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void sendReply();
                }
              }}
              placeholder="답글을 입력하세요"
              className="h-9 flex-1 rounded-[8px] border px-3 text-[13px] outline-none focus:border-[#8C6E59]"
              style={{ borderColor: "#E7E2D6", color: BODY }}
              autoFocus
            />
            <button type="button" onClick={() => void sendReply()} className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] text-white" style={{ background: BROWN }} aria-label="답글 등록">
              <Send size={14} />
            </button>
          </div>
        ) : null}
      </div>

      {node.children.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {node.children.map((c) => (
            <CommentNode
              key={c.id}
              node={c}
              depth={depth + 1}
              canComment={canComment}
              canModerate={canModerate}
              currentUserId={currentUserId}
              replyingTo={replyingTo}
              setReplyingTo={setReplyingTo}
              onSubmit={onSubmit}
              onDelete={onDelete}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
