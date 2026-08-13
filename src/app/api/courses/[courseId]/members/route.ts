import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { getCourse } from "@/lib/course/content";
import { canEnterClassroom } from "@/lib/course/access";
import { getEnrolledUserIds } from "@/lib/enrollment-store";
import { courseStaffIds } from "@/lib/notification-store";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function sessionFromReq(request: NextRequest) {
  try {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

/** 강좌 수강생 이름 목록 — @멘션 자동완성용. 강의실 접근 가능한 사용자만. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  if (!getCourse(courseId)) return NextResponse.json({ error: "강좌를 찾을 수 없습니다." }, { status: 404 });
  const s = await sessionFromReq(request);
  if (!s) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!(await canEnterClassroom(courseId, s))) return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });

  // 수강생 + 스태프(관리자·담당 퍼실) → @멘션 대상 후보
  const [enrolledIds, staffIds] = await Promise.all([getEnrolledUserIds(courseId), courseStaffIds(courseId)]);
  const ids = [...new Set([...enrolledIds, ...staffIds])];
  const users = ids.length
    ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, studentProfile: { select: { realName: true } } } })
    : [];
  const members = users
    .map((u) => ({ id: u.id, name: u.studentProfile?.realName?.trim() || "" }))
    .filter((m) => m.name)
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  return NextResponse.json({ members });
}
