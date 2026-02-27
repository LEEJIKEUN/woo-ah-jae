import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { toCardItem } from "@/lib/project-dto";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const item = await prisma.project.findUnique({
    where: { id },
    include: {
      owner: {
        select: {
          id: true,
          email: true,
          studentProfile: {
            select: { realName: true, schoolName: true, grade: true },
          },
        },
      },
      _count: { select: { applications: true, members: true } },
    },
  });

  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let myApplicationStatus: string | null = null;
  try {
    const auth = await getAuthFromRequest(request);
    const myApplication = await prisma.application.findUnique({
      where: { projectId_applicantId: { projectId: id, applicantId: auth.userId } },
      select: { status: true },
    });
    myApplicationStatus = myApplication?.status ?? null;
  } catch {
    myApplicationStatus = null;
  }

  return NextResponse.json({
    item: {
      ...toCardItem(item),
      description: item.description,
      requirements: item.requirements,
      rolesNeeded: item.rolesNeeded,
      question1: item.question1,
      question2: item.question2,
      question3: item.question3,
      ownerId: item.ownerId,
      owner: {
        id: item.owner.id,
        email: item.owner.email,
        name: item.owner.studentProfile?.realName ?? item.owner.email.split("@")[0],
        school: item.owner.studentProfile?.schoolName ?? "학교미입력",
        grade: item.owner.studentProfile?.grade ?? "학년미입력",
      },
      applicantCount: item._count.applications,
      memberCount: item._count.members,
      myApplicationStatus,
    },
  });
}
