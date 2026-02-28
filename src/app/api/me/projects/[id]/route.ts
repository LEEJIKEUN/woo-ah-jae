import { ProjectStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

const bodySchema = z
  .object({
    status: z.enum(["OPEN", "CLOSED"]).optional(),
    title: z.string().min(2).max(120).optional(),
    summary: z.string().min(2).max(240).optional(),
    description: z.string().min(10).max(8000).optional(),
    capacity: z.number().int().positive().max(100).optional(),
    requirements: z.string().max(2000).optional(),
    rolesNeeded: z.string().max(2000).optional(),
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
      title?: string;
      summary?: string;
      description?: string;
      capacity?: number;
      requirements?: string | null;
      rolesNeeded?: string | null;
      deadline?: Date | null;
    } = {};

    if (parsed.status) {
      updateData.status = parsed.status === "OPEN" ? ProjectStatus.OPEN : ProjectStatus.CLOSED;
    }
    if (parsed.title !== undefined) updateData.title = parsed.title;
    if (parsed.summary !== undefined) updateData.summary = parsed.summary;
    if (parsed.description !== undefined) updateData.description = parsed.description;
    if (parsed.capacity !== undefined) updateData.capacity = parsed.capacity;
    if (parsed.requirements !== undefined) updateData.requirements = parsed.requirements || null;
    if (parsed.rolesNeeded !== undefined) updateData.rolesNeeded = parsed.rolesNeeded || null;
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
