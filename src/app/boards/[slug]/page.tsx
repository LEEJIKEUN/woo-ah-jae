import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BOARD_SORTS } from "@/lib/board-config";
import { formatKstDateTime } from "@/lib/date-format";
import { getUser } from "@/lib/auth";
import { ensureBoardChannels } from "@/lib/board-service";
import { BoardPostStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ADMISSIONS_COMMUNITY_KEY } from "@/lib/admissions-community-config";

function getOrderBy(sort: string | undefined) {
  switch (sort) {
    case "views":
      return [{ viewCount: "desc" as const }, { createdAt: "desc" as const }];
    case "likes":
      return [{ likeCount: "desc" as const }, { createdAt: "desc" as const }];
    case "comments":
      return [{ commentCount: "desc" as const }, { createdAt: "desc" as const }];
    case "latest":
    default:
      return [{ createdAt: "desc" as const }];
  }
}

export default async function BoardChannelPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    query?: string;
    author?: string;
    keyword?: string;
    mode?: string;
    sort?: string;
    page?: string;
  }>;
}) {
  await ensureBoardChannels();
  const user = await getUser();
  const { slug } = await params;
  const q = await searchParams;

  if (slug === "study-admission") {
    const params = new URLSearchParams();
    params.set("board", "all");
    if (q.query?.trim()) params.set("q", q.query.trim());
    if (q.sort?.trim()) params.set("sort", q.sort.trim());
    if (q.page?.trim()) params.set("page", q.page.trim());
    redirect(`/community/admissions?${params.toString()}`);
  }

  const query = q.query?.trim() ?? "";
  const author = q.author?.trim() ?? "";
  const mode = q.mode === "author" ? "author" : "title-content";
  const keyword = q.keyword?.trim() ?? "";
  const sort = BOARD_SORTS.some((x) => x.value === q.sort) ? q.sort! : "latest";
  const page = Math.max(1, Number(q.page ?? "1"));
  const pageSize = 15;

  const channel = await prisma.boardChannel.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, description: true, communityKey: true },
  });
  if (!channel) notFound();

  if (channel.communityKey === ADMISSIONS_COMMUNITY_KEY) {
    const params = new URLSearchParams();
    params.set("board", slug);
    if (q.query?.trim()) params.set("q", q.query.trim());
    if (q.sort?.trim()) params.set("sort", q.sort.trim());
    if (q.page?.trim()) params.set("page", q.page.trim());
    redirect(`/community/admissions?${params.toString()}`);
  }

  const resolvedQuery = query || (mode === "title-content" ? keyword : "");
  const resolvedAuthor = author || (mode === "author" ? keyword : "");

  const whereBase = {
    boardChannelId: channel.id,
    status: BoardPostStatus.ACTIVE,
    ...(resolvedQuery
      ? {
          OR: [{ title: { contains: resolvedQuery } }, { content: { contains: resolvedQuery } }],
        }
      : {}),
    ...(resolvedAuthor
      ? {
          author: {
            OR: [
              { email: { contains: resolvedAuthor } },
              { studentProfile: { realName: { contains: resolvedAuthor } } },
            ],
          },
        }
      : {}),
  } as const;

  const [notices, total, posts] = await Promise.all([
    prisma.boardPost.findMany({
      where: {
        ...whereBase,
        OR: [{ isNotice: true }, { isPinned: true }],
      },
      orderBy: [{ isPinned: "desc" }, { isNotice: "desc" }, { createdAt: "desc" }],
      include: {
        author: { select: { email: true, studentProfile: { select: { realName: true } } } },
      },
      take: 8,
    }),
    prisma.boardPost.count({
      where: {
        ...whereBase,
        isNotice: false,
        isPinned: false,
      },
    }),
    prisma.boardPost.findMany({
      where: {
        ...whereBase,
        isNotice: false,
        isPinned: false,
      },
      orderBy: getOrderBy(sort),
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        author: { select: { email: true, studentProfile: { select: { realName: true } } } },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <main className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <section className="mx-auto max-w-6xl space-y-5 px-4 py-8 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">{channel.name}</h1>
            <p className="text-sm text-slate-400">{channel.description ?? "커뮤니티 게시판 채널"}</p>
          </div>
          {user ? (
            <Link href={`/boards/${slug}/new`} className="rounded-md bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-white">
              글쓰기
            </Link>
          ) : (
            <Link href={`/login?next=/boards/${slug}`} className="rounded-md border border-slate-500 px-4 py-2 text-sm text-slate-200">
              로그인 후 글쓰기
            </Link>
          )}
        </div>

        <section className="space-y-2 rounded-lg border border-slate-700/70 bg-[color:var(--surface)] p-3">
          <p className="text-sm font-semibold text-slate-100">공지사항</p>
          {notices.length ? (
            <div className="space-y-1">
              {notices.map((item) => (
                <Link key={item.id} href={`/boards/posts/${item.id}`} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-800/40">
                  <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[11px] text-amber-200">
                    {item.isPinned ? "고정" : "공지"}
                  </span>
                  <span className="line-clamp-1 flex-1 text-slate-100">{item.title}</span>
                  <span className="text-xs text-slate-400">{item.author.studentProfile?.realName ?? item.author.email.split("@")[0]}</span>
                  <span className="text-xs text-slate-500">{formatKstDateTime(item.createdAt)}</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="rounded px-2 py-2 text-sm text-slate-400">등록된 공지사항이 없습니다.</p>
          )}
        </section>

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
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
            const params = new URLSearchParams();
            if (query) params.set("query", query);
            if (author) params.set("author", author);
            if (keyword) params.set("keyword", keyword);
            if (mode !== "title-content") params.set("mode", mode);
            if (sort && sort !== "latest") params.set("sort", sort);
            if (p > 1) params.set("page", String(p));
            return (
              <Link
                key={p}
                href={`/boards/${slug}${params.toString() ? `?${params.toString()}` : ""}`}
                className={`min-w-9 rounded-md border px-3 py-1.5 text-center text-sm ${
                  p === page ? "border-slate-100 bg-slate-100 text-slate-900" : "border-slate-600 text-slate-300 hover:border-slate-400"
                }`}
              >
                {p}
              </Link>
            );
          })}
        </div>

        <form className="flex flex-nowrap items-center gap-3 overflow-x-auto rounded-lg border border-slate-700/70 bg-[color:var(--surface)] p-3">
          <select
            defaultValue="all"
            className="h-11 w-40 shrink-0 rounded-md border border-slate-600/80 bg-[color:var(--surface)] px-3 text-sm text-slate-100"
          >
            <option value="all">전체기간</option>
          </select>
          <select
            name="sort"
            defaultValue={sort}
            className="h-11 w-32 shrink-0 rounded-md border border-slate-600/80 bg-[color:var(--surface)] px-3 text-sm text-slate-100"
          >
            {BOARD_SORTS.map((x) => (
              <option key={x.value} value={x.value}>
                {x.label}
              </option>
            ))}
          </select>
          <select
            name="mode"
            defaultValue={mode}
            className="h-11 w-36 shrink-0 rounded-md border border-slate-600/80 bg-[color:var(--surface)] px-3 text-sm text-slate-100"
          >
            <option value="title-content">제목+내용</option>
            <option value="author">작성자</option>
          </select>
          <div className="flex min-w-[320px] flex-1 items-center overflow-hidden rounded-md border border-slate-600/80">
            <input
              name="keyword"
              defaultValue={keyword}
              placeholder="검색어를 입력해주세요"
              className="h-11 w-full bg-transparent px-3 text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none"
            />
            <button className="h-11 w-24 shrink-0 bg-emerald-500 px-4 text-sm font-semibold text-white hover:bg-emerald-400">
              검색
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
