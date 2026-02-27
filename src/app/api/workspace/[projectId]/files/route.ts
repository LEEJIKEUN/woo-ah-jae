import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { requireTeamMember } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const postSchema = z.object({
  fileUrl: z.string().min(1).max(2000),
  fileName: z.string().min(1).max(260),
  mimeType: z.string().min(1).max(120),
  size: z.number().int().positive().max(20 * 1024 * 1024),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const auth = await getAuthFromRequest(request);
    const { projectId } = await params;
    await requireTeamMember(projectId, auth.userId, auth.role);

    const items = await prisma.workspaceFile.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: {
        uploader: {
          select: {
            id: true,
            email: true,
            studentProfile: { select: { realName: true, schoolName: true, grade: true } },
          },
        },
      },
    });

    return NextResponse.json({
      items: items.map((item) => ({
        id: item.id,
        fileUrl: item.fileUrl,
        fileName: item.fileName,
        mimeType: item.mimeType,
        size: item.size,
        createdAt: item.createdAt.toISOString(),
        uploader: {
          id: item.uploader.id,
          email: item.uploader.email,
          name: item.uploader.studentProfile?.realName ?? item.uploader.email.split("@")[0],
          school: item.uploader.studentProfile?.schoolName ?? "학교미입력",
          grade: item.uploader.studentProfile?.grade ?? "학년미입력",
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

    const item = await prisma.workspaceFile.create({
      data: {
        projectId,
        uploaderId: auth.userId,
        fileUrl: body.fileUrl,
        fileName: body.fileName,
        mimeType: body.mimeType,
        size: body.size,
      },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    return jsonError(error);
  }
}
