import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { isStaffRole, isFacilitatorOfCourse } from "@/lib/course/access";
import { getEnrolledUserIds } from "@/lib/enrollment-store";
import { createNotifications } from "@/lib/notification-store";
import { savePrivateFile, validateUpload } from "@/lib/upload";
import { gradeExam } from "@/lib/exam/grade";
import { expireOverdueAttempts } from "@/lib/exam/store";
import { trimPdfToPages } from "@/lib/exam/pdf";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type QInput = { type?: unknown; choiceCount?: unknown; points?: unknown; answerKey?: unknown };

function parseQuestions(raw: unknown): { type: string; choiceCount: number; points: number; answerKey: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 200).map((q: QInput) => {
    const type = q.type === "short" ? "short" : "mcq";
    const cc = typeof q.choiceCount === "number" ? Math.trunc(q.choiceCount) : Number(q.choiceCount);
    const pts = typeof q.points === "number" ? q.points : Number(q.points);
    return {
      type,
      choiceCount: type === "mcq" ? (Number.isFinite(cc) && cc >= 2 && cc <= 10 ? cc : 5) : 0,
      points: Number.isFinite(pts) && pts >= 0 ? pts : 1,
      answerKey: typeof q.answerKey === "string" ? q.answerKey.slice(0, 200).trim() : "",
    };
  });
}

/**
 * 시험 생성·발송(스태프 전용). multipart: paper(PDF) + payload(JSON).
 * status='published' 이면 선택 학생에게 배정 + 알림. 'draft' 는 임시저장(학생 미노출).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const { courseId } = await params;
    const auth = await getAuthFromRequest(request);
    if (!isStaffRole(auth.role)) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    if (auth.role === "FACILITATOR" && !(await isFacilitatorOfCourse(courseId, auth.userId))) {
      return NextResponse.json({ error: "담당 강좌가 아닙니다." }, { status: 403 });
    }

    const form = await request.formData();
    const paper = form.get("paper");
    if (!(paper instanceof File) || paper.size === 0) return NextResponse.json({ error: "시험지 PDF를 첨부해 주세요." }, { status: 400 });
    if (paper.type !== "application/pdf") return NextResponse.json({ error: "시험지는 PDF 파일만 업로드할 수 있습니다." }, { status: 400 });
    try { validateUpload(paper); } catch { return NextResponse.json({ error: "PDF는 10MB 이하만 업로드할 수 있습니다." }, { status: 400 }); }

    const payload = JSON.parse(String(form.get("payload") ?? "{}")) as {
      title?: unknown; subject?: unknown; durationMin?: unknown; opensAt?: unknown; closesAt?: unknown; status?: unknown; questions?: unknown; studentIds?: unknown; studentPageCount?: unknown;
    };
    const title = String(payload.title ?? "").trim().slice(0, 200);
    if (!title) return NextResponse.json({ error: "시험 제목을 입력해 주세요." }, { status: 400 });
    const durationMin = typeof payload.durationMin === "number" ? payload.durationMin : Number(payload.durationMin);
    if (!Number.isFinite(durationMin) || durationMin <= 0) return NextResponse.json({ error: "제한시간을 올바르게 입력해 주세요." }, { status: 400 });
    const questions = parseQuestions(payload.questions);
    if (!questions.length) return NextResponse.json({ error: "문항을 1개 이상 구성해 주세요." }, { status: 400 });

    const status = payload.status === "draft" ? "draft" : "published";
    const opensAt = typeof payload.opensAt === "string" && payload.opensAt ? new Date(payload.opensAt) : null;
    const closesAt = typeof payload.closesAt === "string" && payload.closesAt ? new Date(payload.closesAt) : null;

    // 선택 학생 중 실제 수강생만
    const requested = Array.isArray(payload.studentIds) ? (payload.studentIds as unknown[]).map(String) : [];
    const enrolled = new Set(await getEnrolledUserIds(courseId));
    const studentIds = [...new Set(requested.filter((id) => enrolled.has(id)))];

    const fullBytes = Buffer.from(await paper.arrayBuffer());
    const paperKey = await savePrivateFile(paper);

    // 학생용: 문제 페이지(앞 studentPageCount 장)만 남긴 PDF — 빠른정답·해설 제거
    let studentPaperKey = "";
    const spcRaw = typeof payload.studentPageCount === "number" ? payload.studentPageCount : Number(payload.studentPageCount);
    const spc = Number.isFinite(spcRaw) ? Math.trunc(spcRaw) : 0;
    if (spc > 0) {
      try {
        const trimmed = await trimPdfToPages(fullBytes, spc);
        if (trimmed) studentPaperKey = await savePrivateFile(new File([new Uint8Array(trimmed)], `student_${paper.name}`, { type: "application/pdf" }));
      } catch {
        /* 트림 실패 시 studentPaperKey 비움 → 아래에서 안전상 전체 대신 그대로 두되, 로그만 */
      }
    }

    const exam = await prisma.$transaction(async (tx) => {
      const e = await tx.exam.create({
        data: {
          courseId, title, subject: String(payload.subject ?? "").trim().slice(0, 120),
          paperKey, studentPaperKey, studentPageCount: studentPaperKey ? spc : 0,
          paperName: paper.name.slice(0, 200), paperSize: paper.size,
          durationSec: Math.round(durationMin * 60), opensAt, closesAt, status, createdBy: auth.userId,
        },
      });
      await tx.examQuestion.createMany({ data: questions.map((q, i) => ({ examId: e.id, number: i + 1, type: q.type, choiceCount: q.choiceCount, points: q.points, answerKey: q.answerKey })) });
      if (studentIds.length) await tx.examAssignment.createMany({ data: studentIds.map((sid) => ({ examId: e.id, studentId: sid })), skipDuplicates: true });
      return e;
    });

    if (status === "published" && studentIds.length) {
      await createNotifications(studentIds.map((sid) => ({ userId: sid, kind: "notice", title: `새 시험 · ${title}`, body: `제한시간 ${durationMin}분 · ${questions.length}문항`, href: `/course/${courseId}/exam` })));
    }

    return NextResponse.json({ ok: true, id: exam.id }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

/**
 * 강의실 시험 목록.
 * - 학생: 본인에게 배정된 시험(published|closed)만 + 본인 응시 상태
 * - 스태프: 강좌의 모든 시험 + 문항수·배정수·제출수(관리용, 상세는 Step 8)
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const { courseId } = await params;
    const auth = await getAuthFromRequest(request);
    const staff = isStaffRole(auth.role);
    if (staff && auth.role === "FACILITATOR" && !(await isFacilitatorOfCourse(courseId, auth.userId))) {
      return NextResponse.json({ error: "담당 강좌가 아닙니다." }, { status: 403 });
    }
    const now = new Date();

    if (staff) {
      const exams = await prisma.exam.findMany({ where: { courseId }, orderBy: { createdAt: "desc" } });
      const ids = exams.map((e) => e.id);
      const [qCounts, aCounts, subCounts] = await Promise.all([
        prisma.examQuestion.groupBy({ by: ["examId"], where: { examId: { in: ids } }, _count: { _all: true } }),
        prisma.examAssignment.groupBy({ by: ["examId"], where: { examId: { in: ids } }, _count: { _all: true } }),
        prisma.examAttempt.groupBy({ by: ["examId"], where: { examId: { in: ids }, status: { in: ["submitted", "expired"] } }, _count: { _all: true } }),
      ]);
      const qMap = new Map(qCounts.map((r) => [r.examId, r._count._all]));
      const aMap = new Map(aCounts.map((r) => [r.examId, r._count._all]));
      const sMap = new Map(subCounts.map((r) => [r.examId, r._count._all]));
      return NextResponse.json({
        serverNow: now.toISOString(),
        isStaff: true,
        rows: exams.map((e) => ({
          id: e.id,
          title: e.title,
          subject: e.subject,
          status: e.status,
          durationSec: e.durationSec,
          opensAt: e.opensAt ? e.opensAt.toISOString() : null,
          closesAt: e.closesAt ? e.closesAt.toISOString() : null,
          questionCount: qMap.get(e.id) ?? 0,
          assignedCount: aMap.get(e.id) ?? 0,
          submittedCount: sMap.get(e.id) ?? 0,
          attempt: null,
        })),
      });
    }

    // 학부모 등 학생/스태프가 아니면 빈 목록(에러 대신 조용히)
    if (auth.role !== "STUDENT") return NextResponse.json({ serverNow: now.toISOString(), isStaff: false, rows: [] });

    const assigns = await prisma.examAssignment.findMany({ where: { studentId: auth.userId }, select: { examId: true } });
    const assignedIds = assigns.map((a) => a.examId);
    if (!assignedIds.length) return NextResponse.json({ serverNow: now.toISOString(), isStaff: false, rows: [] });

    const exams = await prisma.exam.findMany({
      where: { id: { in: assignedIds }, courseId, status: { in: ["published", "closed"] } },
      orderBy: { createdAt: "desc" },
    });
    const ids = exams.map((e) => e.id);
    await expireOverdueAttempts(ids); // 마감 지난 방치 응시 확정
    const [questions, attempts] = await Promise.all([
      prisma.examQuestion.findMany({ where: { examId: { in: ids } }, select: { examId: true, number: true, type: true, points: true, answerKey: true } }),
      prisma.examAttempt.findMany({ where: { studentId: auth.userId, examId: { in: ids } } }),
    ]);
    const qByExam = new Map<string, { number: number; type: string; points: number; answerKey: string }[]>();
    for (const q of questions) { const arr = qByExam.get(q.examId) ?? []; arr.push(q); qByExam.set(q.examId, arr); }
    const totalByExam = new Map(ids.map((id) => [id, (qByExam.get(id) ?? []).reduce((s, q) => s + q.points, 0)]));
    const atMap = new Map(attempts.map((a) => [a.examId, a]));
    // 종료된 응시 자동채점
    const terminal = attempts.filter((a) => a.status !== "in_progress");
    const ans = terminal.length ? await prisma.examAnswer.findMany({ where: { attemptId: { in: terminal.map((a) => a.id) } }, select: { attemptId: true, questionNo: true, choice: true, textAnswer: true } }) : [];
    const ansByAttempt = new Map<string, { questionNo: number; choice: number | null; textAnswer: string | null }[]>();
    for (const a of ans) { const arr = ansByAttempt.get(a.attemptId) ?? []; arr.push(a); ansByAttempt.set(a.attemptId, arr); }

    return NextResponse.json({
      serverNow: now.toISOString(),
      isStaff: false,
      rows: exams.map((e) => {
        const at = atMap.get(e.id);
        let atStatus = at?.status ?? null;
        if (at && at.status === "in_progress" && now.getTime() > at.deadlineAt.getTime()) atStatus = "expired";
        const graded = at && atStatus !== "in_progress" && atStatus !== null ? gradeExam(qByExam.get(e.id) ?? [], ansByAttempt.get(at.id) ?? []) : null;
        return {
          id: e.id,
          title: e.title,
          subject: e.subject,
          status: e.status,
          durationSec: e.durationSec,
          opensAt: e.opensAt ? e.opensAt.toISOString() : null,
          closesAt: e.closesAt ? e.closesAt.toISOString() : null,
          questionCount: (qByExam.get(e.id) ?? []).length,
          total: totalByExam.get(e.id) ?? 0,
          attempt: at
            ? { status: atStatus, deadlineAt: at.deadlineAt.toISOString(), submittedAt: at.submittedAt ? at.submittedAt.toISOString() : null, score: graded?.score ?? null, total: graded?.total ?? null }
            : null,
        };
      }),
    });
  } catch (error) {
    return jsonError(error);
  }
}
