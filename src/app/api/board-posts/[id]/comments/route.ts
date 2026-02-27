import { BoardCommentStatus, BoardPostStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sanitizeBoardText } from "@/lib/board-sanitize";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

const postSchema = z.object({
  content: z.string().min(1).max(2000),
  parentCommentId: z.string().cuid().optional().nullable(),
});

function mapComment(item: {
  id: string;
  postId: string;
  parentCommentId: string | null;
  content: string;
  status: BoardCommentStatus;
  createdAt: Date;
  updatedAt: Date;
  author: {
    id: string;
    email: string;
    studentProfile: { realName: string | null; schoolName: string | null; grade: string | null } | null;
  };
}) {
  return {
    id: item.id,
    postId: item.postId,
    parentCommentId: item.parentCommentId,
    content: item.content,
    status: item.status,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    author: {
      id: item.author.id,
      name: item.author.studentProfile?.realName ?? item.author.email.split("@")[0],
      school: item.author.studentProfile?.schoolName ?? "학교미입력",
      grade: item.author.studentProfile?.grade ?? "학년미입력",
    },
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params;
    const post = await prisma.boardPost.findUnique({
      where: { id: postId },
      select: { id: true, status: true },
    });
    if (!post || post.status === BoardPostStatus.DELETED) {
      return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
    }

    const comments = await prisma.boardComment.findMany({
      where: { postId, status: { not: BoardCommentStatus.DELETED } },
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
    });

    return NextResponse.json({ items: comments.map(mapComment) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthFromRequest(request);
    const { id: postId } = await params;
    const parsed = postSchema.parse(await request.json());

    const post = await prisma.boardPost.findUnique({
      where: { id: postId },
      select: { id: true, status: true },
    });
    if (!post || post.status !== BoardPostStatus.ACTIVE) {
      return NextResponse.json({ error: "댓글을 작성할 수 없는 게시글입니다." }, { status: 400 });
    }

    let parentId: string | null = null;
    if (parsed.parentCommentId) {
      const parent = await prisma.boardComment.findUnique({
        where: { id: parsed.parentCommentId },
        select: { id: true, postId: true, parentCommentId: true, status: true },
      });
      if (!parent || parent.postId !== postId || parent.parentCommentId !== null || parent.status === BoardCommentStatus.DELETED) {
        return NextResponse.json({ error: "대댓글 대상이 유효하지 않습니다." }, { status: 400 });
      }
      parentId = parent.id;
    }

    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.boardComment.create({
        data: {
          postId,
          authorId: auth.userId,
          parentCommentId: parentId,
          content: sanitizeBoardText(parsed.content),
        },
        include: {
          author: {
            select: {
              id: true,
              email: true,
              studentProfile: { select: { realName: true, schoolName: true, grade: true } },
            },
          },
        },
      });
      await tx.boardPost.update({
        where: { id: postId },
        data: { commentCount: { increment: 1 } },
      });
      return created;
    });

    return NextResponse.json({ item: mapComment(item) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "잘못된 요청입니다." }, { status: 400 });
    }
    return jsonError(error);
  }
}
