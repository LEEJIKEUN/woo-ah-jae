import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { getCourse } from "@/lib/course/content";
import { canEnterClassroom, isStaffRole } from "@/lib/course/access";
import { prisma } from "@/lib/prisma";

const MAX_SUMMARY = 4000;

async function sessionFromReq(request: NextRequest) {
  try {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

// 강좌 소개 조회 — 강의실 접근자 누구나. 미저장 시 시드 소개.
export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const course = getCourse(courseId);
  if (!course) return NextResponse.json({ error: "강좌를 찾을 수 없습니다." }, { status: 404 });
  const s = await sessionFromReq(request);
  if (!s) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!(await canEnterClassroom(courseId, s))) return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });

  const row = await prisma.courseSummary.findUnique({ where: { courseId }, select: { body: true } });
  return NextResponse.json({ body: row?.body ?? course.summary });
}

// 강좌 소개 수정 — 관리자·퍼실리테이터만
export async function PUT(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  if (!getCourse(courseId)) return NextResponse.json({ error: "강좌를 찾을 수 없습니다." }, { status: 404 });
  const s = await sessionFromReq(request);
  if (!s) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!isStaffRole(s.role)) return NextResponse.json({ error: "관리자·퍼실리테이터만 수정할 수 있습니다." }, { status: 403 });

  const raw = (await request.json().catch(() => null)) as { body?: unknown } | null;
  const body = String(typeof raw?.body === "string" ? raw.body : "").slice(0, MAX_SUMMARY);
  const saved = await prisma.courseSummary.upsert({
    where: { courseId },
    create: { courseId, body },
    update: { body },
  });
  return NextResponse.json({ ok: true, body: saved.body });
}
