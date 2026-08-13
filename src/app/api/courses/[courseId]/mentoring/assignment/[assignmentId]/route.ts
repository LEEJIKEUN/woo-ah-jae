import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { getCourse } from "@/lib/course/content";
import { isStaffRole } from "@/lib/course/access";
import { getAssignment } from "@/lib/mentoring-store";
import { presignGetUrl } from "@/lib/r2";
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

/** 과제 파일 보기/다운로드 — 스태프·본인·승인된 학부모만. R2 서명 URL 로 302(동영상 스트리밍/PDF 보기). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string; assignmentId: string }> }) {
  const { courseId, assignmentId } = await params;
  if (!getCourse(courseId)) return new NextResponse("Not found", { status: 404 });
  const s = await sessionFromReq(request);
  if (!s) return new NextResponse("Unauthorized", { status: 401 });

  const a = await getAssignment(assignmentId);
  if (!a || a.courseId !== courseId) return new NextResponse("Not found", { status: 404 });

  const staff = isStaffRole(s.role);
  const isOwner = s.userId === a.studentId;
  let allowed = staff || isOwner;
  if (!allowed && s.role === "PARENT") {
    const link = await prisma.parentChildLink.findFirst({ where: { parentUserId: s.userId, childUserId: a.studentId, status: "APPROVED" }, select: { id: true } });
    allowed = !!link;
  }
  if (!allowed) return new NextResponse("Forbidden", { status: 403 });

  const download = new URL(request.url).searchParams.get("download") === "1";
  const signed = await presignGetUrl(a.fileKey, 2 * 3600, download ? a.name : undefined);
  return NextResponse.redirect(signed, { status: 302, headers: { "Cache-Control": "private, no-store" } });
}
