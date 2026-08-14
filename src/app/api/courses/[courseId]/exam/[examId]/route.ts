import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { isStaffRole, isFacilitatorOfCourse } from "@/lib/course/access";
import { deletePrivateKey } from "@/lib/private-file";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** 시험 완전 삭제(스태프) — 문항·배정·응시·답안 + R2 PDF 까지 모두 제거(찌꺼기 없음). */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ courseId: string; examId: string }> }) {
  try {
    const { courseId, examId } = await params;
    const auth = await getAuthFromRequest(request);
    if (!isStaffRole(auth.role)) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam || exam.courseId !== courseId) return NextResponse.json({ error: "시험을 찾을 수 없습니다." }, { status: 404 });
    if (auth.role === "FACILITATOR" && !(await isFacilitatorOfCourse(courseId, auth.userId))) {
      return NextResponse.json({ error: "담당 강좌가 아닙니다." }, { status: 403 });
    }

    const attempts = await prisma.examAttempt.findMany({ where: { examId }, select: { id: true } });
    const attemptIds = attempts.map((a) => a.id);

    await prisma.$transaction([
      ...(attemptIds.length ? [prisma.examAnswer.deleteMany({ where: { attemptId: { in: attemptIds } } })] : []),
      prisma.examAttempt.deleteMany({ where: { examId } }),
      prisma.examAssignment.deleteMany({ where: { examId } }),
      prisma.examQuestion.deleteMany({ where: { examId } }),
      prisma.exam.delete({ where: { id: examId } }),
    ]);

    // R2 원본 + 학생용 PDF 삭제(best-effort)
    await deletePrivateKey(exam.paperKey);
    if (exam.studentPaperKey) await deletePrivateKey(exam.studentPaperKey);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
