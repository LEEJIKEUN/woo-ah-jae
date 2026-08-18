import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { getCourse } from "@/lib/course/content";
import { isStaffRole } from "@/lib/course/access";
import { getCourseMeta, getCourseDeadline, setCourseStatus, firstClassMsById, autoAdvanceStatus, enrollmentCloseMs, type CourseStatus } from "@/lib/course/meta-store";
import { loadDbCourse } from "@/lib/course/db-course";
import { publishEnrollment } from "@/lib/enrollment-bus";
import { enrollUser, getApplied, isUserEnrolled } from "@/lib/enrollment-store";

/** 형식별 정원: 자기주도학습(SELF)=999, 그 외=모집인원(기본 20) */
function capacityForCourse(courseId: string): number {
  const course = getCourse(courseId);
  return course?.format === "자기주도학습" ? 999 : 20;
}

/** 접수 상태별 안내 — 신청 가능한 상태는 "open" 뿐. */
const ENROLL_BLOCK_MSG: Record<string, string> = {
  private: "아직 공개되지 않은 강좌입니다.",
  prep: "곧 접수를 시작합니다. 잠시만 기다려 주세요.",
  full: "정원이 모두 찼습니다. 수강신청이 마감되었습니다.",
  ongoing: "이미 진행 중인 강좌라 새로운 수강신청을 받지 않습니다.",
};

/** 강좌의 실효 노출 상태(메타 > 하드코딩 defaultStatus > DB > 기본 open). full 은 첫 수업일 지나면 ongoing. */
async function effectiveStatus(courseId: string): Promise<string> {
  const meta = await getCourseMeta(courseId);
  const hard = getCourse(courseId);
  let stored: string;
  if (meta?.status) stored = meta.status;
  else if (hard) stored = hard.defaultStatus ?? "open";
  else { const db = await loadDbCourse(courseId); stored = db?.status ?? "open"; }
  if (stored === "open" || stored === "full") {
    const [fc, dl] = await Promise.all([firstClassMsById(courseId), getCourseDeadline(courseId)]);
    return autoAdvanceStatus(stored as CourseStatus, fc, enrollmentCloseMs(dl));
  }
  return stored;
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
  // 수강신청 가능 여부는 '상태(open)'와 정원으로만 판단(신청마감일은 표시용).
  return NextResponse.json({ applied, capacity, full: applied >= capacity, enrolled });
}

// 수강신청(로그인 필요 · 사용자ID 기록)
export async function POST(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const s = await sessionFromReq(request);
  if (!s) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (s.role !== "STUDENT") {
    return NextResponse.json({ error: "수강신청은 학생 계정만 가능합니다." }, { status: 403 });
  }
  // 접수중(open) 상태에서만 신청 가능 — 진행중·마감·준비중·비공개는 차단
  const status = await effectiveStatus(courseId);
  if (status !== "open") {
    const msg = ENROLL_BLOCK_MSG[status] ?? "지금은 수강신청을 받지 않습니다.";
    return NextResponse.json({ error: msg }, { status: status === "private" ? 404 : 409 });
  }
  const capacity = capacityForCourse(courseId);
  const result = await enrollUser(courseId, s.userId, capacity);
  // 구독 중인 모든 SSE 스트림에 즉시 푸시
  publishEnrollment(courseId, { applied: result.applied, capacity, full: result.full });

  // 정원(20명) 도달 시 자동으로 '마감(full)' 전환 → 이후 신규 신청 차단.
  // (마감 상태는 첫 수업일 00:00 에 '진행중'으로 자동 승격된다 — resolveCourseStatus)
  if (result.ok && result.full && capacity < 999) {
    try {
      await setCourseStatus(courseId, "full", !!getCourse(courseId));
    } catch {
      /* 상태 전환 실패는 신청 성공을 막지 않음 */
    }
  }
  return NextResponse.json({ ...result, capacity }, { status: result.ok ? 200 : 409 });
}
