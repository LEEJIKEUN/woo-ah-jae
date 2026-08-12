"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Search, ThumbsUp, MessageSquare, PenLine, X } from "lucide-react";
import ClassroomSidebar from "@/components/course/ClassroomSidebar";

const BROWN = "#8C6E59";
const INK = "#2C2823";
const BODY = "#334155";
const SUB = "#8A8479";
const MUTED = "#94a3b8";
const LINE = "#E4DBC7";
const CARD = "#EFEBE1";
const PANEL = "#FBF8F2";
const serif = { fontFamily: "var(--font-serif)" } as const;

type Post = { id: string; title: string; body: string; author: string; date: string; likes: number; comments: number; ts: number };
type SortKey = "recent" | "likes" | "comments";
const SORTS: { key: SortKey; label: string }[] = [
  { key: "recent", label: "최신순" },
  { key: "likes", label: "추천순" },
  { key: "comments", label: "댓글 많은 순" },
];

const SEED_POSTS: Post[] = [
  { id: "p1", title: "3장 선형결합 '네 관점' 정리 공유합니다", body: "내적·열의 결합·행의 결합·외적의 합, 이렇게 네 가지로 행렬곱을 보니 훨씬 명확해졌어요. 정리 노트 붙여둡니다.", author: "정민서", date: "2026.08.31", likes: 12, comments: 6, ts: 1756604400000 },
  { id: "p2", title: "실습1 NumPy에서 @ 연산자와 dot의 차이가 뭔가요?", body: "행렬 곱에서 @랑 np.dot 결과가 같던데, 언제 뭘 써야 하나요?", author: "박하은", date: "2026.08.19", likes: 5, comments: 4, ts: 1755565200000 },
  { id: "p3", title: "선형변환에서 표준행렬 구하는 순서가 헷갈려요", body: "기저 벡터의 상을 열로 세우면 된다고 하셨는데, 예시 하나만 더 볼 수 있을까요?", author: "이서준", date: "2026.08.20", likes: 3, comments: 2, ts: 1755651600000 },
];

export default function BoardView({ courseId, isStaff = false }: { courseId: string; isStaff?: boolean }) {
  const [posts, setPosts] = useState<Post[]>(SEED_POSTS);
  const [sort, setSort] = useState<SortKey>("recent");
  const [query, setQuery] = useState("");
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(`wj_board_${courseId}`);
      if (raw) setPosts(JSON.parse(raw) as Post[]);
    } catch {
      /* 무시 */
    }
  }, [courseId]);

  function persist(next: Post[]) {
    setPosts(next);
    try {
      window.localStorage.setItem(`wj_board_${courseId}`, JSON.stringify(next));
    } catch {
      /* 무시 */
    }
  }

  function submitPost() {
    const t = title.trim();
    if (!t) return;
    const now = new Date();
    const date = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;
    const post: Post = { id: `p_${now.getTime()}`, title: t, body: body.trim(), author: "나", date, likes: 0, comments: 0, ts: now.getTime() };
    persist([post, ...posts]);
    setTitle("");
    setBody("");
    setComposing(false);
    setSort("recent");
  }

  function like(id: string) {
    persist(posts.map((p) => (p.id === id ? { ...p, likes: p.likes + 1 } : p)));
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? posts.filter((p) => p.title.toLowerCase().includes(q)) : posts;
    const sorted = [...filtered].sort((a, b) => {
      if (sort === "likes") return b.likes - a.likes;
      if (sort === "comments") return b.comments - a.comments;
      return b.ts - a.ts;
    });
    return sorted;
  }, [posts, query, sort]);

  return (
    <div className="flex w-full items-start" style={{ background: "#fff" }}>
      <ClassroomSidebar courseId={courseId} isStaff={isStaff} />

      <main className="min-w-0 flex-1 px-6 py-10 lg:px-10">
        <div className="mx-auto max-w-[900px]">
          <Link href={`/course/${courseId}/learn`} className="mb-2 inline-flex items-center gap-1 text-[13px]" style={{ color: BROWN }}>
            <ChevronLeft size={14} /> 강의실
          </Link>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-[30px] font-normal" style={{ ...serif, color: INK, letterSpacing: "-0.02em" }}>수강생 토론 게시판</h1>
            <div className="flex items-center gap-2 rounded-full border px-3.5 py-2" style={{ borderColor: LINE, background: PANEL }}>
              <Search size={15} style={{ color: MUTED }} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="제목을 입력하세요." className="w-40 bg-transparent text-[13.5px] outline-none" style={{ color: BODY }} />
            </div>
          </div>

          <div className="mt-6 border-t" style={{ borderColor: LINE }} />

          {/* 정렬 + 글쓰기 (강의선택/전체보기 토글 없음) */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4 text-[14px]">
              {SORTS.map((s) => {
                const on = sort === s.key;
                return (
                  <button key={s.key} type="button" onClick={() => setSort(s.key)} className="transition" style={{ color: on ? INK : MUTED, fontWeight: on ? 700 : 400 }}>
                    {on ? "✓ " : ""}{s.label}
                  </button>
                );
              })}
            </div>
            <button type="button" onClick={() => setComposing((v) => !v)} className="inline-flex items-center gap-1.5 rounded-[8px] px-4 py-2.5 text-[14px] font-bold text-white transition hover:opacity-90" style={{ background: BROWN }}>
              {composing ? <X size={15} /> : <PenLine size={15} />} {composing ? "취소" : "글쓰기"}
            </button>
          </div>

          {/* 글쓰기 폼 */}
          {composing ? (
            <div className="mt-4 space-y-3 rounded-[14px] p-5" style={{ background: PANEL, border: `1px solid ${LINE}` }}>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목" className="w-full rounded-[8px] border bg-white px-3.5 py-2.5 text-[15px] outline-none focus:border-[#8C6E59]" style={{ borderColor: "#E7E2D6", color: INK }} />
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="내용을 입력하세요." className="w-full resize-y rounded-[8px] border bg-white px-3.5 py-2.5 text-[14px] leading-7 outline-none focus:border-[#8C6E59]" style={{ borderColor: "#E7E2D6", color: BODY }} />
              <div className="flex justify-end">
                <button type="button" onClick={submitPost} className="rounded-[8px] px-5 py-2.5 text-[14px] font-bold text-white transition hover:opacity-90" style={{ background: BROWN }}>등록</button>
              </div>
            </div>
          ) : null}

          {/* 목록 */}
          <ul className="mt-4">
            {visible.length === 0 ? (
              <li className="py-16 text-center text-[15px]" style={{ color: SUB }}>게시글이 없습니다.</li>
            ) : (
              visible.map((p) => (
                <li key={p.id} className="border-b py-6" style={{ borderColor: "#F0EBE0" }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-[18px] font-semibold" style={{ color: INK }}>{p.title}</p>
                      {p.body ? <p className="mt-1.5 line-clamp-2 text-[14px] leading-6" style={{ color: SUB }}>{p.body}</p> : null}
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]" style={{ color: SUB }}>
                        <span className="grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold" style={{ background: CARD, color: BROWN }}>{p.author.slice(0, 1)}</span>
                        <span style={{ color: BODY }}>{p.author}</span>
                        <span style={{ color: "#ddd" }}>|</span>
                        <span style={{ color: MUTED }}>{p.date}</span>
                        <span style={{ color: "#ddd" }}>|</span>
                        <button type="button" onClick={() => like(p.id)} className="inline-flex items-center gap-1 hover:opacity-70">
                          <ThumbsUp size={14} style={{ color: BROWN }} /> 추천 <b style={{ color: INK }}>{p.likes}</b>
                        </button>
                        <span className="inline-flex items-center gap-1">
                          <MessageSquare size={14} style={{ color: MUTED }} /> 댓글 <b style={{ color: INK }}>{p.comments}</b>
                        </span>
                      </div>
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </main>
    </div>
  );
}
