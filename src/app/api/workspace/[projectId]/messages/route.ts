import { ChatMessageType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { requireTeamMember } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const postSchema = z.object({
  content: z.string().min(1).max(4000),
  type: z.enum(["TEXT", "FILE"]).optional(),
  fileUrl: z.string().max(2000).optional(),
  fileName: z.string().max(260).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const auth = await getAuthFromRequest(request);
    const { projectId } = await params;
    await requireTeamMember(projectId, auth.userId, auth.role);

    const messages = await prisma.chatMessage.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            studentProfile: { select: { realName: true, schoolName: true, grade: true } },
          },
        },
      },
      take: 300,
    });

    return NextResponse.json({
      items: messages.map((item) => ({
        id: item.id,
        projectId: item.projectId,
        content: item.content,
        type: item.type,
        fileUrl: item.fileUrl,
        fileName: item.fileName,
        createdAt: item.createdAt.toISOString(),
        user: {
          id: item.user.id,
          email: item.user.email,
          name: item.user.studentProfile?.realName ?? item.user.email.split("@")[0],
          school: item.user.studentProfile?.schoolName ?? "학교미입력",
          grade: item.user.studentProfile?.grade ?? "학년미입력",
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

    if (body.type === "FILE" && (!body.fileUrl || !body.fileName)) {
      return NextResponse.json({ error: "파일 메시지에는 fileUrl/fileName이 필요합니다." }, { status: 400 });
    }

    const created = await prisma.chatMessage.create({
      data: {
        projectId,
        userId: auth.userId,
        content: body.content,
        type: body.type === "FILE" ? ChatMessageType.FILE : ChatMessageType.TEXT,
        fileUrl: body.fileUrl ?? null,
        fileName: body.fileName ?? null,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            studentProfile: { select: { realName: true, schoolName: true, grade: true } },
          },
        },
      },
    });

    return NextResponse.json({
      item: {
        id: created.id,
        projectId: created.projectId,
        content: created.content,
        type: created.type,
        fileUrl: created.fileUrl,
        fileName: created.fileName,
        createdAt: created.createdAt.toISOString(),
        user: {
          id: created.user.id,
          email: created.user.email,
          name: created.user.studentProfile?.realName ?? created.user.email.split("@")[0],
          school: created.user.studentProfile?.schoolName ?? "학교미입력",
          grade: created.user.studentProfile?.grade ?? "학년미입력",
        },
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    return jsonError(error);
  }
}
