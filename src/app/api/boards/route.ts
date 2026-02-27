import { NextResponse } from "next/server";
import { ensureBoardChannels } from "@/lib/board-service";
import { prisma } from "@/lib/prisma";

export async function GET() {
  await ensureBoardChannels();
  const channels = await prisma.boardChannel.findMany({
    orderBy: [{ slug: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      _count: {
        select: { posts: true },
      },
    },
  });

  return NextResponse.json({
    items: channels.map((x) => ({
      ...x,
      postCount: x._count.posts,
    })),
  });
}
