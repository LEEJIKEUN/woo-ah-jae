import { PostScope, ProjectStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { toCardItem } from "@/lib/project-dto";
import { generateThumbnailUrl } from "@/lib/thumbnail/service";

const createSchema = z.object({
  title: z.string().min(2).max(120),
  summary: z.string().min(2).max(240),
  description: z.string().min(10).max(8000),
  tab: z.string().min(1).max(40),
  channel: z.string().min(1).max(80),
  thumbnailUrl: z.string().max(1000).nullable().optional(),
  capacity: z.number().int().positive().max(100),
  requirements: z.string().max(2000).optional(),
  rolesNeeded: z.string().max(2000).optional(),
  status: z.enum(["OPEN", "CLOSED"]).optional(),
  question1: z.string().max(300).optional(),
  question2: z.string().max(300).optional(),
  question3: z.string().max(300).optional(),
  deadline: z.string().datetime().optional(),
});

function toOrderBy(sort: string | null) {
  if (sort === "latest") {
    return [{ createdAt: "desc" as const }];
  }
  return [{ popularityScore: "desc" as const }, { likeCount: "desc" as const }, { createdAt: "desc" as const }];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tab = searchParams.get("tab");
  const channel = searchParams.get("channel");
  const sort = searchParams.get("sort");
  const query = searchParams.get("query");

  const items = await prisma.project.findMany({
    where: {
      ...(tab ? { tab } : {}),
      ...(channel && channel !== "전체" ? { channel } : {}),
      ...(query
        ? {
            OR: [
              { title: { contains: query } },
              { summary: { contains: query } },
              { description: { contains: query } },
            ],
          }
        : {}),
    },
    orderBy: toOrderBy(sort),
  });

  return NextResponse.json({ items: items.map(toCardItem) });
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);
    const parsed = createSchema.parse(await request.json());

    const thumbnail = parsed.thumbnailUrl
      ? { url: parsed.thumbnailUrl }
      : await generateThumbnailUrl({
          tab: parsed.tab,
          channel: parsed.channel,
          title: parsed.title,
          summary: parsed.summary,
        });

    const questionCount = [parsed.question1, parsed.question2, parsed.question3].filter((v) => v && v.trim()).length;
    if (questionCount < 1) {
      return NextResponse.json({ error: "질문은 최소 1개 이상 입력해야 합니다." }, { status: 400 });
    }

    const project = await prisma.project.create({
      data: {
        ownerId: auth.userId,
        title: parsed.title,
        summary: parsed.summary,
        description: parsed.description,
        tab: parsed.tab,
        channel: parsed.channel,
        thumbnailUrl: thumbnail?.url ?? null,
        capacity: parsed.capacity,
        requirements: parsed.requirements,
        rolesNeeded: parsed.rolesNeeded,
        status: parsed.status === "CLOSED" ? ProjectStatus.CLOSED : ProjectStatus.OPEN,
        question1: parsed.question1?.trim() || null,
        question2: parsed.question2?.trim() || null,
        question3: parsed.question3?.trim() || null,
        deadline: parsed.deadline ? new Date(parsed.deadline) : null,
      },
    });

    await prisma.post.create({
      data: {
        scope: PostScope.GLOBAL,
        title: `[프로젝트 개설] ${project.title}`,
        body: project.summary ?? project.description,
        createdBy: auth.userId,
      },
    });

    return NextResponse.json({ item: toCardItem(project) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    return jsonError(error);
  }
}
