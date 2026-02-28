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

    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
    }

    const existing = await prisma.projectLike.findUnique({
      where: { projectId_userId: { projectId: id, userId: auth.userId } },
      select: { id: true },
    });

    const item = await prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.projectLike.delete({
          where: { projectId_userId: { projectId: id, userId: auth.userId } },
        });

        const updated = await tx.project.update({
          where: { id },
          data: {
            likeCount: { decrement: 1 },
            popularityScore: { decrement: 1 },
          },
          select: { likeCount: true },
        });

        return { liked: false, likeCount: Math.max(0, updated.likeCount) };
      }

      await tx.projectLike.create({
        data: { projectId: id, userId: auth.userId },
      });

      const updated = await tx.project.update({
        where: { id },
        data: {
          likeCount: { increment: 1 },
          popularityScore: { increment: 1 },
        },
        select: { likeCount: true },
      });

      return { liked: true, likeCount: updated.likeCount };
    });

    return NextResponse.json(item);
  } catch (error) {
    return jsonError(error);
  }
}
