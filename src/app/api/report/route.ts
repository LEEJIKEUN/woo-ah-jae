import { BoardCommentStatus, BoardPostStatus, ReportTargetType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

const reportSchema = z.object({
  targetType: z.enum(["POST", "COMMENT"]),
  targetId: z.string().cuid(),
  reasonCode: z.enum(["SPAM", "ABUSE", "PRIVACY", "COPYRIGHT", "OTHER"]),
  detail: z.string().max(1000).optional(),
});

const AUTO_HIDE_THRESHOLD = 5;

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);
    const parsed = reportSchema.parse(await request.json());

    if (parsed.targetType === "POST") {
      const post = await prisma.boardPost.findUnique({
        where: { id: parsed.targetId },
        select: { id: true, status: true },
      });
      if (!post || post.status === BoardPostStatus.DELETED) {
        return NextResponse.json({ error: "신고 대상 게시글이 없습니다." }, { status: 404 });
      }
    } else {
      const comment = await prisma.boardComment.findUnique({
        where: { id: parsed.targetId },
        select: { id: true, status: true },
      });
      if (!comment || comment.status === BoardCommentStatus.DELETED) {
        return NextResponse.json({ error: "신고 대상 댓글이 없습니다." }, { status: 404 });
      }
    }

    const exists = await prisma.boardReport.findFirst({
      where: {
        targetType: parsed.targetType as ReportTargetType,
        targetId: parsed.targetId,
        reporterId: auth.userId,
      },
      select: { id: true },
    });
    if (exists) {
      return NextResponse.json({ error: "이미 신고한 대상입니다." }, { status: 409 });
    }

    const report = await prisma.boardReport.create({
      data: {
        targetType: parsed.targetType as ReportTargetType,
        targetId: parsed.targetId,
        reporterId: auth.userId,
        reasonCode: parsed.reasonCode,
        detail: parsed.detail?.trim() || null,
      },
      select: { id: true, createdAt: true },
    });

    const reportCount = await prisma.boardReport.count({
      where: {
        targetType: parsed.targetType as ReportTargetType,
        targetId: parsed.targetId,
      },
    });

    if (reportCount >= AUTO_HIDE_THRESHOLD) {
      if (parsed.targetType === "POST") {
        await prisma.boardPost.updateMany({
          where: { id: parsed.targetId, status: BoardPostStatus.ACTIVE },
          data: { status: BoardPostStatus.HIDDEN, isPinned: false, isNotice: false },
        });
      } else {
        await prisma.boardComment.updateMany({
          where: { id: parsed.targetId, status: BoardCommentStatus.ACTIVE },
          data: { status: BoardCommentStatus.HIDDEN },
        });
      }
    }

    return NextResponse.json({ item: { ...report, createdAt: report.createdAt.toISOString() }, reportCount }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "잘못된 요청입니다." }, { status: 400 });
    }
    return jsonError(error);
  }
}
