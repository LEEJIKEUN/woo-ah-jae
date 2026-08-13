import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { getCourse } from "@/lib/course/content";
import { isUserEnrolled } from "@/lib/enrollment-store";
import { r2Enabled } from "@/lib/private-file";
import { presignPutUrl } from "@/lib/r2";

export const dynamic = "force-dynamic";

const MAX_ASSIGNMENT_BYTES = 2 * 1024 * 1024 * 1024; // 2GB (10분 줌 녹화 넉넉)

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
  return (name || "file").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
}
function isAllowed(mime: string, name: string) {
  const lower = name.toLowerCase();
  return mime === "application/pdf" || lower.endsWith(".pdf") || mime.startsWith("video/");
}

/** 학생 본인이 과제 파일(PDF·동영상)을 R2 로 직접 올리도록 서명 URL 발급. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  if (!getCourse(courseId)) return NextResponse.json({ error: "강좌를 찾을 수 없습니다." }, { status: 404 });
  const s = await sessionFromReq(request);
  if (!s) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (s.role !== "STUDENT" || !(await isUserEnrolled(courseId, s.userId))) {
    return NextResponse.json({ error: "수강생 본인만 과제를 업로드할 수 있습니다." }, { status: 403 });
  }
  if (!r2Enabled()) return NextResponse.json({ error: "과제 업로드는 R2 저장소가 켜져 있어야 합니다." }, { status: 400 });

  const body = (await request.json().catch(() => null)) as { name?: unknown; contentType?: unknown; size?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name : "assignment";
  const contentType = typeof body?.contentType === "string" ? body.contentType : "";
  const size = typeof body?.size === "number" ? body.size : 0;

  if (!isAllowed(contentType, name)) return NextResponse.json({ error: "PDF 또는 동영상 파일만 업로드할 수 있습니다." }, { status: 400 });
  if (size <= 0 || size > MAX_ASSIGNMENT_BYTES) return NextResponse.json({ error: "파일 용량이 올바르지 않습니다. (최대 2GB)" }, { status: 413 });

  const key = `mentoring/${courseId}/${s.userId}/assignment/${Date.now()}-${crypto.randomUUID()}-${safeName(name)}`;
  const url = await presignPutUrl(key, contentType || "application/octet-stream", 3600);
  return NextResponse.json({ url, key });
}
