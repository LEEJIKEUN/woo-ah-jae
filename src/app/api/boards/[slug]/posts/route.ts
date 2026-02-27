import { BoardPostStatus, Prisma, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOptionalAuthFromRequest } from "@/lib/board-auth";
import { sanitizeBoardText } from "@/lib/board-sanitize";
import { ensureBoardChannels } from "@/lib/board-service";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

const attachmentSchema = z.object({
  url: z.string().max(1000),
  name: z.string().max(260),
  mimeType: z.string().max(120),
  size: z.number().int().positive().max(20 * 1024 * 1024),
});

const createSchema = z.object({
  categoryTag: z.string().max(40).optional().nullable(),
  title: z.string().min(2).max(160),
  content: z.string().min(2).max(12000),
  attachments: z.array(attachmentSchema).max(5).optional(),
  isNotice: z.boolean().optional(),
  isPinned: z.boolean().optional(),
});

function toOrderBy(sort: string | null) {
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
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    await ensureBoardChannels();
    const { slug } = await params;
    const sp = request.nextUrl.searchParams;
    const query = sp.get("query")?.trim() ?? "";
    const author = sp.get("author")?.trim() ?? "";
    const sort = sp.get("sort") ?? "latest";
    const page = Math.max(1, Number(sp.get("page") ?? "1"));
    const pageSize = Math.min(30, Math.max(5, Number(sp.get("pageSize") ?? "15")));

    const channel = await prisma.boardChannel.findUnique({
      where: { slug },
      select: { id: true, slug: true, name: true, description: true },
    });
    if (!channel) {
      return NextResponse.json({ error: "채널을 찾을 수 없습니다." }, { status: 404 });
    }

    const whereBase = {
      boardChannelId: channel.id,
      status: BoardPostStatus.ACTIVE,
      ...(query
        ? {
            OR: [
              { title: { contains: query } },
              { content: { contains: query } },
            ],
          }
        : {}),
      ...(author
        ? {
            author: {
              OR: [
                { email: { contains: author } },
                { studentProfile: { realName: { contains: author } } },
              ],
            },
          }
        : {}),
    } as const;

    const [notices, total, posts] = await Promise.all([
      prisma.boardPost.findMany({
        where: {
          ...whereBase,
          OR: [{ isNotice: true }, { isPinned: true }],
        },
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
      }),
      prisma.boardPost.count({
        where: {
          ...whereBase,
          isNotice: false,
          isPinned: false,
        },
      }),
      prisma.boardPost.findMany({
        where: {
          ...whereBase,
          isNotice: false,
          isPinned: false,
        },
        orderBy: toOrderBy(sort),
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          author: {
            select: {
              email: true,
              studentProfile: { select: { realName: true } },
            },
          },
        },
      }),
    ]);

    return NextResponse.json({
      channel,
      notices: notices.map((item) => ({
        id: item.id,
        categoryTag: item.categoryTag,
        title: item.title,
        authorName: item.author.studentProfile?.realName ?? item.author.email.split("@")[0],
        createdAt: item.createdAt.toISOString(),
        viewCount: item.viewCount,
        likeCount: item.likeCount,
        commentCount: item.commentCount,
        isNotice: item.isNotice,
        isPinned: item.isPinned,
      })),
      items: posts.map((item) => ({
        id: item.id,
        categoryTag: item.categoryTag,
        title: item.title,
        authorName: item.author.studentProfile?.realName ?? item.author.email.split("@")[0],
        createdAt: item.createdAt.toISOString(),
        viewCount: item.viewCount,
        likeCount: item.likeCount,
        commentCount: item.commentCount,
        isNotice: item.isNotice,
        isPinned: item.isPinned,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const auth = await getAuthFromRequest(request);
    const optionalAuth = await getOptionalAuthFromRequest(request);
    const { slug } = await params;
    const parsed = createSchema.parse(await request.json());

    const channel = await prisma.boardChannel.findUnique({ where: { slug }, select: { id: true } });
    if (!channel) {
      return NextResponse.json({ error: "채널을 찾을 수 없습니다." }, { status: 404 });
    }

    const attachments = parsed.attachments ?? [];
    if (hasTooManyAttachments(attachments)) {
      return NextResponse.json({ error: "이미지는 최대 5개, 일반 파일은 최대 3개까지 첨부할 수 있습니다." }, { status: 400 });
    }

    const userRole = optionalAuth?.role ?? UserRole.STUDENT;
    const isAdmin = userRole === UserRole.ADMIN;

    const item = await prisma.boardPost.create({
      data: {
        boardChannelId: channel.id,
        authorId: auth.userId,
        categoryTag: parsed.categoryTag?.trim() || null,
        title: sanitizeBoardText(parsed.title),
        content: sanitizeBoardText(parsed.content),
        attachments: attachments.length ? attachments : Prisma.JsonNull,
        isNotice: isAdmin ? !!parsed.isNotice : false,
        isPinned: isAdmin ? !!parsed.isPinned : false,
      },
      select: { id: true, createdAt: true },
    });

    return NextResponse.json({ item: { id: item.id, createdAt: item.createdAt.toISOString() } }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "잘못된 입력입니다." }, { status: 400 });
    }
    return jsonError(error);
  }
}
