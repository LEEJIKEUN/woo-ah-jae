import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { getCourse, findActivity } from "@/lib/course/content";
import { getEffectiveCourse } from "@/lib/course/curriculum";
import { prisma } from "@/lib/prisma";

/**
 * 레슨 완료(진도) 서버 기록. 학생 본인의 완료 상태를 저장/조회한다.
 * 학부모는 이 데이터를 근거로 자녀 진도를 조회한다(별도 학부모 API).
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

// 내 완료 활동 목록
export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  if (!getCourse(courseId)) return NextResponse.json({ error: "강좌를 찾을 수 없습니다." }, { status: 404 });
  const s = await sessionFromReq(request);
  if (!s) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const rows = await prisma.lessonCompletion.findMany({
    where: { userId: s.userId, courseId },
    select: { activityId: true },
  });
  return NextResponse.json({ done: rows.map((r) => r.activityId) });
}

// 완료 토글(본인 것만)
export async function POST(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const course = await getEffectiveCourse(courseId); // 편집된 차시 id 도 검증되도록 실효 강좌 사용
  if (!course) return NextResponse.json({ error: "강좌를 찾을 수 없습니다." }, { status: 404 });
  const s = await sessionFromReq(request);
  if (!s) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { activityId?: unknown; done?: unknown } | null;
  const activityId = typeof body?.activityId === "string" ? body.activityId : "";
  const done = body?.done !== false; // 기본 true
  if (!activityId || !findActivity(course, activityId)) {
    return NextResponse.json({ error: "잘못된 활동입니다." }, { status: 400 });
  }

  const key = { userId_courseId_activityId: { userId: s.userId, courseId, activityId } };
  if (done) {
    await prisma.lessonCompletion.upsert({
      where: key,
      create: { userId: s.userId, courseId, activityId },
      update: {},
    });
  } else {
    await prisma.lessonCompletion.deleteMany({ where: { userId: s.userId, courseId, activityId } });
  }
  return NextResponse.json({ ok: true });
}
