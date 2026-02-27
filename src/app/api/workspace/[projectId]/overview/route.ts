import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { requireTeamMember } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  projectOverview: z.string().max(20000).nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const auth = await getAuthFromRequest(request);
    const { projectId } = await params;
    await requireTeamMember(projectId, auth.userId, auth.role);

    const body = patchSchema.parse(await request.json());

    const item = await prisma.workspaceConfig.upsert({
      where: { projectId },
      update: { projectOverview: body.projectOverview ?? null },
      create: { projectId, projectOverview: body.projectOverview ?? null },
      select: { projectOverview: true, updatedAt: true },
    });

    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    return jsonError(error);
  }
}
