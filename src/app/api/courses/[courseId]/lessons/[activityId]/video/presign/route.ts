import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { getCourse } from "@/lib/course/content";
import { isStaffRole } from "@/lib/course/access";
import { r2Enabled } from "@/lib/private-file";
import { presignPutUrl } from "@/lib/r2";

export const dynamic = "force-dynamic";

const MAX_VIDEO_BYTES = 5 * 1024 * 1024 * 1024; // 단일 PUT 상한 5GB (90분 강의는 충분)

async function sessionFromReq(request: NextRequest) {
  try {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

function safeName(name: string) {
  return (name || "video").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

/** 관리자·퍼실이 강의 동영상을 브라우저에서 R2 로 직접 올리도록 서명된 업로드 URL 발급. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ courseId: string; activityId: string }> }) {
  const { courseId, activityId } = await params;
  if (!getCourse(courseId)) return NextResponse.json({ error: "강좌를 찾을 수 없습니다." }, { status: 404 });
  const s = await sessionFromReq(request);
  if (!s) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!isStaffRole(s.role)) return NextResponse.json({ error: "관리자·퍼실리테이터만 업로드할 수 있습니다." }, { status: 403 });
  if (!r2Enabled()) return NextResponse.json({ error: "영상 업로드는 R2 저장소가 켜져 있어야 합니다." }, { status: 400 });

  const body = (await request.json().catch(() => null)) as { name?: unknown; contentType?: unknown; size?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name : "video.mp4";
  const contentType = typeof body?.contentType === "string" ? body.contentType : "";
  const size = typeof body?.size === "number" ? body.size : 0;

  if (!contentType.startsWith("video/")) return NextResponse.json({ error: "동영상 파일만 업로드할 수 있습니다." }, { status: 400 });
  if (size <= 0 || size > MAX_VIDEO_BYTES) return NextResponse.json({ error: "영상 용량이 올바르지 않습니다. (최대 5GB)" }, { status: 413 });

  const key = `lesson/${courseId}/${activityId}/video/${Date.now()}-${crypto.randomUUID()}-${safeName(name)}`;
  const url = await presignPutUrl(key, contentType, 3600);
  return NextResponse.json({ url, key });
}
