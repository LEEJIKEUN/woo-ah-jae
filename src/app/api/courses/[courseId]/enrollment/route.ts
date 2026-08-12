import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { getCourse } from "@/lib/course/content";
import { isStaffRole } from "@/lib/course/access";
import { publishEnrollment } from "@/lib/enrollment-bus";
import { enrollUser, getApplied, isUserEnrolled } from "@/lib/enrollment-store";

/** 형식별 정원: 자기주도학습(SELF)=999, 그 외=모집인원(기본 20) */
function capacityForCourse(courseId: string): number {
  const course = getCourse(courseId);
  return course?.format === "자기주도학습" ? 999 : 20;
}

async function sessionFromReq(request: NextRequest) {
  try {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

// 신청 현황 조회(+ 현재 사용자 신청 여부)
export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const capacity = capacityForCourse(courseId);
  const applied = await getApplied(courseId);
  const s = await sessionFromReq(request);
  const enrolled = s ? isStaffRole(s.role) || (await isUserEnrolled(courseId, s.userId)) : false;
  return NextResponse.json({ applied, capacity, full: applied >= capacity, enrolled });
}

// 수강신청(로그인 필요 · 사용자ID 기록)
export async function POST(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const s = await sessionFromReq(request);
  if (!s) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const capacity = capacityForCourse(courseId);
  const result = await enrollUser(courseId, s.userId, capacity);
  // 구독 중인 모든 SSE 스트림에 즉시 푸시
  publishEnrollment(courseId, { applied: result.applied, capacity, full: result.full });
  return NextResponse.json({ ...result, capacity }, { status: result.ok ? 200 : 409 });
}
