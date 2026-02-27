import { notFound } from "next/navigation";
import { BoardPostStatus } from "@prisma/client";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ADMISSIONS_COMMUNITY_KEY } from "@/lib/admissions-community-config";
import { listAdmissionsSidebar } from "@/lib/board-service";
import AdmissionsBoardLayout from "@/components/community/AdmissionsBoardLayout";
import AdmissionsSidebar from "@/components/community/AdmissionsSidebar";
import AdmissionsBoardMain from "@/components/community/AdmissionsBoardMain";

function orderByFor(sort: string) {
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

export default async function AdmissionsCommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ board?: string; q?: string; sort?: string; page?: string }>;
}) {
  const user = await getUser();
  const params = await searchParams;

  const boardParam = params.board?.trim() || "all";
  const query = params.q?.trim() || "";
  const sort = ["latest", "views", "likes", "comments"].includes(params.sort || "")
    ? (params.sort as "latest" | "views" | "likes" | "comments")
    : "latest";
  const page = Math.max(1, Number(params.page || "1"));
  const pageSize = 20;

  const sidebar = await listAdmissionsSidebar();
  const flatBoards = sidebar.groups.flatMap((group) => group.boards);
  const boardSet = new Set(flatBoards.map((item) => item.slug));
  if (boardParam !== "all" && boardParam !== "notice" && !boardSet.has(boardParam)) {
    notFound();
  }

  const activeBoard =
    boardParam === "all"
      ? null
      : await prisma.boardChannel.findUnique({
          where: { slug: boardParam },
          select: { id: true, slug: true, name: true, isNotice: true, communityKey: true },
        });

  if (boardParam !== "all" && (!activeBoard || activeBoard.communityKey !== ADMISSIONS_COMMUNITY_KEY)) {
    notFound();
  }

  const communityBoardIds = await prisma.boardChannel.findMany({
    where: { communityKey: ADMISSIONS_COMMUNITY_KEY, isNotice: false },
    select: { id: true, slug: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  const boardIds = communityBoardIds.map((item) => item.id);
  const defaultWriteSlug = communityBoardIds[0]?.slug ?? null;
  const writeSlug = activeBoard && !activeBoard.isNotice ? activeBoard.slug : defaultWriteSlug;

  const boardFilter = boardParam === "all" ? { in: boardIds } : activeBoard!.id;
  const searchFilter = query
    ? { OR: [{ title: { contains: query } }, { content: { contains: query } }] }
    : {};

  const [noticePosts, total, posts] = await Promise.all([
    prisma.boardPost.findMany({
      where: {
        boardChannelId: boardFilter,
        status: BoardPostStatus.ACTIVE,
        ...searchFilter,
        OR: [{ isNotice: true }, { isPinned: true }],
      },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      include: {
        author: { select: { email: true, studentProfile: { select: { realName: true } } } },
        boardChannel: { select: { name: true, slug: true } },
      },
      take: 10,
    }),
    prisma.boardPost.count({
      where: {
        boardChannelId: boardFilter,
        status: BoardPostStatus.ACTIVE,
        ...searchFilter,
        isNotice: false,
        isPinned: false,
      },
    }),
    prisma.boardPost.findMany({
      where: {
        boardChannelId: boardFilter,
        status: BoardPostStatus.ACTIVE,
        ...searchFilter,
        isNotice: false,
        isPinned: false,
      },
      orderBy: orderByFor(sort),
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        author: { select: { email: true, studentProfile: { select: { realName: true } } } },
        boardChannel: { select: { name: true, slug: true } },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function hrefFor(board: string, nextPage?: number) {
    const q = new URLSearchParams();
    q.set("board", board);
    if (query) q.set("q", query);
    if (sort !== "latest") q.set("sort", sort);
    if (nextPage && nextPage > 1) q.set("page", String(nextPage));
    return `/community/admissions?${q.toString()}`;
  }

  const title = activeBoard?.name ?? "전체글보기";

  return (
    <main className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <AdmissionsBoardLayout
        sidebar={
          <AdmissionsSidebar
            activeBoard={boardParam}
            noticeBoard={sidebar.noticeBoard}
            groups={sidebar.groups}
            query={query}
            sort={sort}
          />
        }
        main={
          <AdmissionsBoardMain
            title={title}
            boardParam={boardParam}
            writeSlug={writeSlug}
            query={query}
            sort={sort}
            page={page}
            totalPages={totalPages}
            noticePosts={noticePosts}
            posts={posts}
            canWrite={Boolean(user)}
            hrefFor={hrefFor}
          />
        }
      />
    </main>
  );
}
