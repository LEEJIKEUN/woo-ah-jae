import { PostScope } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireVerifiedOrAdmin } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { requireEntitlement } from "@/lib/entitlement";

const bodySchema = z.object({
  scope: z.nativeEnum(PostScope),
  groupId: z.string().cuid().optional(),
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(5000),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await requireVerifiedOrAdmin(request);
    await requireEntitlement(auth.userId);

    const parsed = bodySchema.parse(await request.json());

    if (parsed.scope === PostScope.GROUP && !parsed.groupId) {
      return NextResponse.json({ error: "groupId is required for GROUP posts" }, { status: 400 });
    }

    const post = await prisma.post.create({
      data: {
        scope: parsed.scope,
        groupId: parsed.groupId,
        title: parsed.title,
        body: parsed.body,
        createdBy: auth.userId,
      },
    });

    return NextResponse.json({ id: post.id, createdAt: post.createdAt }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    return jsonError(error);
  }
}
