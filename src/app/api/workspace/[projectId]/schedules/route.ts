import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { requireTeamMember } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  title: z.string().min(1).max(120),
  note: z.string().max(600).optional().nullable(),
  date: z.string().datetime(),
});

function parseMonth(month: string | null) {
  if (!month) return null;
  const matched = month.match(/^(\d{4})-(\d{2})$/);
  if (!matched) return null;
  const year = Number(matched[1]);
  const m = Number(matched[2]);
  if (!Number.isInteger(year) || !Number.isInteger(m) || m < 1 || m > 12) return null;
  return { year, month: m };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const auth = await getAuthFromRequest(request);
    const { projectId } = await params;
    await requireTeamMember(projectId, auth.userId, auth.role);

    const monthParam = parseMonth(request.nextUrl.searchParams.get("month"));
    const base = monthParam
      ? new Date(Date.UTC(monthParam.year, monthParam.month - 1, 1))
      : new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
    const monthStart = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 1));

    const items = await prisma.workspaceSchedule.findMany({
      where: {
        projectId,
        date: {
          gte: monthStart,
          lt: monthEnd,
        },
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
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
      month: `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, "0")}`,
      items: items.map((item) => ({
        id: item.id,
        title: item.title,
        note: item.note,
        date: item.date.toISOString(),
        done: item.done,
        createdAt: item.createdAt.toISOString(),
        creator: {
          id: item.creator.id,
          name: item.creator.studentProfile?.realName ?? item.creator.email.split("@")[0],
        },
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const auth = await getAuthFromRequest(request);
    const { projectId } = await params;
    await requireTeamMember(projectId, auth.userId, auth.role);

    const body = createSchema.parse(await request.json());

    const item = await prisma.workspaceSchedule.create({
      data: {
        projectId,
        creatorId: auth.userId,
        title: body.title.trim(),
        note: body.note?.trim() || null,
        date: new Date(body.date),
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

    return NextResponse.json(
      {
        item: {
          id: item.id,
          title: item.title,
          note: item.note,
          date: item.date.toISOString(),
          done: item.done,
          createdAt: item.createdAt.toISOString(),
          creator: {
            id: item.creator.id,
            name: item.creator.studentProfile?.realName ?? item.creator.email.split("@")[0],
          },
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    return jsonError(error);
  }
}
