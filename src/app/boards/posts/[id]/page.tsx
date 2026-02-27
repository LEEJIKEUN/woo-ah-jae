import { notFound } from "next/navigation";
import BoardPostDetailClient from "@/components/board/BoardPostDetailClient";
import { getUser } from "@/lib/auth";
import { BoardCommentStatus, BoardPostStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

export default async function BoardPostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  const { id } = await params;

  const now = new Date();
  const cooldownAt = new Date(now.getTime() - 10 * 60 * 1000);
  const hdrs = await headers();
  const forwarded = hdrs.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || hdrs.get("x-real-ip") || "unknown-ip";
  const viewerKey = user?.id
    ? `u:${user.id}`
    : `ip:${ip}`;

  const post = await prisma.$transaction(async (tx) => {
    const found = await tx.boardPost.findUnique({
      where: { id },
      include: {
        boardChannel: { select: { slug: true, name: true } },
        author: {
          select: {
            id: true,
            email: true,
            studentProfile: { select: { realName: true, schoolName: true, grade: true } },
          },
        },
      },
    });
    if (!found) return null;

    const canViewHidden = user?.role === "ADMIN" || user?.id === found.authorId;
    if (found.status !== BoardPostStatus.ACTIVE && !canViewHidden) {
      return null;
    }

    const view = await tx.boardPostView.findUnique({
      where: { postId_viewerKey: { postId: id, viewerKey } },
    });
    const shouldIncrease = !view || view.lastViewedAt < cooldownAt;
    if (shouldIncrease) {
      await tx.boardPost.update({ where: { id }, data: { viewCount: { increment: 1 } } });
      await tx.boardPostView.upsert({
        where: { postId_viewerKey: { postId: id, viewerKey } },
        create: {
          postId: id,
          viewerKey,
          userId: user?.id ?? null,
          lastViewedAt: now,
        },
        update: { lastViewedAt: now },
      });
      found.viewCount += 1;
    }
    return found;
  });

  if (!post) notFound();

  const [likedByMe, comments] = await Promise.all([
    user
      ? prisma.boardPostLike.findUnique({
          where: { postId_userId: { postId: id, userId: user.id } },
          select: { id: true },
        })
      : Promise.resolve(null),
    prisma.boardComment.findMany({
      where: { postId: id, status: { not: BoardCommentStatus.DELETED } },
      orderBy: [{ createdAt: "desc" }],
      include: {
        author: {
          select: {
            id: true,
            email: true,
            studentProfile: { select: { realName: true, schoolName: true, grade: true } },
          },
        },
      },
    }),
  ]);

  return (
    <main className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <section className="mx-auto max-w-4xl space-y-4 px-4 py-8 md:px-6">
        <BoardPostDetailClient
          post={{
            id: post.id,
            channel: { slug: post.boardChannel.slug, name: post.boardChannel.name },
            author: {
              id: post.author.id,
              name: post.author.studentProfile?.realName ?? post.author.email.split("@")[0],
              school: post.author.studentProfile?.schoolName ?? "학교미입력",
              grade: post.author.studentProfile?.grade ?? "학년미입력",
            },
            categoryTag: post.categoryTag,
            title: post.title,
            content: post.content,
            attachments: (post.attachments as Array<{ url: string; name: string; mimeType: string; size: number }>) ?? [],
            viewCount: post.viewCount,
            likeCount: post.likeCount,
            commentCount: post.commentCount,
            isNotice: post.isNotice,
            isPinned: post.isPinned,
            status: post.status,
            createdAt: post.createdAt.toISOString(),
            updatedAt: post.updatedAt.toISOString(),
            likedByMe: !!likedByMe,
          }}
          initialComments={comments.map((c) => ({
            id: c.id,
            postId: c.postId,
            parentCommentId: c.parentCommentId,
            content: c.content,
            status: c.status,
            createdAt: c.createdAt.toISOString(),
            updatedAt: c.updatedAt.toISOString(),
            author: {
              id: c.author.id,
              name: c.author.studentProfile?.realName ?? c.author.email.split("@")[0],
              school: c.author.studentProfile?.schoolName ?? "학교미입력",
              grade: c.author.studentProfile?.grade ?? "학년미입력",
            },
          }))}
          user={user ? { id: user.id, role: user.role } : null}
        />
      </section>
    </main>
  );
}
