import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { getCourse } from "@/lib/course/content";
import { isStaffRole } from "@/lib/course/access";
import { isUserEnrolled } from "@/lib/enrollment-store";
import { getBlocks, setBlocks, type Block } from "@/lib/lesson-content-store";

const MAX_BYTES = 8 * 1024 * 1024; // 저장 페이로드 상한(파일 포함)
const VALID_TYPES = new Set(["heading", "text", "file", "link", "divider"]);

async function sessionFromReq(request: NextRequest) {
  try {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

// 조회 — 로그인 + (스태프 or 수강신청)
export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string; activityId: string }> }) {
  const { courseId, activityId } = await params;
  if (!getCourse(courseId)) return NextResponse.json({ error: "강좌를 찾을 수 없습니다." }, { status: 404 });
  const s = await sessionFromReq(request);
  if (!s) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!isStaffRole(s.role) && !(await isUserEnrolled(courseId, s.userId))) {
    return NextResponse.json({ error: "수강신청이 필요합니다." }, { status: 403 });
  }
  const blocks = await getBlocks(courseId, activityId);
  return NextResponse.json({ blocks });
}

// 편집 저장 — 관리자·퍼실리테이터
export async function PUT(request: NextRequest, { params }: { params: Promise<{ courseId: string; activityId: string }> }) {
  const { courseId, activityId } = await params;
  if (!getCourse(courseId)) return NextResponse.json({ error: "강좌를 찾을 수 없습니다." }, { status: 404 });
  const s = await sessionFromReq(request);
  if (!s) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!isStaffRole(s.role)) return NextResponse.json({ error: "관리자·퍼실리테이터만 편집할 수 있습니다." }, { status: 403 });

  const body = (await request.json()) as { blocks?: Block[] };
  if (!Array.isArray(body.blocks)) return NextResponse.json({ error: "Invalid blocks" }, { status: 400 });
  const blocks = body.blocks.filter((b) => b && typeof b.type === "string" && VALID_TYPES.has(b.type));
  if (JSON.stringify(blocks).length > MAX_BYTES) {
    return NextResponse.json({ error: "콘텐츠 용량이 너무 큽니다. (파일은 최대 6MB, 전체 8MB)" }, { status: 413 });
  }

  const saved = await setBlocks(courseId, activityId, blocks);
  return NextResponse.json({ ok: true, blocks: saved });
}
