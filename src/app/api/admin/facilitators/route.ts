import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** 퍼실리테이터 가입 신청 목록 — 관리자. ?status=PENDING(기본) | APPROVED | ALL */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const status = new URL(request.url).searchParams.get("status") ?? "PENDING";
    const where = status === "ALL" ? {} : { status };
    const apps = await prisma.facilitatorApplication.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });
    const userIds = apps.map((a) => a.userId);
    const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true } }) : [];
    const emailOf = new Map(users.map((u) => [u.id, u.email]));
    const items = apps.map((a) => ({
      id: a.id,
      userId: a.userId,
      email: emailOf.get(a.userId) ?? "",
      status: a.status,
      realName: a.realName,
      birthDate: a.birthDate ? a.birthDate.toISOString().slice(0, 10) : null,
      phone: a.phone,
      university: a.university,
      department: a.department,
      entranceYear: a.entranceYear,
      enrollmentStatus: a.enrollmentStatus,
      docType: a.docType,
      fileName: a.fileName,
      createdAt: a.createdAt.toISOString(),
    }));
    return NextResponse.json({ items });
  } catch (error) {
    return jsonError(error);
  }
}
