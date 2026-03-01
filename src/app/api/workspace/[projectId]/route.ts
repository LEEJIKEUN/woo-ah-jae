import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { requireTeamMember, requireWorkspaceManager } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  pinnedNotice: z.string().max(4000).nullable().optional(),
  googleDriveUrl: z.string().url().nullable().optional(),
  googleSheetUrl: z.string().url().nullable().optional(),
  googleDocsUrl: z.string().url().nullable().optional(),
  zoomMeetingUrl: z.string().url().nullable().optional(),
  pptUrl: z.string().url().nullable().optional(),
  finalReportPdfUrl: z.string().url().nullable().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const auth = await getAuthFromRequest(request);
    const { projectId } = await params;
    await requireTeamMember(projectId, auth.userId, auth.role);

    const [project, config] = await Promise.all([
      prisma.project.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          title: true,
          summary: true,
          description: true,
          ownerId: true,
          status: true,
          _count: { select: { members: true } },
        },
      }),
      prisma.workspaceConfig.upsert({
        where: { projectId },
        update: {},
        create: { projectId },
      }),
    ]);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ project, config });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const auth = await getAuthFromRequest(request);
    const { projectId } = await params;
    await requireWorkspaceManager(projectId, auth.userId, auth.role);

    const body = patchSchema.parse(await request.json());

    const updateData: {
      pinnedNotice?: string | null;
      googleDriveUrl?: string | null;
      googleSheetUrl?: string | null;
      googleDocsUrl?: string | null;
      zoomMeetingUrl?: string | null;
      pptUrl?: string | null;
      finalReportPdfUrl?: string | null;
    } = {};

    if (Object.prototype.hasOwnProperty.call(body, "pinnedNotice")) {
      updateData.pinnedNotice = body.pinnedNotice ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(body, "googleDriveUrl")) {
      updateData.googleDriveUrl = body.googleDriveUrl ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(body, "googleSheetUrl")) {
      updateData.googleSheetUrl = body.googleSheetUrl ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(body, "googleDocsUrl")) {
      updateData.googleDocsUrl = body.googleDocsUrl ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(body, "zoomMeetingUrl")) {
      updateData.zoomMeetingUrl = body.zoomMeetingUrl ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(body, "pptUrl")) {
      updateData.pptUrl = body.pptUrl ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(body, "finalReportPdfUrl")) {
      updateData.finalReportPdfUrl = body.finalReportPdfUrl ?? null;
    }

    const item = await prisma.workspaceConfig.upsert({
      where: { projectId },
      update: updateData,
      create: {
        projectId,
        pinnedNotice: body.pinnedNotice ?? null,
        googleDriveUrl: body.googleDriveUrl ?? null,
        googleSheetUrl: body.googleSheetUrl ?? null,
        googleDocsUrl: body.googleDocsUrl ?? null,
        zoomMeetingUrl: body.zoomMeetingUrl ?? null,
        pptUrl: body.pptUrl ?? null,
        finalReportPdfUrl: body.finalReportPdfUrl ?? null,
      },
    });

    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    return jsonError(error);
  }
}
