import { ApplicationStatus, ProjectStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  decision: z.enum(["ACCEPTED", "REJECTED"]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; appId: string }> }
) {
  try {
    const auth = await getAuthFromRequest(request);
    const { id: projectId, appId } = await params;
    const { decision } = bodySchema.parse(await request.json());

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, ownerId: true, capacity: true },
    });

    if (!project) {
      return NextResponse.json({ error: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
    }

    if (project.ownerId !== auth.userId) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    const application = await prisma.application.findUnique({
      where: { id: appId },
      select: { id: true, projectId: true, applicantId: true, status: true },
    });

    if (!application || application.projectId !== projectId) {
      return NextResponse.json({ error: "지원서를 찾을 수 없습니다." }, { status: 404 });
    }

    if (decision === "ACCEPTED" && application.status !== ApplicationStatus.ACCEPTED) {
      const acceptedCount = await prisma.application.count({
        where: { projectId, status: ApplicationStatus.ACCEPTED },
      });
      if (acceptedCount >= project.capacity) {
        return NextResponse.json({ error: "이미 모집 인원이 모두 확정되어 마감되었습니다." }, { status: 400 });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.application.update({
        where: { id: appId },
        data: { status: decision as ApplicationStatus },
      });

      if (decision === "ACCEPTED") {
        await tx.projectMember.upsert({
          where: {
            projectId_userId: {
              projectId,
              userId: application.applicantId,
            },
          },
          create: {
            projectId,
            userId: application.applicantId,
          },
          update: {},
        });

        const acceptedCount = await tx.application.count({
          where: { projectId, status: ApplicationStatus.ACCEPTED },
        });

        if (acceptedCount >= project.capacity) {
          await tx.project.update({
            where: { id: projectId },
            data: { status: ProjectStatus.CLOSED },
          });
        }
      }

      return updated;
    });

    return NextResponse.json({ item: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "잘못된 요청입니다." }, { status: 400 });
    }
    return jsonError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; appId: string }> }
) {
  try {
    const auth = await getAuthFromRequest(request);
    const { id: projectId, appId } = await params;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, ownerId: true, capacity: true, status: true },
    });

    if (!project) {
      return NextResponse.json({ error: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
    }

    if (project.ownerId !== auth.userId) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    const application = await prisma.application.findUnique({
      where: { id: appId },
      select: { id: true, projectId: true, applicantId: true, status: true },
    });

    if (!application || application.projectId !== projectId) {
      return NextResponse.json({ error: "지원서를 찾을 수 없습니다." }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.projectMember.deleteMany({
        where: { projectId, userId: application.applicantId },
      });
      await tx.application.delete({ where: { id: appId } });

      const acceptedCount = await tx.application.count({
        where: { projectId, status: ApplicationStatus.ACCEPTED },
      });

      if (project.status === ProjectStatus.CLOSED && acceptedCount < project.capacity) {
        await tx.project.update({
          where: { id: projectId },
          data: { status: ProjectStatus.OPEN },
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
