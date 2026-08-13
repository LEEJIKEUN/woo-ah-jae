import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { getCourse } from "@/lib/course/content";
import { isStaffRole } from "@/lib/course/access";
import { isUserEnrolled } from "@/lib/enrollment-store";
import { getReportFileData, getMessageFileData } from "@/lib/mentoring-store";
import { readUpload } from "@/lib/private-file";
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

/** 멘토링 파일(보고서 PDF / 채팅 첨부) 원본 바이트 — 이미지 미리보기 <img> + 다운로드용. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  if (!getCourse(courseId)) return new NextResponse("Not found", { status: 404 });
  const session = await sessionFromReq(request);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const staff = isStaffRole(session.role);
  const enrolledStudent = !staff && session.role === "STUDENT" && (await isUserEnrolled(courseId, session.userId));
  const isParent = !staff && !enrolledStudent && session.role === "PARENT";
  if (!staff && !enrolledStudent && !isParent) return new NextResponse("Forbidden", { status: 403 });

  const url = new URL(request.url);
  const requestedStudent = url.searchParams.get("studentId") ?? "";
  const id = url.searchParams.get("id") ?? "";

  // 방 주인 결정
  let studentId = "";
  if (enrolledStudent) {
    studentId = session.userId;
  } else {
    if (!requestedStudent || !(await isUserEnrolled(courseId, requestedStudent))) return new NextResponse("Bad request", { status: 400 });
    if (staff) {
      studentId = requestedStudent;
    } else {
      const link = await prisma.parentChildLink.findFirst({ where: { parentUserId: session.userId, childUserId: requestedStudent, status: "APPROVED" }, select: { id: true } });
      if (!link) return new NextResponse("Forbidden", { status: 403 });
      studentId = requestedStudent;
    }
  }

  const file = id === "report" ? await getReportFileData(courseId, studentId) : await getMessageFileData(id);
  if (!file) return new NextResponse("Not found", { status: 404 });
  // 채팅 파일은 방 소유 검증 — getMessageFileData 는 방을 확인하지 않으므로 여기서 재확인
  if (id !== "report") {
    const m = await prisma.mentoringMessage.findUnique({ where: { id }, select: { courseId: true, studentId: true } });
    if (!m || m.courseId !== courseId || m.studentId !== studentId) return new NextResponse("Forbidden", { status: 403 });
  }

  let buffer: Buffer | null = null;
  try {
    buffer = await readUpload({ key: file.key, data: file.data });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
  if (!buffer) return new NextResponse("Not found", { status: 404 });

  // 기본은 inline(새 탭에서 보기), ?download=1 이면 첨부 다운로드
  const download = new URL(request.url).searchParams.get("download") === "1";
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": file.mime || "application/octet-stream",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Cache-Control": "private, max-age=60",
    },
  });
}
