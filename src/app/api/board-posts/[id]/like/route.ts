import { BoardPostStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthFromRequest(request);
    const { id } = await params;

    const post = await prisma.boardPost.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!post || post.status === BoardPostStatus.DELETED) {
      return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
    }

    const existing = await prisma.boardPostLike.findUnique({
      where: { postId_userId: { postId: id, userId: auth.userId } },
      select: { id: true },
    });

    const item = await prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.boardPostLike.delete({ where: { postId_userId: { postId: id, userId: auth.userId } } });
        const updated = await tx.boardPost.update({
          where: { id },
          data: { likeCount: { decrement: 1 } },
          select: { likeCount: true },
        });
        return { liked: false, likeCount: Math.max(0, updated.likeCount) };
      }

      await tx.boardPostLike.create({
        data: { postId: id, userId: auth.userId },
      });
      const updated = await tx.boardPost.update({
        where: { id },
        data: { likeCount: { increment: 1 } },
        select: { likeCount: true },
      });
      return { liked: true, likeCount: updated.likeCount };
    });

    return NextResponse.json(item);
  } catch (error) {
    return jsonError(error);
  }
}
