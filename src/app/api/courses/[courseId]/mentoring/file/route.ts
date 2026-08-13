import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { getCourse } from "@/lib/course/content";
import { isStaffRole } from "@/lib/course/access";
import { isUserEnrolled } from "@/lib/enrollment-store";
import { getReportFileData, getMessageFileData } from "@/lib/mentoring-store";
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

/** dataUrl(data:mime;base64,....) → { mime, buffer }. */
function decodeDataUrl(dataUrl: string): { mime: string; buffer: Buffer } | null {
  const comma = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:") || comma < 0) return null;
  const header = dataUrl.slice(5, comma); // 예: "image/png;base64"
  const data = dataUrl.slice(comma + 1);
  const isBase64 = /;base64$/i.test(header);
  const mime = header.replace(/;base64$/i, "") || "application/octet-stream";
  const buffer = isBase64 ? Buffer.from(data, "base64") : Buffer.from(decodeURIComponent(data), "utf8");
  return { mime, buffer };
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

  const decoded = decodeDataUrl(file.dataUrl);
  if (!decoded) return new NextResponse("Not found", { status: 404 });

  const mime = "mime" in file && (file as { mime?: string }).mime ? (file as { mime: string }).mime : decoded.mime;
  return new NextResponse(new Uint8Array(decoded.buffer), {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Cache-Control": "private, max-age=60",
    },
  });
}
