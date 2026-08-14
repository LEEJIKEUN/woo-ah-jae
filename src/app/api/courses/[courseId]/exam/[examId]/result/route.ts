import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { isStaffRole, isFacilitatorOfCourse } from "@/lib/course/access";
import { loadAndGrade, gradeExam } from "@/lib/exam/grade";
import { expireOverdueAttempts } from "@/lib/exam/store";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * 채점 결과 + 답안 리뷰. 정답(answerKey)은 종료된 응시(제출/시간종료)에만 노출.
 * - 학생: 본인 응시, in_progress 면 거부(시험 중 정답 노출 금지)
 * - 스태프: ?studentId 로 특정 학생 리뷰
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string; examId: string }> }) {
  try {
    const { courseId, examId } = await params;
    const auth = await getAuthFromRequest(request);
    const staff = isStaffRole(auth.role);

    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam || exam.courseId !== courseId) return NextResponse.json({ error: "시험을 찾을 수 없습니다." }, { status: 404 });

    let studentId = auth.userId;
    if (staff) {
      if (auth.role === "FACILITATOR" && !(await isFacilitatorOfCourse(courseId, auth.userId))) return NextResponse.json({ error: "담당 강좌가 아닙니다." }, { status: 403 });
      studentId = new URL(request.url).searchParams.get("studentId") || "";
      if (!studentId) return NextResponse.json({ error: "studentId 필요" }, { status: 400 });
    } else if (auth.role !== "STUDENT") {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    await expireOverdueAttempts([examId]); // 마감 지난 방치 응시 확정

    let studentName: string | undefined;
    if (staff) {
      const u = await prisma.user.findUnique({ where: { id: studentId }, select: { email: true, studentProfile: { select: { realName: true } } } });
      studentName = u?.studentProfile?.realName?.trim() || u?.email || undefined;
    }
    const examMeta = { title: exam.title, subject: exam.subject, durationSec: exam.durationSec, hasStudentPaper: !!exam.studentPaperKey, studentPageCount: exam.studentPageCount };

    const attempt = await prisma.examAttempt.findUnique({ where: { examId_studentId: { examId, studentId } } });

    if (!attempt) {
      // 미응시: 마감된 시험(closesAt 지남 또는 상태 closed)에 배정됐으면 0점 리뷰(빈 답안+정답 공개)
      const closed = exam.status === "closed" || (!!exam.closesAt && new Date() > exam.closesAt);
      const assigned = await prisma.examAssignment.findUnique({ where: { examId_studentId: { examId, studentId } } });
      if (!assigned || !closed) return NextResponse.json({ code: "NO_ATTEMPT", error: "응시 기록이 없습니다." }, { status: 404 });
      const questions = await prisma.examQuestion.findMany({ where: { examId }, select: { number: true, type: true, points: true, answerKey: true } });
      const result = gradeExam(questions, []); // 빈 답안 → 전부 0점
      return NextResponse.json({ exam: examMeta, attempt: { status: "expired", submittedAt: null }, studentName, result, noShow: true });
    }

    // 학생 본인은 종료된 응시만 결과 열람 가능
    if (!staff && attempt.status === "in_progress") return NextResponse.json({ error: "시험이 종료된 뒤 결과를 볼 수 있습니다." }, { status: 403 });

    const result = await loadAndGrade(examId, studentId);
    return NextResponse.json({
      exam: examMeta,
      attempt: { status: attempt.status, submittedAt: attempt.submittedAt ? attempt.submittedAt.toISOString() : null },
      studentName,
      result,
    });
  } catch (error) {
    return jsonError(error);
  }
}
