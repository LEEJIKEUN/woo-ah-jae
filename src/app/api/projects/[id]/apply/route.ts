import { ApplicationStatus, ProjectStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  applicantIntro: z.string().min(5).max(2000),
  contact: z.string().min(2).max(300),
  answer1: z.string().max(2000).optional(),
  answer2: z.string().max(2000).optional(),
  answer3: z.string().max(2000).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthFromRequest(request);
    const { id: projectId } = await params;
    const parsed = bodySchema.parse(await request.json());

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return NextResponse.json({ error: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
    }

    if (project.status === ProjectStatus.CLOSED) {
      return NextResponse.json({ error: "모집이 마감된 프로젝트입니다." }, { status: 400 });
    }

    if (project.ownerId === auth.userId) {
      return NextResponse.json({ error: "본인 프로젝트에는 지원할 수 없습니다." }, { status: 400 });
    }

    const exists = await prisma.application.findUnique({
      where: { projectId_applicantId: { projectId, applicantId: auth.userId } },
    });

    if (exists) {
      return NextResponse.json({ error: "이미 지원한 프로젝트입니다." }, { status: 409 });
    }

    const application = await prisma.application.create({
      data: {
        projectId,
        applicantId: auth.userId,
        applicantIntro: parsed.applicantIntro,
        contact: parsed.contact,
        answer1: parsed.answer1,
        answer2: parsed.answer2,
        answer3: parsed.answer3,
        status: ApplicationStatus.PENDING,
      },
    });

    return NextResponse.json(
      {
        item: application,
        message: "신청이 완료되었습니다. 프로젝트 관리자의 승인을 기다려주세요.",
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "잘못된 입력입니다." }, { status: 400 });
    }
    return jsonError(error);
  }
}
