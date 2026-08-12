import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { getCourse } from "@/lib/course/content";
import { canEnterClassroom, isStaffRole } from "@/lib/course/access";
import { prisma } from "@/lib/prisma";

const DEFAULT_GUIDE =
  "탐구의 동기 → 과정 → 결과를 인과적으로 연결하고, 사용한 개념·이론과 그것을 적용한 방법을 구체적으로 서술하세요. 수치·데이터로 성과를 제시하고, 배운 점과 진로·후속 탐구로의 확장을 담으면 좋습니다.";
const MAX_GUIDE = 5000;

async function sessionFromReq(request: NextRequest) {
  try {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

// 가이드 조회 — 강의실 접근자 누구나
export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  if (!getCourse(courseId)) return NextResponse.json({ error: "강좌를 찾을 수 없습니다." }, { status: 404 });
  const s = await sessionFromReq(request);
  if (!s) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!(await canEnterClassroom(courseId, s))) return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });

  const g = await prisma.courseGuide.findUnique({ where: { courseId }, select: { body: true } });
  return NextResponse.json({ body: g?.body ?? DEFAULT_GUIDE });
}

// 가이드 수정 — 관리자·퍼실리테이터만
export async function PUT(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  if (!getCourse(courseId)) return NextResponse.json({ error: "강좌를 찾을 수 없습니다." }, { status: 404 });
  const s = await sessionFromReq(request);
  if (!s) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!isStaffRole(s.role)) return NextResponse.json({ error: "관리자·퍼실리테이터만 수정할 수 있습니다." }, { status: 403 });

  const raw = (await request.json().catch(() => null)) as { body?: unknown } | null;
  const body = String(typeof raw?.body === "string" ? raw.body : "").slice(0, MAX_GUIDE);
  const saved = await prisma.courseGuide.upsert({
    where: { courseId },
    create: { courseId, body },
    update: { body },
  });
  return NextResponse.json({ ok: true, body: saved.body });
}
