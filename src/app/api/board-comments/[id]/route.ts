import { BoardCommentStatus, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sanitizeBoardText } from "@/lib/board-sanitize";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  content: z.string().min(1).max(2000),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthFromRequest(request);
    const { id } = await params;
    const parsed = patchSchema.parse(await request.json());

    const comment = await prisma.boardComment.findUnique({
      where: { id },
      select: { id: true, authorId: true, status: true },
    });
    if (!comment || comment.status === BoardCommentStatus.DELETED) {
      return NextResponse.json({ error: "댓글을 찾을 수 없습니다." }, { status: 404 });
    }

    if (auth.role !== UserRole.ADMIN && comment.authorId !== auth.userId) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    const item = await prisma.boardComment.update({
      where: { id },
      data: { content: sanitizeBoardText(parsed.content) },
      select: { id: true, updatedAt: true },
    });

    return NextResponse.json({ item: { ...item, updatedAt: item.updatedAt.toISOString() } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "잘못된 요청입니다." }, { status: 400 });
    }
    return jsonError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthFromRequest(request);
    const { id } = await params;

    const comment = await prisma.boardComment.findUnique({
      where: { id },
      select: { id: true, authorId: true, postId: true, status: true },
    });
    if (!comment) {
      return NextResponse.json({ error: "댓글을 찾을 수 없습니다." }, { status: 404 });
    }

    if (auth.role !== UserRole.ADMIN && comment.authorId !== auth.userId) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      const nextStatus = BoardCommentStatus.DELETED;
      if (comment.status !== nextStatus) {
        await tx.boardPost.update({
          where: { id: comment.postId },
          data: { commentCount: { decrement: 1 } },
        });
      }

      await tx.boardComment.update({
        where: { id },
        data: {
          status: nextStatus,
          content: "[삭제된 댓글입니다.]",
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
