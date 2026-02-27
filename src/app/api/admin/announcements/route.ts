import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireAdmin } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(5000),
  pinned: z.boolean().default(false),
});

export async function GET() {
  const items = await prisma.announcement.findMany({
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    const parsed = bodySchema.parse(await request.json());

    const item = await prisma.announcement.create({
      data: {
        title: parsed.title,
        body: parsed.body,
        pinned: parsed.pinned,
        createdBy: admin.userId,
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    return jsonError(error);
  }
}
