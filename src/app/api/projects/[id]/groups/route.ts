import bcrypt from "bcryptjs";
import { GroupMemberRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireVerifiedOrAdmin } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  name: z.string().min(1).max(100),
  joinSecret: z.string().min(4).max(100),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireVerifiedOrAdmin(request);
    const { id: projectId } = await params;
    const body = bodySchema.parse(await request.json());

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const joinSecretHash = await bcrypt.hash(body.joinSecret, 12);

    const group = await prisma.$transaction(async (tx) => {
      const created = await tx.group.create({
        data: {
          projectId,
          name: body.name,
          joinSecretHash,
        },
      });

      await tx.groupMember.create({
        data: {
          groupId: created.id,
          userId: auth.userId,
          role: GroupMemberRole.OWNER,
        },
      });

      return created;
    });

    return NextResponse.json(group, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    return jsonError(error);
  }
}
