import Link from "next/link";
import { formatKstDateTime } from "@/lib/date-format";

type PostItem = {
  id: string;
  categoryTag: string | null;
  title: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  isPinned: boolean;
  createdAt: Date;
  boardChannel: { name: string; slug: string };
  author: { email: string; studentProfile: { realName: string } | null };
};

type Props = {
  title: string;
  boardParam: string;
  writeSlug: string | null;
  query: string;
  sort: "latest" | "views" | "likes" | "comments";
  page: number;
  totalPages: number;
  noticePosts: PostItem[];
  posts: PostItem[];
  canWrite: boolean;
  hrefFor: (board: string, nextPage?: number) => string;
};

export default function AdmissionsBoardMain({
  title,
  boardParam,
  writeSlug,
  query,
  sort,
  page,
  totalPages,
  noticePosts,
  posts,
  canWrite,
  hrefFor,
}: Props) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">{title}</h1>
          <p className="text-sm text-slate-400">독립 게시판 구조로 운영되는 입시 커뮤니티</p>
        </div>
        {canWrite && writeSlug ? (
          <Link href={`/boards/${writeSlug}/new`} className="rounded-md bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-white">
            글쓰기
          </Link>
        ) : null}
      </div>

      <form className="flex flex-nowrap items-center gap-2 overflow-x-auto rounded-lg border border-slate-700/70 bg-[color:var(--surface)] p-3">
        <input type="hidden" name="board" value={boardParam} />
        <select name="sort" defaultValue={sort} className="h-10 w-32 shrink-0 rounded-md border border-slate-600/80 bg-transparent px-2 text-sm text-slate-100">
          <option value="latest">최신순</option>
          <option value="views">조회순</option>
          <option value="likes">추천순</option>
          <option value="comments">댓글많은순</option>
        </select>
        <input name="q" defaultValue={query} placeholder="검색" className="h-10 min-w-[240px] flex-1 rounded-md border border-slate-600/80 bg-transparent px-3 text-sm text-slate-100" />
        <button className="h-10 w-20 shrink-0 rounded-md bg-emerald-500 text-sm font-semibold text-white hover:bg-emerald-400">검색</button>
      </form>

      {noticePosts.length ? (
        <section className="space-y-2 rounded-lg border border-slate-700/70 bg-[color:var(--surface)] p-3">
          <p className="text-sm font-semibold text-slate-100">공지사항</p>
          <div className="space-y-1">
            {noticePosts.map((item) => (
              <Link key={item.id} href={`/boards/posts/${item.id}`} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-800/40">
                <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[11px] text-amber-200">{item.isPinned ? "고정" : "공지"}</span>
                <span className="line-clamp-1 flex-1 text-slate-100">{item.title}</span>
                <span className="text-xs text-slate-400">{item.boardChannel.name}</span>
                <span className="text-xs text-slate-500">{formatKstDateTime(item.createdAt)}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-lg border border-slate-700/70 bg-[color:var(--surface)]">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-900/50 text-slate-300">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-semibold tracking-wide text-slate-400">말머리</th>
              <th className="px-3 py-3 text-left text-xs font-semibold tracking-wide text-slate-400">제목</th>
              <th className="px-3 py-3 text-left text-xs font-semibold tracking-wide text-slate-400">작성자</th>
              <th className="px-3 py-3 text-left text-xs font-semibold tracking-wide text-slate-400">작성일</th>
              <th className="px-3 py-3 text-right text-xs font-semibold tracking-wide text-slate-400">조회</th>
              <th className="px-3 py-3 text-right text-xs font-semibold tracking-wide text-slate-400">추천</th>
              <th className="px-3 py-3 text-right text-xs font-semibold tracking-wide text-slate-400">댓글</th>
            </tr>
          </thead>
          <tbody>
            {posts.length === 0 ? (
              <tr>
                <td className="px-3 py-8 text-center text-slate-400" colSpan={7}>
                  게시글이 없습니다.
                </td>
              </tr>
            ) : (
              posts.map((item) => (
                <tr key={item.id} className="border-t border-slate-800/80 transition-colors hover:bg-slate-800/30">
                  <td className="px-3 py-3 text-xs text-slate-400">{item.categoryTag ?? "-"}</td>
                  <td className="px-3 py-3">
                    <Link href={`/boards/posts/${item.id}`} className="line-clamp-1 text-[15px] font-medium text-slate-100 hover:text-white">
                      {item.title}
                    </Link>
                    {item.commentCount > 0 ? (
                      <span className="ml-2 inline-flex rounded-full bg-rose-500/20 px-1.5 py-0.5 text-[11px] font-semibold text-rose-300">
                        {item.commentCount}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-400">{item.author.studentProfile?.realName ?? item.author.email.split("@")[0]}</td>
                  <td className="px-3 py-3 text-xs text-slate-500">{formatKstDateTime(item.createdAt)}</td>
                  <td className="px-3 py-3 text-right text-xs text-slate-400">{item.viewCount}</td>
                  <td className="px-3 py-3 text-right text-xs text-slate-400">{item.likeCount}</td>
                  <td className="px-3 py-3 text-right text-xs text-slate-400">{item.commentCount}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <div className="flex items-center justify-center gap-2">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
          <Link
            key={p}
            href={hrefFor(boardParam, p)}
            className={`min-w-9 rounded-md border px-3 py-1.5 text-center text-sm ${
              p === page ? "border-slate-100 bg-slate-100 text-slate-900" : "border-slate-600 text-slate-300 hover:border-slate-400"
            }`}
          >
            {p}
          </Link>
        ))}
      </div>
    </section>
  );
}
