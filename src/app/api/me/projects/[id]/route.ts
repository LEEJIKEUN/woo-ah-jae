import { ProjectStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  status: z.enum(["OPEN", "CLOSED"]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthFromRequest(request);
    const { id } = await params;
    const { status } = bodySchema.parse(await request.json());

    const project = await prisma.project.findUnique({ where: { id }, select: { ownerId: true } });
    if (!project) {
      return NextResponse.json({ error: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
    }

    if (project.ownerId !== auth.userId) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    const updated = await prisma.project.update({
      where: { id },
      data: { status: status === "OPEN" ? ProjectStatus.OPEN : ProjectStatus.CLOSED },
    });

    return NextResponse.json({ item: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "잘못된 요청입니다." }, { status: 400 });
    }
    return jsonError(error);
  }
}
