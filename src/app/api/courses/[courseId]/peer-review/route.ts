import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { getCourse } from "@/lib/course/content";
import { isStaffRole } from "@/lib/course/access";
import { getEnrolledUserIds } from "@/lib/enrollment-store";
import { distributePeerReview, loadRoom } from "@/lib/mentoring-store";
import { publishMentoring } from "@/lib/mentoring-bus";
import { createNotifications } from "@/lib/notification-store";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** 배정 현황 — 관리자·퍼실만. ?column=N 의 과제(N번째 제출물) 기준 누가 누구 것을 받았는지. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  if (!getCourse(courseId)) return NextResponse.json({ error: "강좌를 찾을 수 없습니다." }, { status: 404 });
  const s = await sessionFromReq(request);
  if (!s) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!isStaffRole(s.role)) return NextResponse.json({ error: "관리자·퍼실리테이터만 볼 수 있습니다." }, { status: 403 });

  const column = Math.max(0, Math.min(4, Number(new URL(request.url).searchParams.get("column") ?? "0") || 0));
  const ids = await getEnrolledUserIds(courseId);
  const users = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true, studentProfile: { select: { realName: true } } } }) : [];
  const nameOf = new Map(users.map((u) => [u.id, u.studentProfile?.realName || u.email]));

  const asgs = await prisma.mentoringAssignment.findMany({ where: { courseId, studentId: { in: ids } }, orderBy: { createdAt: "asc" }, select: { id: true, studentId: true, name: true } });
  const byStudent = new Map<string, { id: string; name: string }[]>();
  for (const a of asgs) byStudent.set(a.studentId, [...(byStudent.get(a.studentId) ?? []), { id: a.id, name: a.name }]);
  const colAsg = new Map<string, { author: string; fileName: string }>();
  for (const [sid, list] of byStudent) {
    const a = list[column];
    if (a) colAsg.set(a.id, { author: sid, fileName: a.name });
  }

  const pr = colAsg.size ? await prisma.mentoringPeerReview.findMany({ where: { courseId, assignmentId: { in: [...colAsg.keys()] } }, orderBy: { createdAt: "asc" } }) : [];
  const grouped = new Map<string, { authorName: string; fileName: string; assignmentId: string }[]>();
  for (const r of pr) {
    const info = colAsg.get(r.assignmentId);
    if (!info) continue;
    grouped.set(r.recipientStudentId, [...(grouped.get(r.recipientStudentId) ?? []), { authorName: nameOf.get(info.author) ?? "학생", fileName: info.fileName, assignmentId: r.assignmentId }]);
  }
  const rows = [...grouped.entries()]
    .map(([rid, items]) => ({ recipientId: rid, recipientName: nameOf.get(rid) ?? "학생", items }))
    .sort((a, b) => a.recipientName.localeCompare(b.recipientName, "ko"));
  return NextResponse.json({ rows });
}

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

  // 알림: 배정받은 학생들에게
  if (result.assigned > 0) {
    await createNotifications(studentIds.map((uid) => ({ userId: uid, kind: "peer", title: "상호 피드백 과제가 배정되었어요", body: "탐구활동 멘토링의 탐구 보고서 아래에서 확인하세요.", href: `/course/${courseId}/mentoring` })));
  }

  if (result.assigned === 0) return NextResponse.json({ ok: true, ...result, warn: "이 과제를 제출한 학생이 2명 이상이어야 배포할 수 있습니다. (제출한 학생만 배부·수신에 참여)" });
  return NextResponse.json({ ok: true, ...result });
}
