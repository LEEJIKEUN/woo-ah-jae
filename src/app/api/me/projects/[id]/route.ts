import { ProjectStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

const bodySchema = z
  .object({
    status: z.enum(["OPEN", "CLOSED"]).optional(),
    achieved: z.boolean().optional(),
    title: z.string().min(2).max(120).optional(),
    summary: z.string().min(2).max(240).optional(),
    description: z.string().min(10).max(8000).optional(),
    tab: z.string().min(1).max(40).optional(),
    channel: z.string().min(1).max(80).optional(),
    thumbnailUrl: z.string().max(1000).nullable().optional(),
    capacity: z.number().int().positive().max(100).optional(),
    requirements: z.string().max(2000).optional(),
    rolesNeeded: z.string().max(2000).optional(),
    question1: z.string().max(300).optional(),
    question2: z.string().max(300).optional(),
    question3: z.string().max(300).optional(),
    deadline: z.string().datetime().nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "변경할 항목이 없습니다.",
  });

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthFromRequest(request);
    const { id } = await params;
    const parsed = bodySchema.parse(await request.json());

    const project = await prisma.project.findUnique({ where: { id }, select: { ownerId: true } });
    if (!project) {
      return NextResponse.json({ error: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
    }

    const canManage = auth.role === "ADMIN" || project.ownerId === auth.userId;
    if (!canManage) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    const updateData: {
      status?: ProjectStatus;
      achievedAt?: Date | null;
      title?: string;
      summary?: string;
      description?: string;
      capacity?: number;
      tab?: string;
      channel?: string;
      thumbnailUrl?: string | null;
      requirements?: string | null;
      rolesNeeded?: string | null;
      question1?: string | null;
      question2?: string | null;
      question3?: string | null;
      deadline?: Date | null;
    } = {};

    if (parsed.status) {
      updateData.status = parsed.status === "OPEN" ? ProjectStatus.OPEN : ProjectStatus.CLOSED;
    }
    if (parsed.achieved !== undefined) {
      updateData.achievedAt = parsed.achieved ? new Date() : null;
      if (parsed.achieved) {
        updateData.status = ProjectStatus.CLOSED;
      }
    }
    if (parsed.title !== undefined) updateData.title = parsed.title;
    if (parsed.summary !== undefined) updateData.summary = parsed.summary;
    if (parsed.description !== undefined) updateData.description = parsed.description;
    if (parsed.tab !== undefined) updateData.tab = parsed.tab;
    if (parsed.channel !== undefined) updateData.channel = parsed.channel;
    if (parsed.thumbnailUrl !== undefined) updateData.thumbnailUrl = parsed.thumbnailUrl || null;
    if (parsed.capacity !== undefined) updateData.capacity = parsed.capacity;
    if (parsed.requirements !== undefined) updateData.requirements = parsed.requirements || null;
    if (parsed.rolesNeeded !== undefined) updateData.rolesNeeded = parsed.rolesNeeded || null;
    if (parsed.question1 !== undefined) updateData.question1 = parsed.question1 || null;
    if (parsed.question2 !== undefined) updateData.question2 = parsed.question2 || null;
    if (parsed.question3 !== undefined) updateData.question3 = parsed.question3 || null;
    if (parsed.deadline !== undefined) {
      updateData.deadline = parsed.deadline ? new Date(parsed.deadline) : null;
    }

    const updated = await prisma.project.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ item: updated });
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
    const project = await prisma.project.findUnique({ where: { id }, select: { ownerId: true } });

    if (!project) {
      return NextResponse.json({ error: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
    }

    const canManage = auth.role === "ADMIN" || project.ownerId === auth.userId;
    if (!canManage) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    await prisma.project.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
