import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { getCourse } from "@/lib/course/content";
import { isStaffRole } from "@/lib/course/access";
import { isUserEnrolled } from "@/lib/enrollment-store";
import { getLessonFileRef } from "@/lib/lesson-content-store";
import { readUpload } from "@/lib/private-file";

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

/** 강의 콘텐츠 파일(R2 저장) 원본 바이트 — 다운로드/미리보기. 스태프 또는 수강생만. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string; activityId: string }> }) {
  const { courseId, activityId } = await params;
  if (!getCourse(courseId)) return new NextResponse("Not found", { status: 404 });
  const s = await sessionFromReq(request);
  if (!s) return new NextResponse("Unauthorized", { status: 401 });
  if (!isStaffRole(s.role) && !(await isUserEnrolled(courseId, s.userId))) return new NextResponse("Forbidden", { status: 403 });

  const blockId = new URL(request.url).searchParams.get("blockId") ?? "";
  if (!blockId) return new NextResponse("Bad request", { status: 400 });

  const ref = await getLessonFileRef(courseId, activityId, blockId);
  if (!ref) return new NextResponse("Not found", { status: 404 });

  let buffer: Buffer | null = null;
  try {
    buffer = await readUpload({ key: ref.key });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
  if (!buffer) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": ref.mime || "application/octet-stream",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(ref.name)}`,
      "Cache-Control": "private, max-age=60",
    },
  });
}
