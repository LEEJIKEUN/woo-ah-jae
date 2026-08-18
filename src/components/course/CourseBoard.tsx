"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronDown, ChevronUp, PenLine, X, MessageSquare, Trash2, CornerDownRight, Send, Pencil, Heart, Eye, Smile, Paperclip, Download } from "lucide-react";
import ClassroomSidebar from "@/components/course/ClassroomSidebar";
import MentionField, { type Member } from "@/components/course/MentionField";
import LinkifiedText from "@/components/LinkifiedText";
import EmojiPicker from "@/components/ui/EmojiPicker";

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
  likeCount: number;
  likedByMe: boolean;
  viewCount: number;
};
type CommentFile = { name: string; size: number; mime: string };
type Comment = {
  id: string;
  body: string;
  parentCommentId: string | null;
  createdAt: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  file: CommentFile | null;
  likeCount: number;
  likedByMe: boolean;
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
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editPostTitle, setEditPostTitle] = useState("");
  const [editPostBody, setEditPostBody] = useState("");
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    let alive = true;
    fetch(`/api/courses/${courseId}/members`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { members: [] }))
      .then((d) => { if (alive) setMembers(Array.isArray(d.members) ? d.members : []); })
      .catch(() => {});
    return () => { alive = false; };
  }, [courseId]);

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
      if (next) {
        if (!commentsByPost[postId]) void loadComments(postId);
        // 조회수 +1
        void fetch(`/api/courses/${courseId}/posts/${postId}/view`, { method: "POST" }).catch(() => {});
        setPosts((ps) => ps.map((p) => (p.id === postId ? { ...p, viewCount: p.viewCount + 1 } : p)));
      }
      return next;
    });
  }

  async function likePost(postId: string) {
    // 낙관적 토글
    setPosts((ps) => ps.map((p) => (p.id === postId ? { ...p, likedByMe: !p.likedByMe, likeCount: p.likeCount + (p.likedByMe ? -1 : 1) } : p)));
    try {
      const res = await fetch(`/api/courses/${courseId}/posts/${postId}/like`, { method: "POST" });
      const d = (await res.json().catch(() => ({}))) as { liked?: boolean; likeCount?: number };
      if (res.ok) setPosts((ps) => ps.map((p) => (p.id === postId ? { ...p, likedByMe: !!d.liked, likeCount: d.likeCount ?? p.likeCount } : p)));
    } catch {
      /* 무시 */
    }
  }

  async function submitComment(postId: string, body: string, parentCommentId: string | null, file?: { name: string; size: number; mime: string; dataUrl: string } | null) {
    const t = body.trim();
    if (!t && !file) return false;
    const res = await fetch(`/api/courses/${courseId}/posts/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: t, parentCommentId, ...(file ? { file } : {}) }),
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

  async function likeComment(postId: string, commentId: string) {
    setCommentsByPost((m) => {
      const list = m[postId];
      if (!list) return m;
      return { ...m, [postId]: list.map((c) => (c.id === commentId ? { ...c, likedByMe: !c.likedByMe, likeCount: c.likeCount + (c.likedByMe ? -1 : 1) } : c)) };
    });
    try {
      const res = await fetch(`/api/courses/${courseId}/posts/${postId}/comments/${commentId}/like`, { method: "POST" });
      const d = (await res.json().catch(() => ({}))) as { liked?: boolean; likeCount?: number };
      if (res.ok) {
        setCommentsByPost((m) => {
          const list = m[postId];
          if (!list) return m;
          return { ...m, [postId]: list.map((c) => (c.id === commentId ? { ...c, likedByMe: !!d.liked, likeCount: d.likeCount ?? c.likeCount } : c)) };
        });
      }
    } catch {
      /* 무시 */
    }
  }

  async function deleteComment(postId: string, commentId: string) {
    if (!confirm("댓글을 삭제할까요? (대댓글도 함께 삭제됩니다)")) return;
    const res = await fetch(`/api/courses/${courseId}/posts/${postId}/comments/${commentId}`, { method: "DELETE" });
    if (res.ok) await loadComments(postId);
  }

  function startEditPost(p: Post) {
    setEditingPostId(p.id);
    setEditPostTitle(p.title);
    setEditPostBody(p.body);
  }
  async function saveEditPost(id: string) {
    const t = editPostTitle.trim();
    if (!t) return;
    const res = await fetch(`/api/courses/${courseId}/posts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: t, body: editPostBody }),
    });
    if (res.ok) {
      setEditingPostId(null);
      await loadPosts();
    } else {
      const d = (await res.json()) as { error?: string };
      alert(d.error ?? "수정에 실패했습니다.");
    }
  }

  async function editComment(postId: string, commentId: string, body: string) {
    const t = body.trim();
    if (!t) return false;
    const res = await fetch(`/api/courses/${courseId}/posts/${postId}/comments/${commentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: t }),
    });
    if (res.ok) {
      await loadComments(postId);
      return true;
    }
    const d = (await res.json()) as { error?: string };
    alert(d.error ?? "댓글 수정에 실패했습니다.");
    return false;
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
              <MentionField value={pBody} onChange={setPBody} members={members} rows={5} placeholder="내용을 입력하세요. @이름 으로 수강생을 언급할 수 있어요." className="w-full resize-y rounded-[8px] border bg-white px-3.5 py-2.5 text-[14px] leading-7 outline-none focus:border-[#8C6E59]" style={{ borderColor: "#E7E2D6", color: BODY }} />
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
                const canEditPost = p.authorId === currentUserId;
                const badge = roleBadge(p.authorRole);
                return (
                  <li key={p.id} className="border-b" style={{ borderColor: "#F0EBE0" }}>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => toggle(p.id)} className="flex min-w-0 flex-1 items-center gap-4 py-5 text-left transition hover:opacity-80">
                        <div className="min-w-0 flex-1">
                          <p className="text-[18px] font-semibold" style={{ color: INK }}>{p.title}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px]" style={{ color: SUB }}>
                            <span className="grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold" style={{ background: CARD, color: BROWN }}>{p.authorName.slice(0, 1)}</span>
                            <span style={{ color: BODY }}>{p.authorName}</span>
                            {badge ? <span style={{ color: BROWN }}>{badge}</span> : null}
                            <span style={{ color: "#ddd" }}>|</span>
                            <span style={{ color: MUTED }}>{fmtDate(p.createdAt)}</span>
                            <span style={{ color: "#ddd" }}>|</span>
                            <span className="inline-flex items-center gap-1"><MessageSquare size={14} style={{ color: MUTED }} /> <b style={{ color: INK }}>{p.commentCount}</b></span>
                            <span className="inline-flex items-center gap-1"><Eye size={14} style={{ color: MUTED }} /> {p.viewCount}</span>
                          </div>
                        </div>
                        {isOpen ? <ChevronUp size={20} style={{ color: MUTED }} /> : <ChevronDown size={20} style={{ color: MUTED }} />}
                      </button>
                      <button type="button" onClick={() => void likePost(p.id)} className="flex shrink-0 flex-col items-center gap-0.5 rounded-[10px] px-2.5 py-1.5 transition hover:bg-[#FBF6EC]" aria-label="좋아요" title="좋아요">
                        <Heart size={18} style={{ color: p.likedByMe ? "#d1493a" : MUTED }} fill={p.likedByMe ? "#d1493a" : "none"} />
                        <span className="text-[12px] font-semibold" style={{ color: p.likedByMe ? "#d1493a" : SUB }}>{p.likeCount}</span>
                      </button>
                    </div>

                    {isOpen ? (
                      <div className="pb-6">
                        {editingPostId === p.id ? (
                          <div className="space-y-2 rounded-[12px] p-4" style={{ background: PANEL, border: `1px solid ${LINE}` }}>
                            <input value={editPostTitle} onChange={(e) => setEditPostTitle(e.target.value)} placeholder="제목" className="w-full rounded-[8px] border bg-white px-3.5 py-2.5 text-[15px] outline-none focus:border-[#8C6E59]" style={{ borderColor: "#E7E2D6", color: INK }} />
                            <MentionField value={editPostBody} onChange={setEditPostBody} members={members} rows={5} placeholder="내용을 입력하세요. @이름 으로 수강생을 언급할 수 있어요." className="w-full resize-y rounded-[8px] border bg-white px-3.5 py-2.5 text-[14px] leading-7 outline-none focus:border-[#8C6E59]" style={{ borderColor: "#E7E2D6", color: BODY }} />
                            <div className="flex justify-end gap-2">
                              <button type="button" onClick={() => setEditingPostId(null)} className="rounded-[8px] border px-4 py-2 text-[13px] font-semibold" style={{ borderColor: LINE, color: SUB }}>취소</button>
                              <button type="button" onClick={() => void saveEditPost(p.id)} className="rounded-[8px] px-5 py-2 text-[13px] font-bold text-white" style={{ background: BROWN }}>저장</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="rounded-[12px] px-5 py-4" style={{ background: PANEL }}>
                              {p.body ? <LinkifiedText text={p.body} className="block text-[15px] leading-8" style={{ color: BODY }} /> : <span className="text-[15px]" style={{ color: MUTED }}>(내용 없음)</span>}
                            </div>
                            {canEditPost || canDeletePost ? (
                              <div className="mt-2 flex justify-end gap-3">
                                {canEditPost ? (
                                  <button type="button" onClick={() => startEditPost(p)} className="inline-flex items-center gap-1 text-[12.5px]" style={{ color: DEEP }}>
                                    <Pencil size={13} /> 수정
                                  </button>
                                ) : null}
                                {canDeletePost ? (
                                  <button type="button" onClick={() => deletePost(p.id)} className="inline-flex items-center gap-1 text-[12.5px]" style={{ color: "#a6402c" }}>
                                    <Trash2 size={13} /> 삭제
                                  </button>
                                ) : null}
                              </div>
                            ) : null}
                          </>
                        )}

                        <CommentsSection
                          comments={commentsByPost[p.id] ?? null}
                          courseId={courseId}
                          postId={p.id}
                          members={members}
                          canComment={canComment}
                          canModerate={canModerate}
                          currentUserId={currentUserId}
                          onSubmit={(body, parentId, file) => submitComment(p.id, body, parentId, file)}
                          onDelete={(commentId) => deleteComment(p.id, commentId)}
                          onEdit={(commentId, body) => editComment(p.id, commentId, body)}
                          onLike={(commentId) => likeComment(p.id, commentId)}
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

type UpFile = { name: string; size: number; mime: string; dataUrl: string };
function readAsDataUrl(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error("read"));
    r.readAsDataURL(f);
  });
}

/** 이모지·파일첨부(10MB) 지원 댓글/답글 작성칸. onSubmit 성공 시 true 반환. */
function CommentComposer({ members, onSubmit, placeholder, compact = false }: { members: Member[]; onSubmit: (body: string, file: UpFile | null) => Promise<boolean>; placeholder: string; compact?: boolean }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<UpFile | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const h = compact ? "h-9" : "h-10";

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { setErr("파일이 너무 큽니다. (최대 10MB)"); return; }
    setErr(null);
    try {
      setFile({ name: f.name, size: f.size, mime: f.type, dataUrl: await readAsDataUrl(f) });
    } catch {
      setErr("파일을 읽지 못했습니다.");
    }
  }
  async function submit() {
    if (busy) return;
    if (!text.trim() && !file) return;
    setBusy(true);
    setErr(null);
    const ok = await onSubmit(text, file);
    setBusy(false);
    if (ok) { setText(""); setFile(null); }
    else setErr("등록에 실패했습니다.");
  }
  const iconBtn = `grid ${h} w-9 shrink-0 place-items-center rounded-[8px] border transition hover:border-[#8C6E59]`;

  return (
    <div className="mt-3">
      {err ? <p className="mb-1 text-[11.5px] font-semibold" style={{ color: "#a6402c" }}>{err}</p> : null}
      {file ? (
        <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-[6px] border px-2 py-1 text-[11.5px]" style={{ borderColor: LINE, color: DEEP }}>
          📎 <span className="max-w-[180px] truncate">{file.name}</span>
          <button type="button" onClick={() => setFile(null)} aria-label="첨부 취소" style={{ color: MUTED }}><X size={12} /></button>
        </div>
      ) : null}
      <div className="flex items-end gap-1.5">
        <div className="relative">
          <button type="button" onClick={() => setEmojiOpen((v) => !v)} className={iconBtn} style={{ borderColor: "#E7E2D6", color: BROWN }} aria-label="이모지"><Smile size={16} /></button>
          {emojiOpen ? <EmojiPicker onPick={(em) => setText((t) => t + em)} onClose={() => setEmojiOpen(false)} /> : null}
        </div>
        <input ref={fileRef} type="file" onChange={onFile} className="hidden" />
        <button type="button" onClick={() => fileRef.current?.click()} className={iconBtn} style={{ borderColor: "#E7E2D6", color: BROWN }} aria-label="파일 첨부"><Paperclip size={15} /></button>
        <div className="min-w-0 flex-1">
          <MentionField as="textarea" rows={1} value={text} onChange={setText} members={members} onEnter={() => void submit()} placeholder={placeholder} className={`max-h-40 w-full resize-none rounded-[8px] border px-3 py-2 text-[13.5px] leading-6 outline-none [field-sizing:content] focus:border-[#8C6E59]`} style={{ borderColor: "#E7E2D6", color: BODY, minHeight: 38 }} />
        </div>
        <button type="button" onClick={() => void submit()} disabled={busy} className={`grid ${h} w-9 shrink-0 place-items-center rounded-[8px] text-white disabled:opacity-50`} style={{ background: BROWN }} aria-label="등록"><Send size={compact ? 14 : 16} /></button>
      </div>
    </div>
  );
}

function CommentsSection({
  comments,
  courseId,
  postId,
  members,
  canComment,
  canModerate,
  currentUserId,
  onSubmit,
  onDelete,
  onEdit,
  onLike,
}: {
  comments: Comment[] | null;
  courseId: string;
  postId: string;
  members: Member[];
  canComment: boolean;
  canModerate: boolean;
  currentUserId: string;
  onSubmit: (body: string, parentCommentId: string | null, file?: { name: string; size: number; mime: string; dataUrl: string } | null) => Promise<boolean>;
  onDelete: (commentId: string) => void;
  onEdit: (commentId: string, body: string) => Promise<boolean>;
  onLike: (commentId: string) => void;
}) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const tree = comments ? buildTree(comments) : [];

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
              courseId={courseId}
              postId={postId}
              members={members}
              canComment={canComment}
              canModerate={canModerate}
              currentUserId={currentUserId}
              replyingTo={replyingTo}
              setReplyingTo={setReplyingTo}
              onSubmit={onSubmit}
              onDelete={onDelete}
              onEdit={onEdit}
              onLike={onLike}
            />
          ))}
        </ul>
      )}

      {canComment ? (
        <CommentComposer members={members} placeholder="댓글을 입력하세요 (@이름 언급 가능)" onSubmit={(body, file) => onSubmit(body, null, file)} />
      ) : null}
    </div>
  );
}

function CommentNode({
  node,
  depth,
  courseId,
  postId,
  members,
  canComment,
  canModerate,
  currentUserId,
  replyingTo,
  setReplyingTo,
  onSubmit,
  onDelete,
  onEdit,
  onLike,
}: {
  node: Node;
  depth: number;
  courseId: string;
  postId: string;
  members: Member[];
  canComment: boolean;
  canModerate: boolean;
  currentUserId: string;
  replyingTo: string | null;
  setReplyingTo: (id: string | null) => void;
  onSubmit: (body: string, parentCommentId: string | null, file?: { name: string; size: number; mime: string; dataUrl: string } | null) => Promise<boolean>;
  onDelete: (commentId: string) => void;
  onEdit: (commentId: string, body: string) => Promise<boolean>;
  onLike: (commentId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(node.body);
  const badge = roleBadge(node.authorRole);
  const canDelete = canModerate || node.authorId === currentUserId;
  const canEdit = node.authorId === currentUserId;
  const isReplying = replyingTo === node.id;
  const indent = Math.min(depth, 4) * 20;

  async function saveEdit() {
    const ok = await onEdit(node.id, editText);
    if (ok) setEditing(false);
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
        {editing ? (
          <div className="mt-1.5 flex items-center gap-2">
            <input
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); void saveEdit(); }
                if (e.key === "Escape") setEditing(false);
              }}
              className="h-9 flex-1 rounded-[8px] border px-3 text-[13px] outline-none focus:border-[#8C6E59]"
              style={{ borderColor: BROWN, color: BODY }}
              autoFocus
            />
            <button type="button" onClick={() => void saveEdit()} className="rounded-[8px] px-3 py-2 text-[12px] font-bold text-white" style={{ background: BROWN }}>저장</button>
            <button type="button" onClick={() => setEditing(false)} className="rounded-[8px] border px-3 py-2 text-[12px] font-semibold" style={{ borderColor: LINE, color: SUB }}>취소</button>
          </div>
        ) : (
          <>
            {node.body ? <LinkifiedText text={node.body} className="mt-1 block text-[14px] leading-6" style={{ color: BODY }} /> : null}
            {node.file ? (
              <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-[8px] border px-2.5 py-1.5 text-[12.5px]" style={{ borderColor: LINE, color: DEEP }}>
                <a href={`/api/courses/${courseId}/posts/${postId}/comments/${node.id}/file`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline" title="새 탭에서 보기">📎 <span className="max-w-[220px] truncate">{node.file.name}</span></a>
                <a href={`/api/courses/${courseId}/posts/${postId}/comments/${node.id}/file?download=1`} className="shrink-0 opacity-80 hover:opacity-100" aria-label="다운로드" title="다운로드"><Download size={13} /></a>
              </div>
            ) : null}
          </>
        )}
        <div className="mt-1.5 flex items-center gap-3 text-[12px]">
          <button type="button" onClick={() => onLike(node.id)} className="inline-flex items-center gap-1" aria-label="좋아요" title="좋아요">
            <Heart size={14} style={{ color: node.likedByMe ? "#d1493a" : MUTED }} fill={node.likedByMe ? "#d1493a" : "none"} />
            {node.likeCount > 0 ? <span style={{ color: node.likedByMe ? "#d1493a" : SUB }}>{node.likeCount}</span> : null}
          </button>
          {canComment ? (
            <button type="button" onClick={() => setReplyingTo(isReplying ? null : node.id)} style={{ color: DEEP }}>답글</button>
          ) : null}
          {canEdit && !editing ? (
            <button type="button" onClick={() => { setEditText(node.body); setEditing(true); }} style={{ color: DEEP }}>수정</button>
          ) : null}
          {canDelete ? (
            <button type="button" onClick={() => onDelete(node.id)} style={{ color: "#a6402c" }}>삭제</button>
          ) : null}
        </div>

        {isReplying ? (
          <CommentComposer
            compact
            members={members}
            placeholder="답글을 입력하세요 (@이름 언급 가능)"
            onSubmit={async (body, file) => {
              const ok = await onSubmit(body, node.id, file);
              if (ok) setReplyingTo(null);
              return ok;
            }}
          />
        ) : null}
      </div>

      {node.children.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {node.children.map((c) => (
            <CommentNode
              key={c.id}
              node={c}
              depth={depth + 1}
              courseId={courseId}
              postId={postId}
              members={members}
              canComment={canComment}
              canModerate={canModerate}
              currentUserId={currentUserId}
              replyingTo={replyingTo}
              setReplyingTo={setReplyingTo}
              onSubmit={onSubmit}
              onDelete={onDelete}
              onEdit={onEdit}
              onLike={onLike}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
