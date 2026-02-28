import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sanitizeBoardText } from "@/lib/board-sanitize";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

const postSchema = z.object({
  content: z.string().min(1).max(2000),
});

function mapComment(item: {
  id: string;
  projectId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  authorId: string;
  author: {
    id: string;
    email: string;
    studentProfile: { realName: string | null; schoolName: string | null; grade: string | null } | null;
  };
}) {
  return {
    id: item.id,
    projectId: item.projectId,
    content: item.content,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    authorId: item.authorId,
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
    const { id: projectId } = await params;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
    }

    const comments = await prisma.projectComment.findMany({
      where: { projectId },
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
    const { id: projectId } = await params;
    const parsed = postSchema.parse(await request.json());

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
    }

    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.projectComment.create({
        data: {
          projectId,
          authorId: auth.userId,
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

      await tx.project.update({
        where: { id: projectId },
        data: {
          commentCount: { increment: 1 },
          popularityScore: { increment: 1 },
        },
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
