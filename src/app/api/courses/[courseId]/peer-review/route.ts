import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { getCourse } from "@/lib/course/content";
import { isStaffRole } from "@/lib/course/access";
import { getEnrolledUserIds } from "@/lib/enrollment-store";
import { distributePeerReview, loadRoom } from "@/lib/mentoring-store";
import { publishMentoring } from "@/lib/mentoring-bus";

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

/** 상호 피드백 배포 — 관리자·퍼실만. 선택 학생들의 column 번째 과제를 랜덤 배정. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  if (!getCourse(courseId)) return NextResponse.json({ error: "강좌를 찾을 수 없습니다." }, { status: 404 });
  const s = await sessionFromReq(request);
  if (!s) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!isStaffRole(s.role)) return NextResponse.json({ error: "관리자·퍼실리테이터만 배포할 수 있습니다." }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { column?: unknown; studentIds?: unknown; count?: unknown } | null;
  const column = typeof body?.column === "number" ? body.column : -1;
  const count = typeof body?.count === "number" ? body.count : 0;
  const requested = Array.isArray(body?.studentIds) ? body!.studentIds.filter((x): x is string => typeof x === "string") : [];

  if (column < 0 || column > 4) return NextResponse.json({ error: "과제 번호가 올바르지 않습니다." }, { status: 400 });
  if (count < 1 || count > 5) return NextResponse.json({ error: "무작위 개수는 1~5개여야 합니다." }, { status: 400 });
  if (requested.length < 2) return NextResponse.json({ error: "학생을 2명 이상 선택해 주세요." }, { status: 400 });

  const enrolled = new Set(await getEnrolledUserIds(courseId));
  const studentIds = requested.filter((id) => enrolled.has(id));
  if (studentIds.length < 2) return NextResponse.json({ error: "유효한 수강생이 2명 이상이어야 합니다." }, { status: 400 });

  const result = await distributePeerReview(courseId, column, studentIds, count);

  // 각 학생 방 실시간 갱신(멘토링 페이지에 즉시 반영)
  for (const sid of studentIds) {
    try {
      publishMentoring(courseId, sid, await loadRoom(courseId, sid));
    } catch {
      /* 무시 */
    }
  }

  if (result.assigned === 0) return NextResponse.json({ ok: true, ...result, warn: "이 과제를 제출한 학생이 2명 이상이어야 배포할 수 있습니다. (제출한 학생만 배부·수신에 참여)" });
  return NextResponse.json({ ok: true, ...result });
}
