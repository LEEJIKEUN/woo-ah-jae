import bcrypt from "bcryptjs";
import { GroupMemberRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthFromRequest, jsonError, requireVerifiedOrAdmin } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  joinSecret: z.string().min(1),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireVerifiedOrAdmin(request);
    const { id: groupId } = await params;
    const body = bodySchema.parse(await request.json());

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const already = await prisma.groupMember.findFirst({
      where: { groupId, userId: auth.userId },
    });
    if (already) {
      return NextResponse.json({ ok: true, alreadyMember: true });
    }

    const ok = await bcrypt.compare(body.joinSecret, group.joinSecretHash);
    if (!ok) {
      return NextResponse.json({ error: "Invalid group password" }, { status: 403 });
    }

    await prisma.groupMember.create({
      data: {
        groupId,
        userId: auth.userId,
        role: GroupMemberRole.MEMBER,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    return jsonError(error);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthFromRequest(request);
    const { id: groupId } = await params;

    const membership = await prisma.groupMember.findFirst({
      where: { groupId, userId: auth.userId },
      include: { group: true },
    });

    return NextResponse.json({ isMember: Boolean(membership), group: membership?.group ?? null });
  } catch (error) {
    return jsonError(error);
  }
}
