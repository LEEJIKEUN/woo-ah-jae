import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { toCardItem } from "@/lib/project-dto";

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);
    const items = await prisma.project.findMany({
      where: auth.role === "ADMIN" ? undefined : { ownerId: auth.userId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { applications: true, members: true } },
        owner: {
          select: {
            email: true,
            studentProfile: { select: { realName: true } },
          },
        },
      },
    });

    return NextResponse.json({
      items: items.map((item) => ({
        ...toCardItem(item),
        applicationCount: item._count.applications,
        memberCount: item._count.members,
        ownerName: item.owner.studentProfile?.realName ?? item.owner.email.split("@")[0],
        ownerEmail: item.owner.email,
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}
