import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/guards";
import { getCourse } from "@/lib/course/content";
import { unenrollUser } from "@/lib/enrollment-store";
import { publishEnrollment } from "@/lib/enrollment-bus";

export const dynamic = "force-dynamic";

/**
 * 수강신청 취소(관리자 전용) — 해당 학생을 강좌 로스터에서 제외한다.
 * 안전 정책: 수강신청 기록만 삭제하고, 이수·게시글·시험 등 기존 기록은 건드리지 않는다.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ courseId: string; studentId: string }> }) {
  try {
    const { courseId, studentId } = await params;
    await requireAdmin(request);
    const { applied } = await unenrollUser(courseId, studentId);
    // 정원 카운트가 줄었으니 홈 목록·강좌 소개 실시간 현황에 즉시 반영
    const capacity = getCourse(courseId)?.format === "자기주도학습" ? 999 : 20;
    publishEnrollment(courseId, { applied, capacity, full: applied >= capacity });
    return NextResponse.json({ ok: true, applied });
  } catch (error) {
    return jsonError(error);
  }
}
