import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { isStaffRole } from "@/lib/course/access";
import { findActivity } from "@/lib/course/content";
import { getEffectiveCourse } from "@/lib/course/curriculum";
import { isUserEnrolled } from "@/lib/enrollment-store";
import { prisma } from "@/lib/prisma";

/**
 * 관리자·퍼실리테이터가 실시간 수업 출석(=이수)을 학생별로 체크한다.
 * POST { userId, activityId, present } → 해당 학생의 LessonCompletion 을 토글.
 */
async function sessionFromReq(request: NextRequest) {
  try {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const course = await getEffectiveCourse(courseId); // 편집된 차시 id 도 출석 체크 가능하도록
  if (!course) return NextResponse.json({ error: "강좌를 찾을 수 없습니다." }, { status: 404 });

  const s = await sessionFromReq(request);
  if (!s) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!isStaffRole(s.role)) return NextResponse.json({ error: "관리자·퍼실리테이터만 가능합니다." }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { userId?: unknown; activityId?: unknown; present?: unknown } | null;
  const userId = typeof body?.userId === "string" ? body.userId : "";
  const activityId = typeof body?.activityId === "string" ? body.activityId : "";
  const present = body?.present !== false; // 기본 true
  if (!userId || !activityId || !findActivity(course, activityId)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  if (!(await isUserEnrolled(courseId, userId))) {
    return NextResponse.json({ error: "수강생이 아닙니다." }, { status: 400 });
  }

  const key = { userId_courseId_activityId: { userId, courseId, activityId } };
  if (present) {
    await prisma.lessonCompletion.upsert({ where: key, create: { userId, courseId, activityId }, update: {} });
  } else {
    await prisma.lessonCompletion.deleteMany({ where: { userId, courseId, activityId } });
  }
  return NextResponse.json({ ok: true });
}
