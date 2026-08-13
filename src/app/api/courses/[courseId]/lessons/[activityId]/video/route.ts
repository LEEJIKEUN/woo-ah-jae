import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { getCourse } from "@/lib/course/content";
import { isStaffRole } from "@/lib/course/access";
import { isUserEnrolled } from "@/lib/enrollment-store";
import { getLessonVideoKey } from "@/lib/lesson-content-store";
import { presignGetUrl } from "@/lib/r2";

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
 * 강의 동영상 재생 — 접근권한(스태프 또는 수강생) 확인 후 R2 서명 URL 로 302 리다이렉트.
 * <video src="이 라우트"> 로 쓰면 브라우저가 R2 에서 직접(Range 지원) 스트리밍 → 앱 서버 부하 없음.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string; activityId: string }> }) {
  const { courseId, activityId } = await params;
  if (!getCourse(courseId)) return new NextResponse("Not found", { status: 404 });
  const s = await sessionFromReq(request);
  if (!s) return new NextResponse("Unauthorized", { status: 401 });
  if (!isStaffRole(s.role) && !(await isUserEnrolled(courseId, s.userId))) return new NextResponse("Forbidden", { status: 403 });

  const blockId = new URL(request.url).searchParams.get("blockId") ?? "";
  if (!blockId) return new NextResponse("Bad request", { status: 400 });

  const key = await getLessonVideoKey(courseId, activityId, blockId);
  if (!key) return new NextResponse("Not found", { status: 404 });

  // 짧은 만료(2시간) — 서명 URL 이 새어나가도 유효기간이 짧다. 재생 중엔 라우트가 재서명(302).
  const signed = await presignGetUrl(key, 2 * 3600);
  return NextResponse.redirect(signed, { status: 302, headers: { "Cache-Control": "private, no-store" } });
}
