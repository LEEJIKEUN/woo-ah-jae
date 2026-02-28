import { BoardPostStatus, Prisma, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOptionalAuthFromRequest, getViewerIp } from "@/lib/board-auth";
import { sanitizeBoardText } from "@/lib/board-sanitize";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

const attachmentSchema = z.object({
  url: z.string().max(1000),
  name: z.string().max(260),
  mimeType: z.string().max(120),
  size: z.number().int().positive().max(20 * 1024 * 1024),
});

const patchSchema = z.object({
  boardChannelSlug: z.string().min(1).max(120).optional(),
  categoryTag: z.string().max(40).optional().nullable(),
  title: z.string().min(2).max(160).optional(),
  content: z.string().min(2).max(12000).optional(),
  attachments: z.array(attachmentSchema).max(5).optional(),
  isNotice: z.boolean().optional(),
  isPinned: z.boolean().optional(),
  status: z.enum(["ACTIVE", "HIDDEN", "DELETED"]).optional(),
});

function hasTooManyAttachments(attachments: Array<z.infer<typeof attachmentSchema>>) {
  let imageCount = 0;
  let fileCount = 0;
  for (const item of attachments) {
    if (item.mimeType.startsWith("image/")) imageCount += 1;
    else fileCount += 1;
  }
  return imageCount > 5 || fileCount > 3;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const optionalAuth = await getOptionalAuthFromRequest(request);
    const viewerKey = optionalAuth?.userId ? `u:${optionalAuth.userId}` : `ip:${getViewerIp(request)}`;
    const now = new Date();
    const cooldownAt = new Date(now.getTime() - 10 * 60 * 1000);

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

      const isAdmin = optionalAuth?.role === UserRole.ADMIN;
      if (found.status !== BoardPostStatus.ACTIVE && !isAdmin && optionalAuth?.userId !== found.authorId) {
        return null;
      }

      const existingView = await tx.boardPostView.findUnique({
        where: { postId_viewerKey: { postId: id, viewerKey } },
      });

      const shouldIncrease = !existingView || existingView.lastViewedAt < cooldownAt;
      if (shouldIncrease) {
        await tx.boardPost.update({
          where: { id },
          data: { viewCount: { increment: 1 } },
        });
        await tx.boardPostView.upsert({
          where: { postId_viewerKey: { postId: id, viewerKey } },
          create: {
            postId: id,
            userId: optionalAuth?.userId ?? null,
            viewerKey,
            lastViewedAt: now,
          },
          update: { lastViewedAt: now },
        });
        found.viewCount += 1;
      }

      return found;
    });

    if (!post) {
      return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
    }

    const likedByMe = optionalAuth?.userId
      ? !!(await prisma.boardPostLike.findUnique({
          where: { postId_userId: { postId: id, userId: optionalAuth.userId } },
          select: { id: true },
        }))
      : false;

    return NextResponse.json({
      item: {
        id: post.id,
        channel: {
          slug: post.boardChannel.slug,
          name: post.boardChannel.name,
        },
        author: {
          id: post.author.id,
          name: post.author.studentProfile?.realName ?? post.author.email.split("@")[0],
          school: post.author.studentProfile?.schoolName ?? "학교미입력",
          grade: post.author.studentProfile?.grade ?? "학년미입력",
        },
        categoryTag: post.categoryTag,
        title: post.title,
        content: post.content,
        attachments: (post.attachments as unknown[]) ?? [],
        viewCount: post.viewCount,
        likeCount: post.likeCount,
        commentCount: post.commentCount,
        isNotice: post.isNotice,
        isPinned: post.isPinned,
        status: post.status,
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString(),
        likedByMe,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthFromRequest(request);
    const { id } = await params;
    const body = patchSchema.parse(await request.json());

    const post = await prisma.boardPost.findUnique({
      where: { id },
      select: { id: true, authorId: true },
    });
    if (!post) {
      return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
    }

    const isAdmin = auth.role === UserRole.ADMIN;
    const isOwner = post.authorId === auth.userId;
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    if (body.attachments && hasTooManyAttachments(body.attachments)) {
      return NextResponse.json({ error: "이미지는 최대 5개, 일반 파일은 최대 3개까지 첨부할 수 있습니다." }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.categoryTag !== undefined) updateData.categoryTag = body.categoryTag?.trim() || null;
    if (body.title !== undefined) updateData.title = sanitizeBoardText(body.title);
    if (body.content !== undefined) updateData.content = sanitizeBoardText(body.content);
    if (body.attachments !== undefined) {
      updateData.attachments = body.attachments.length ? body.attachments : Prisma.JsonNull;
    }

    if (isAdmin) {
      if (body.boardChannelSlug !== undefined) {
        const targetChannel = await prisma.boardChannel.findUnique({
          where: { slug: body.boardChannelSlug },
          select: { id: true },
        });
        if (!targetChannel) {
          return NextResponse.json({ error: "이동할 게시판을 찾을 수 없습니다." }, { status: 404 });
        }
        updateData.boardChannelId = targetChannel.id;
      }
      if (body.isNotice !== undefined) updateData.isNotice = body.isNotice;
      if (body.isPinned !== undefined) updateData.isPinned = body.isPinned;
      if (body.status !== undefined) updateData.status = body.status;
    }

    const item = await prisma.boardPost.update({
      where: { id },
      data: updateData,
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

    const post = await prisma.boardPost.findUnique({
      where: { id },
      select: { authorId: true },
    });
    if (!post) {
      return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
    }

    if (auth.role !== UserRole.ADMIN && post.authorId !== auth.userId) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    await prisma.boardPost.update({
      where: { id },
      data: { status: BoardPostStatus.DELETED, isPinned: false, isNotice: false },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
