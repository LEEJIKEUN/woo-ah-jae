import { UserRole } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import BoardPostEditor from "@/components/board/BoardPostEditor";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function BoardEditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("/login");
  const { id } = await params;

  const post = await prisma.boardPost.findUnique({
    where: { id },
    include: {
      boardChannel: { select: { slug: true, name: true } },
    },
  });
  if (!post) notFound();

  const isAdmin = user.role === UserRole.ADMIN;
  const isOwner = post.authorId === user.id;
  if (!isAdmin && !isOwner) {
    redirect(`/boards/posts/${id}`);
  }

  const channels = await prisma.boardChannel.findMany({
    select: { slug: true, name: true, communityKey: true, sortOrder: true },
    orderBy: [{ communityKey: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });

  return (
    <main className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <section className="mx-auto max-w-4xl space-y-4 px-4 py-8 md:px-6">
        <h1 className="text-2xl font-bold">게시글 수정</h1>
        <BoardPostEditor
          channelSlug={post.boardChannel.slug}
          initialChannelSlug={post.boardChannel.slug}
          availableChannels={channels.map((channel) => ({
            slug: channel.slug,
            name: channel.name,
            communityKey: channel.communityKey,
          }))}
          mode="edit"
          postId={post.id}
          isAdmin={isAdmin}
          initial={{
            categoryTag: post.categoryTag,
            title: post.title,
            content: post.content,
            attachments: (post.attachments as Array<{ url: string; name: string; mimeType: string; size: number }>) ?? [],
            isNotice: post.isNotice,
            isPinned: post.isPinned,
            status: post.status,
          }}
        />
      </section>
    </main>
  );
}
