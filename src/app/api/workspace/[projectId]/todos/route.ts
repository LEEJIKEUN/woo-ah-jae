import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { requireTeamMember } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const postSchema = z.object({
  text: z.string().min(1).max(500),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const auth = await getAuthFromRequest(request);
    const { projectId } = await params;
    await requireTeamMember(projectId, auth.userId, auth.role);

    const items = await prisma.todoItem.findMany({
      where: { projectId },
      orderBy: [{ done: "asc" }, { createdAt: "desc" }],
      include: {
        creator: {
          select: {
            id: true,
            email: true,
            studentProfile: { select: { realName: true } },
          },
        },
      },
    });

    return NextResponse.json({
      items: items.map((item) => ({
        id: item.id,
        text: item.text,
        done: item.done,
        createdAt: item.createdAt.toISOString(),
        creator: {
          id: item.creator.id,
          name: item.creator.studentProfile?.realName ?? item.creator.email.split("@")[0],
        },
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const auth = await getAuthFromRequest(request);
    const { projectId } = await params;
    await requireTeamMember(projectId, auth.userId, auth.role);

    const body = postSchema.parse(await request.json());

    const item = await prisma.todoItem.create({
      data: {
        projectId,
        creatorId: auth.userId,
        text: body.text,
      },
      include: {
        creator: {
          select: {
            id: true,
            email: true,
            studentProfile: { select: { realName: true } },
          },
        },
      },
    });

    return NextResponse.json(
      {
        item: {
          id: item.id,
          text: item.text,
          done: item.done,
          createdAt: item.createdAt.toISOString(),
          creator: {
            id: item.creator.id,
            name: item.creator.studentProfile?.realName ?? item.creator.email.split("@")[0],
          },
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    return jsonError(error);
  }
}
