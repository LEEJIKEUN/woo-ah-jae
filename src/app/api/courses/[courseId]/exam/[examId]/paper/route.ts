import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { isStaffRole, isFacilitatorOfCourse } from "@/lib/course/access";
import { readPrivateFile } from "@/lib/upload";
import { PDFDocument } from "pdf-lib";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function sessionFromReq(request: NextRequest) {
  try {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

/** 앞 n페이지만(questions) 또는 n페이지 이후(explanation) 로 자른 PDF. */
async function slicePdf(bytes: Buffer, mode: "head" | "tail", n: number): Promise<Buffer> {
  const src = await PDFDocument.load(bytes);
  const total = src.getPageCount();
  const idx = mode === "head" ? range(0, Math.min(n, total)) : range(Math.min(n, total), total);
  if (!idx.length) return bytes;
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, idx);
  pages.forEach((p) => out.addPage(p));
  return Buffer.from(await out.save());
}
const range = (a: number, b: number) => Array.from({ length: Math.max(0, b - a) }, (_, i) => a + i);

/**
 * 시험지 PDF 서빙(inline/다운로드).
 * ?part=questions(문제만·기본) | explanation(빠른정답·해설) | full(전체)
 * - 학생: questions 는 배정+draft아님, explanation 은 종료된 응시(제출/시간종료)에만. full 금지.
 * - 스태프: 전부 허용(퍼실은 담당 강좌).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string; examId: string }> }) {
  const { courseId, examId } = await params;
  const session = await sessionFromReq(request);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam || exam.courseId !== courseId) return new NextResponse("Not found", { status: 404 });

  const url = new URL(request.url);
  const part = (url.searchParams.get("part") || "questions") as "questions" | "explanation" | "full";
  const download = url.searchParams.get("download") === "1";
  const staff = isStaffRole(session.role);

  if (staff) {
    if (session.role === "FACILITATOR" && !(await isFacilitatorOfCourse(courseId, session.userId))) return new NextResponse("Forbidden", { status: 403 });
  } else if (session.role === "STUDENT") {
    if (exam.status === "draft") return new NextResponse("Forbidden", { status: 403 });
    const assigned = await prisma.examAssignment.findUnique({ where: { examId_studentId: { examId, studentId: session.userId } } });
    if (!assigned) return new NextResponse("Forbidden", { status: 403 });
    if (part === "full") return new NextResponse("Forbidden", { status: 403 });
    if (part === "explanation") {
      const attempt = await prisma.examAttempt.findUnique({ where: { examId_studentId: { examId, studentId: session.userId } }, select: { status: true } });
      if (!attempt || attempt.status === "in_progress") return new NextResponse("Forbidden", { status: 403 }); // 종료 후에만 해설
    }
  } else {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // 바이트 결정
  let buffer: Buffer | null = null;
  try {
    if (part === "questions") {
      buffer = await readPrivateFile(exam.studentPaperKey || exam.paperKey);
    } else if (part === "explanation") {
      const full = await readPrivateFile(exam.paperKey);
      buffer = exam.studentPageCount > 0 ? await slicePdf(full, "tail", exam.studentPageCount) : full;
    } else {
      buffer = await readPrivateFile(exam.paperKey); // full
    }
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
  if (!buffer) return new NextResponse("Not found", { status: 404 });

  const label = part === "explanation" ? "해설" : part === "full" ? "전체" : "문제";
  const filename = `${(exam.paperName || exam.title).replace(/\.pdf$/i, "")}_${label}.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "private, no-store",
      "X-Frame-Options": "SAMEORIGIN",
    },
  });
}
