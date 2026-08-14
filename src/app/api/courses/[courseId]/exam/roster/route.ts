import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { isStaffRole, isFacilitatorOfCourse } from "@/lib/course/access";
import { getEnrolledUserIds } from "@/lib/enrollment-store";
import { gradeExam } from "@/lib/exam/grade";
import { expireOverdueAttempts } from "@/lib/exam/store";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** 시험 명렬표(스태프) — 수강생 × 시험. 완료 응시는 자동채점 점수, 그 외 상태. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const { courseId } = await params;
    const auth = await getAuthFromRequest(request);
    if (!isStaffRole(auth.role)) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    if (auth.role === "FACILITATOR" && !(await isFacilitatorOfCourse(courseId, auth.userId))) return NextResponse.json({ error: "담당 강좌가 아닙니다." }, { status: 403 });

    const exams = await prisma.exam.findMany({ where: { courseId }, orderBy: { createdAt: "asc" } });
    const examIds = exams.map((e) => e.id);

    const enrolledIds = await getEnrolledUserIds(courseId);
    const users = enrolledIds.length ? await prisma.user.findMany({ where: { id: { in: enrolledIds } }, select: { id: true, email: true, studentProfile: { select: { realName: true } } } }) : [];
    const students = users
      .map((u) => ({ id: u.id, name: u.studentProfile?.realName?.trim() || u.email }))
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));

    if (!examIds.length) return NextResponse.json({ exams: [], students, cells: {} });

    // 마감 지난 방치 응시를 expired 로 확정(응시중 오표기 방지)
    await expireOverdueAttempts(examIds);

    const [assigns, attempts, questions] = await Promise.all([
      prisma.examAssignment.findMany({ where: { examId: { in: examIds } }, select: { examId: true, studentId: true } }),
      prisma.examAttempt.findMany({ where: { examId: { in: examIds } }, select: { id: true, examId: true, studentId: true, status: true } }),
      prisma.examQuestion.findMany({ where: { examId: { in: examIds } }, select: { examId: true, number: true, type: true, points: true, answerKey: true } }),
    ]);

    const qByExam = new Map<string, { number: number; type: string; points: number; answerKey: string }[]>();
    for (const q of questions) { const arr = qByExam.get(q.examId) ?? []; arr.push(q); qByExam.set(q.examId, arr); }
    const totalByExam = new Map(examIds.map((id) => [id, (qByExam.get(id) ?? []).reduce((s, q) => s + q.points, 0)]));

    const assignedSet = new Set(assigns.map((a) => `${a.examId}:${a.studentId}`));
    const terminalAttempts = attempts.filter((a) => a.status !== "in_progress");
    const answers = terminalAttempts.length
      ? await prisma.examAnswer.findMany({ where: { attemptId: { in: terminalAttempts.map((a) => a.id) } }, select: { attemptId: true, questionNo: true, choice: true, textAnswer: true } })
      : [];
    const ansByAttempt = new Map<string, { questionNo: number; choice: number | null; textAnswer: string | null }[]>();
    for (const a of answers) { const arr = ansByAttempt.get(a.attemptId) ?? []; arr.push(a); ansByAttempt.set(a.attemptId, arr); }

    const attemptByKey = new Map(attempts.map((a) => [`${a.examId}:${a.studentId}`, a]));

    // 셀 구성
    const cells: Record<string, Record<string, { status: string; score?: number; total?: number }>> = {};
    for (const s of students) {
      cells[s.id] = {};
      for (const e of exams) {
        const key = `${e.id}:${s.id}`;
        if (!assignedSet.has(key)) { cells[s.id][e.id] = { status: "unassigned" }; continue; }
        const at = attemptByKey.get(key);
        if (!at) { cells[s.id][e.id] = { status: "not_started" }; continue; }
        if (at.status === "in_progress") { cells[s.id][e.id] = { status: "in_progress" }; continue; }
        const g = gradeExam(qByExam.get(e.id) ?? [], ansByAttempt.get(at.id) ?? []);
        cells[s.id][e.id] = { status: at.status, score: g.score, total: g.total };
      }
    }

    const submittedCountByExam = new Map<string, number>();
    for (const a of terminalAttempts) submittedCountByExam.set(a.examId, (submittedCountByExam.get(a.examId) ?? 0) + 1);
    const assignedCountByExam = new Map<string, number>();
    for (const a of assigns) assignedCountByExam.set(a.examId, (assignedCountByExam.get(a.examId) ?? 0) + 1);

    return NextResponse.json({
      students,
      exams: exams.map((e) => ({
        id: e.id, title: e.title, subject: e.subject, status: e.status,
        total: totalByExam.get(e.id) ?? 0,
        assignedCount: assignedCountByExam.get(e.id) ?? 0,
        submittedCount: submittedCountByExam.get(e.id) ?? 0,
      })),
      cells,
    });
  } catch (error) {
    return jsonError(error);
  }
}
