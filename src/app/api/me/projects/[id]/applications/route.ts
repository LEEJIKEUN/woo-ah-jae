import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { formatApplicantLabel } from "@/lib/project-dto";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthFromRequest(request);
    const { id: projectId } = await params;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        title: true,
        ownerId: true,
        capacity: true,
        status: true,
        question1: true,
        question2: true,
        question3: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
    }

    if (project.ownerId !== auth.userId) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    const applications = await prisma.application.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: {
        applicant: {
          select: {
            id: true,
            email: true,
            studentProfile: {
              select: { realName: true, schoolName: true, grade: true },
            },
          },
        },
      },
    });

    return NextResponse.json({
      project,
      items: applications.map((item) => {
        const label = formatApplicantLabel(item.applicant);
        return {
          id: item.id,
          status: item.status,
          createdAt: item.createdAt,
          applicantIntro: item.applicantIntro,
          contact: item.contact,
          answer1: item.answer1,
          answer2: item.answer2,
          answer3: item.answer3,
          applicant: {
            id: item.applicant.id,
            email: item.applicant.email,
            ...label,
          },
        };
      }),
    });
  } catch (error) {
    return jsonError(error);
  }
}
