import { notFound, redirect } from "next/navigation";
import BoardPostEditor from "@/components/board/BoardPostEditor";
import { requireUser } from "@/lib/auth";
import { ADMISSIONS_COMMUNITY_KEY } from "@/lib/admissions-community-config";
import { ensureBoardChannels } from "@/lib/board-service";
import { prisma } from "@/lib/prisma";

export default async function BoardNewPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser("/login");
  await ensureBoardChannels();
  const { slug } = await params;

  const channel = await prisma.boardChannel.findUnique({
    where: { slug },
    select: { id: true, name: true, communityKey: true },
  });
  if (!channel) notFound();

  if (!user) redirect(`/login?next=/boards/${slug}/new`);

  return (
    <main className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <section className="mx-auto max-w-4xl space-y-4 px-4 py-8 md:px-6">
        <h1 className="text-2xl font-bold">
          {channel.communityKey === ADMISSIONS_COMMUNITY_KEY
            ? "학습+입시 정보 공유"
            : channel.name}
        </h1>
        <BoardPostEditor channelSlug={slug} mode="create" isAdmin={user.role === "ADMIN"} />
      </section>
    </main>
  );
}
