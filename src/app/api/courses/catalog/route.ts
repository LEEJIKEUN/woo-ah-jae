import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { COURSES, courseFirstClassMs, dateStrToKstMs } from "@/lib/course/content";
import { getAllCourseMeta, autoAdvanceStatus, enrollmentCloseMs, type CourseStatus } from "@/lib/course/meta-store";
import { listDbCourses } from "@/lib/course/db-course";

export const dynamic = "force-dynamic";

// 홈 목록 전용 필드(강좌 콘텐츠에 없는 필터용 값). courseId 별 기본값.
const LIST_BASE: Record<string, { format: string; mode: string; from: string; to: string }> = {
  "ai-linalg": { format: "실시간수업", mode: "온라인", from: "2026-08-17", to: "2026-11-04" },
};

export async function GET(request: NextRequest) {
  let isAdmin = false;
  try {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (token) {
      const s = await verifySessionToken(token);
      isAdmin = s.role === "ADMIN";
    }
  } catch {
    /* 비로그인 → isAdmin=false */
  }

  const metaMap = await getAllCourseMeta();
  const hardRows = COURSES.map((c) => {
    const m = metaMap.get(c.id) ?? null;
    const base = LIST_BASE[c.id] ?? { format: c.format ?? "실시간수업", mode: c.deliveryMode ?? "온라인", from: "", to: "" };
    return {
      id: c.id,
      name: m?.title ?? c.title,
      target: m?.audience ?? c.audience ?? "고등학생",
      format: m?.format ?? base.format,
      mode: m?.deliveryMode ?? base.mode,
      from: base.from,
      to: base.to,
      periodLabel: m?.periodLabel ?? c.periodLabel ?? "",
      country: m?.country ?? c.country ?? "한국",
      capacity: m?.capacity ?? 20,
      deadline: m?.deadline ?? null,
      status: autoAdvanceStatus((m?.status ?? c.defaultStatus ?? "open") as CourseStatus, courseFirstClassMs(c), enrollmentCloseMs(m?.deadline)),
      href: `/course/${c.id}`,
    };
  });

  // DB 강좌(관리자가 새로 개설)
  const dbRows = (await listDbCourses()).map((c) => ({
    id: c.slug,
    name: c.title,
    target: c.audience,
    format: c.format,
    mode: c.deliveryMode,
    from: c.fromDate,
    to: c.toDate,
    periodLabel: c.periodLabel,
    country: c.country,
    capacity: c.capacity,
    deadline: c.deadline,
    status: autoAdvanceStatus(c.status as CourseStatus, dateStrToKstMs(c.fromDate), enrollmentCloseMs(c.deadline)),
    href: `/course/${c.slug}`,
  }));

  const rows = [...hardRows, ...dbRows].filter((r) => isAdmin || r.status !== "private");
  return NextResponse.json({ isAdmin, rows });
}
