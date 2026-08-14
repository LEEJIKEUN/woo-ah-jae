import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { isStaffRole, isFacilitatorOfCourse } from "@/lib/course/access";
import { getEnrolledUserIds } from "@/lib/enrollment-store";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** 시험 배정용 수강생 목록(스태프 전용) — 강좌에 등록된 학생 {id, name}. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const { courseId } = await params;
    const auth = await getAuthFromRequest(request);
    if (!isStaffRole(auth.role)) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    if (auth.role === "FACILITATOR" && !(await isFacilitatorOfCourse(courseId, auth.userId))) {
      return NextResponse.json({ error: "담당 강좌가 아닙니다." }, { status: 403 });
    }

    const ids = await getEnrolledUserIds(courseId);
    const users = ids.length
      ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true, studentProfile: { select: { realName: true } } } })
      : [];
    const students = users
      .map((u) => ({ id: u.id, name: u.studentProfile?.realName?.trim() || u.email }))
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));
    return NextResponse.json({ students });
  } catch (error) {
    return jsonError(error);
  }
}
