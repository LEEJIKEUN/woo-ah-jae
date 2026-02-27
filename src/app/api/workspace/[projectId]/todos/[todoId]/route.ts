import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { requireTeamMember } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  done: z.boolean(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; todoId: string }> }
) {
  try {
    const auth = await getAuthFromRequest(request);
    const { projectId, todoId } = await params;
    await requireTeamMember(projectId, auth.userId, auth.role);

    const body = patchSchema.parse(await request.json());

    const item = await prisma.todoItem.findUnique({ where: { id: todoId }, select: { projectId: true } });
    if (!item || item.projectId !== projectId) {
      return NextResponse.json({ error: "Todo not found" }, { status: 404 });
    }

    const updated = await prisma.todoItem.update({
      where: { id: todoId },
      data: { done: body.done },
    });

    return NextResponse.json({ item: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    return jsonError(error);
  }
}
