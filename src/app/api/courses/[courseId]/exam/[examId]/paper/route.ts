import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { isStaffRole, isFacilitatorOfCourse } from "@/lib/course/access";
import { readPrivateFile } from "@/lib/upload";
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

/**
 * 시험지 PDF 원본 — 새 탭에서 inline 표시.
 * 프라이빗(R2/로컬)에서만 서빙하고, 요청마다 접근권한을 확인한다(공개 URL 미노출).
 * - 스태프: 해당 강좌(퍼실은 담당 강좌) 시험지
 * - 학생: 본인에게 배정 + draft 아님
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string; examId: string }> }) {
  const { courseId, examId } = await params;
  const session = await sessionFromReq(request);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam || exam.courseId !== courseId) return new NextResponse("Not found", { status: 404 });

  const staff = isStaffRole(session.role);
  // 학생은 문제 페이지만 자른 studentPaperKey, 스태프는 전체 paperKey
  let key = exam.paperKey;
  if (staff) {
    if (session.role === "FACILITATOR" && !(await isFacilitatorOfCourse(courseId, session.userId))) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  } else if (session.role === "STUDENT") {
    if (exam.status === "draft") return new NextResponse("Forbidden", { status: 403 });
    const assigned = await prisma.examAssignment.findUnique({ where: { examId_studentId: { examId, studentId: session.userId } } });
    if (!assigned) return new NextResponse("Forbidden", { status: 403 });
    key = exam.studentPaperKey || exam.paperKey; // 학생용이 있으면 그것(빠른정답·해설 제거본)
  } else {
    return new NextResponse("Forbidden", { status: 403 });
  }

  let buffer: Buffer | null = null;
  try {
    buffer = await readPrivateFile(key);
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
  if (!buffer) return new NextResponse("Not found", { status: 404 });

  const filename = exam.paperName || `${exam.title}.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "private, no-store",
      "X-Frame-Options": "SAMEORIGIN", // 같은 화면 iframe 뷰어 허용
    },
  });
}
