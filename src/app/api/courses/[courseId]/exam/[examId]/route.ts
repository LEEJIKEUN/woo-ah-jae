import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { isStaffRole, isFacilitatorOfCourse } from "@/lib/course/access";
import { getEnrolledUserIds } from "@/lib/enrollment-store";
import { createNotifications } from "@/lib/notification-store";
import { savePrivateFile, validateUpload, readPrivateFile } from "@/lib/upload";
import { deletePrivateKey } from "@/lib/private-file";
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

async function requireExamStaff(request: NextRequest, courseId: string, examId: string) {
  const auth = await getAuthFromRequest(request);
  if (!isStaffRole(auth.role)) return { error: NextResponse.json({ error: "권한이 없습니다." }, { status: 403 }) };
  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam || exam.courseId !== courseId) return { error: NextResponse.json({ error: "시험을 찾을 수 없습니다." }, { status: 404 }) };
  if (auth.role === "FACILITATOR" && !(await isFacilitatorOfCourse(courseId, auth.userId))) return { error: NextResponse.json({ error: "담당 강좌가 아닙니다." }, { status: 403 }) };
  return { auth, exam };
}

/** 시험 상세(수정 폼 프리필용, 스태프). 정답·배정 학생 포함. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string; examId: string }> }) {
  try {
    const { courseId, examId } = await params;
    const g = await requireExamStaff(request, courseId, examId);
    if (g.error) return g.error;
    const exam = g.exam;

    const [questions, assigns] = await Promise.all([
      prisma.examQuestion.findMany({ where: { examId }, orderBy: { number: "asc" }, select: { type: true, choiceCount: true, points: true, answerKey: true } }),
      prisma.examAssignment.findMany({ where: { examId }, select: { studentId: true } }),
    ]);
    const toKstLocal = (d: Date) => new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 16); // YYYY-MM-DDThh:mm(KST)

    return NextResponse.json({
      title: exam.title,
      subject: exam.subject,
      durationMin: Math.round(exam.durationSec / 60),
      opensAt: exam.opensAt ? toKstLocal(exam.opensAt) : "",
      closesAt: exam.closesAt ? toKstLocal(exam.closesAt) : "",
      status: exam.status,
      studentPageCount: exam.studentPageCount,
      paperName: exam.paperName,
      questions,
      studentIds: assigns.map((a) => a.studentId),
    });
  } catch (error) {
    return jsonError(error);
  }
}

/** 시험 수정(스태프). PDF 는 새로 올릴 때만 교체. 문항·배정 학생은 교체. 발송(published) 시 재알림. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ courseId: string; examId: string }> }) {
  try {
    const { courseId, examId } = await params;
    const g = await requireExamStaff(request, courseId, examId);
    if (g.error) return g.error;
    const exam = g.exam;
    const auth = g.auth;

    const form = await request.formData();
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
    const requested = Array.isArray(payload.studentIds) ? (payload.studentIds as unknown[]).map(String) : [];
    const enrolled = new Set(await getEnrolledUserIds(courseId));
    const studentIds = [...new Set(requested.filter((id) => enrolled.has(id)))];
    const spc = typeof payload.studentPageCount === "number" ? Math.trunc(payload.studentPageCount) : Number(payload.studentPageCount);

    // PDF 처리
    const oldKeys: string[] = [];
    const paperUpdate: Record<string, unknown> = {};
    const paper = form.get("paper");
    if (paper instanceof File && paper.size > 0) {
      if (paper.type !== "application/pdf") return NextResponse.json({ error: "시험지는 PDF 파일만 업로드할 수 있습니다." }, { status: 400 });
      try { validateUpload(paper); } catch { return NextResponse.json({ error: "PDF는 10MB 이하만 업로드할 수 있습니다." }, { status: 400 }); }
      const fullBytes = Buffer.from(await paper.arrayBuffer());
      const paperKey = await savePrivateFile(paper);
      let studentPaperKey = "";
      if (Number.isFinite(spc) && spc > 0) {
        try { const t = await trimPdfToPages(fullBytes, spc); if (t) studentPaperKey = await savePrivateFile(new File([new Uint8Array(t)], `student_${paper.name}`, { type: "application/pdf" })); } catch { /* 폴백 */ }
      }
      paperUpdate.paperKey = paperKey;
      paperUpdate.studentPaperKey = studentPaperKey;
      paperUpdate.studentPageCount = studentPaperKey ? spc : 0;
      paperUpdate.paperName = paper.name.slice(0, 200);
      paperUpdate.paperSize = paper.size;
      oldKeys.push(exam.paperKey);
      if (exam.studentPaperKey) oldKeys.push(exam.studentPaperKey);
    } else if (Number.isFinite(spc) && spc > 0 && spc !== exam.studentPageCount) {
      // 새 PDF 없이 학생용 페이지 수만 바뀜 → 기존 원본에서 다시 자름
      try {
        const full = await readPrivateFile(exam.paperKey);
        const t = await trimPdfToPages(full, spc);
        if (t) {
          const key = await savePrivateFile(new File([new Uint8Array(t)], `student_${exam.paperName || "exam.pdf"}`, { type: "application/pdf" }));
          paperUpdate.studentPaperKey = key;
          paperUpdate.studentPageCount = spc;
          if (exam.studentPaperKey) oldKeys.push(exam.studentPaperKey);
        }
      } catch { /* 유지 */ }
    }

    await prisma.$transaction([
      prisma.exam.update({ where: { id: examId }, data: { title, subject: String(payload.subject ?? "").trim().slice(0, 120), durationSec: Math.round(durationMin * 60), opensAt, closesAt, status, ...paperUpdate } }),
      prisma.examQuestion.deleteMany({ where: { examId } }),
      prisma.examQuestion.createMany({ data: questions.map((q, i) => ({ examId, number: i + 1, type: q.type, choiceCount: q.choiceCount, points: q.points, answerKey: q.answerKey })) }),
      prisma.examAssignment.deleteMany({ where: { examId } }),
      ...(studentIds.length ? [prisma.examAssignment.createMany({ data: studentIds.map((sid) => ({ examId, studentId: sid })), skipDuplicates: true })] : []),
    ]);

    // 교체된 옛 PDF 삭제(best-effort)
    for (const k of oldKeys) await deletePrivateKey(k);

    // 발송 상태면 배정 학생에게 재알림(best-effort)
    if (status === "published" && studentIds.length) {
      await createNotifications(studentIds.map((sid) => ({ userId: sid, kind: "notice", title: `시험 안내 · ${title}`, body: `제한시간 ${durationMin}분 · ${questions.length}문항`, href: `/course/${courseId}/exam` })));
    }

    return NextResponse.json({ ok: true, id: examId });
  } catch (error) {
    return jsonError(error);
  }
}

/** 시험 완전 삭제(스태프) — 문항·배정·응시·답안 + R2 PDF 까지 모두 제거(찌꺼기 없음). */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ courseId: string; examId: string }> }) {
  try {
    const { courseId, examId } = await params;
    const g = await requireExamStaff(request, courseId, examId);
    if (g.error) return g.error;
    const exam = g.exam;

    const attempts = await prisma.examAttempt.findMany({ where: { examId }, select: { id: true } });
    const attemptIds = attempts.map((a) => a.id);

    await prisma.$transaction([
      ...(attemptIds.length ? [prisma.examAnswer.deleteMany({ where: { attemptId: { in: attemptIds } } })] : []),
      prisma.examAttempt.deleteMany({ where: { examId } }),
      prisma.examAssignment.deleteMany({ where: { examId } }),
      prisma.examQuestion.deleteMany({ where: { examId } }),
      prisma.exam.delete({ where: { id: examId } }),
    ]);

    await deletePrivateKey(exam.paperKey);
    if (exam.studentPaperKey) await deletePrivateKey(exam.studentPaperKey);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
