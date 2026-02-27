import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { requireTeamMember } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  done: z.boolean().optional(),
  title: z.string().min(1).max(120).optional(),
  note: z.string().max(600).nullable().optional(),
  date: z.string().datetime().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; scheduleId: string }> }
) {
  try {
    const auth = await getAuthFromRequest(request);
    const { projectId, scheduleId } = await params;
    await requireTeamMember(projectId, auth.userId, auth.role);

    const body = patchSchema.parse(await request.json());

    const item = await prisma.workspaceSchedule.findUnique({ where: { id: scheduleId }, select: { projectId: true } });
    if (!item || item.projectId !== projectId) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }

    const updated = await prisma.workspaceSchedule.update({
      where: { id: scheduleId },
      data: {
        done: body.done,
        title: body.title?.trim(),
        note: typeof body.note === "undefined" ? undefined : body.note?.trim() || null,
        date: body.date ? new Date(body.date) : undefined,
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

    return NextResponse.json({
      item: {
        id: updated.id,
        title: updated.title,
        note: updated.note,
        date: updated.date.toISOString(),
        done: updated.done,
        createdAt: updated.createdAt.toISOString(),
        creator: {
          id: updated.creator.id,
          name: updated.creator.studentProfile?.realName ?? updated.creator.email.split("@")[0],
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    return jsonError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; scheduleId: string }> }
) {
  try {
    const auth = await getAuthFromRequest(request);
    const { projectId, scheduleId } = await params;
    await requireTeamMember(projectId, auth.userId, auth.role);

    const item = await prisma.workspaceSchedule.findUnique({ where: { id: scheduleId }, select: { projectId: true } });
    if (!item || item.projectId !== projectId) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }

    await prisma.workspaceSchedule.delete({ where: { id: scheduleId } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
