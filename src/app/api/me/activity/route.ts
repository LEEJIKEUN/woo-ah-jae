import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);

    const [owned, joined, applied] = await Promise.all([
      prisma.project.findMany({
        where: { ownerId: auth.userId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          title: true,
          tab: true,
          channel: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.projectMember.findMany({
        where: { userId: auth.userId },
        orderBy: { joinedAt: "desc" },
        take: 5,
        select: {
          joinedAt: true,
          project: {
            select: {
              id: true,
              title: true,
              tab: true,
              channel: true,
              status: true,
              createdAt: true,
            },
          },
        },
      }),
      prisma.application.findMany({
        where: { applicantId: auth.userId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          status: true,
          createdAt: true,
          project: {
            select: {
              id: true,
              title: true,
              tab: true,
              channel: true,
              status: true,
            },
          },
        },
      }),
    ]);

    return NextResponse.json({
      owned,
      joined: joined.map((item) => ({ ...item.project, joinedAt: item.joinedAt })),
      applied,
    });
  } catch (error) {
    return jsonError(error);
  }
}
