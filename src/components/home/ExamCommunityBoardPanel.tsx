import Link from "next/link";
import ExamCommunityTabsClient from "@/components/home/ExamCommunityTabsClient";
import { ensureBoardChannels } from "@/lib/board-service";
import { prisma } from "@/lib/prisma";

export default async function ExamCommunityBoardPanel() {
  await ensureBoardChannels();
  const channels = await prisma.boardChannel.findMany({
    where: { slug: { in: ["study-admission", "talk"] } },
    orderBy: [{ slug: "asc" }],
    select: { id: true, slug: true, name: true, description: true },
  });

  const postMap = new Map<string, Array<{
    id: string;
    title: string;
    categoryTag: string | null;
    createdAt: string;
    authorName: string;
    viewCount: number;
    likeCount: number;
    commentCount: number;
  }>>();

  for (const channel of channels) {
    const posts = await prisma.boardPost.findMany({
      where: { boardChannelId: channel.id, status: "ACTIVE" },
      orderBy: [{ isPinned: "desc" }, { isNotice: "desc" }, { createdAt: "desc" }],
      take: 8,
      include: {
        author: {
          select: {
            email: true,
            studentProfile: { select: { realName: true } },
          },
        },
      },
    });
    postMap.set(
      channel.slug,
      posts.map((p) => ({
        id: p.id,
        title: p.title,
        categoryTag: p.categoryTag,
        createdAt: p.createdAt.toISOString(),
        authorName: p.author.studentProfile?.realName ?? p.author.email.split("@")[0],
        viewCount: p.viewCount,
        likeCount: p.likeCount,
        commentCount: p.commentCount,
      }))
    );
  }

  const tabData = channels.map((x) => ({
    slug: x.slug,
    name: x.name,
    description: x.description ?? "",
    posts: postMap.get(x.slug) ?? [],
  }));

  if (!tabData.length) return null;

  return (
    <section className="space-y-3 rounded-xl border border-slate-700/70 bg-[color:var(--surface)] p-4 md:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-100">공인시험 커뮤니티</h2>
        <Link href={`/boards/${tabData[0].slug}`} className="text-sm text-slate-300 hover:text-white">
          게시판 전체보기
        </Link>
      </div>
      <ExamCommunityTabsClient tabs={tabData} />
    </section>
  );
}
