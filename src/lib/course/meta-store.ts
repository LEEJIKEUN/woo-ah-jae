import { prisma } from "@/lib/prisma";

export type CourseStatus = "private" | "prep" | "open" | "full" | "ongoing";
export const STATUS_ORDER: CourseStatus[] = ["private", "prep", "open", "full", "ongoing"];
export const STATUS_LABEL: Record<CourseStatus, string> = {
  private: "비공개",
  prep: "오픈 준비중",
  open: "접수중",
  full: "마감",
  ongoing: "진행중",
};

export type CourseMetaOverride = {
  programme: string | null;
  title: string | null;
  subtitle: string | null;
  audience: string | null;
  format: string | null;
  deliveryMode: string | null;
  classDays: string | null;
  periodLabel: string | null;
  country: string | null;
  summary: string | null;
  realtimeInfo: string | null;
  capacity: number | null;
  deadline: string | null; // ISO
  status: CourseStatus;
};

function normStatus(v: string | null | undefined): CourseStatus {
  return (STATUS_ORDER as string[]).includes(v ?? "") ? (v as CourseStatus) : "open";
}

type MetaRow = {
  courseId: string;
  programme: string | null;
  title: string | null;
  subtitle: string | null;
  audience: string | null;
  format: string | null;
  deliveryMode: string | null;
  classDays: string | null;
  periodLabel: string | null;
  country: string | null;
  summary: string | null;
  realtimeInfo: string | null;
  capacity: number | null;
  deadline: Date | null;
  status: string;
};

function toOverride(r: MetaRow): CourseMetaOverride {
  return {
    programme: r.programme,
    title: r.title,
    subtitle: r.subtitle,
    audience: r.audience,
    format: r.format,
    deliveryMode: r.deliveryMode,
    classDays: r.classDays,
    periodLabel: r.periodLabel,
    country: r.country,
    summary: r.summary,
    realtimeInfo: r.realtimeInfo,
    capacity: r.capacity,
    deadline: r.deadline ? r.deadline.toISOString() : null,
    status: normStatus(r.status),
  };
}

/**
 * 신청 마감 여부 — 마감일(날짜)의 23:59:59(KST) 이후면 true.
 * deadline 은 날짜(UTC 자정)로 저장되므로 그 날짜의 KST 하루 끝을 기준으로 판단.
 */
export function isEnrollmentClosed(deadlineISO: string | null | undefined): boolean {
  if (!deadlineISO) return false;
  const d = new Date(deadlineISO);
  if (Number.isNaN(d.getTime())) return false;
  const p = (n: number) => String(n).padStart(2, "0");
  const cutoff = new Date(`${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T23:59:59+09:00`);
  return Date.now() > cutoff.getTime();
}

/** 강좌 마감일(ISO) — 하드코딩=CourseMeta, DB강좌=CourseDb. 없으면 null. */
export async function getCourseDeadline(courseId: string): Promise<string | null> {
  const meta = await prisma.courseMeta.findUnique({ where: { courseId }, select: { deadline: true } });
  if (meta?.deadline) return meta.deadline.toISOString();
  const db = await prisma.courseDb.findUnique({ where: { slug: courseId }, select: { deadline: true } });
  return db?.deadline ? db.deadline.toISOString() : null;
}

/** 특정 강좌 메타(없으면 null → 하드코딩 기본값 사용, 상태는 기본 open). */
export async function getCourseMeta(courseId: string): Promise<CourseMetaOverride | null> {
  const r = await prisma.courseMeta.findUnique({ where: { courseId } });
  return r ? toOverride(r) : null;
}

/** 전체 강좌 메타 맵. */
export async function getAllCourseMeta(): Promise<Map<string, CourseMetaOverride>> {
  const rows = await prisma.courseMeta.findMany();
  return new Map(rows.map((r) => [r.courseId, toOverride(r)]));
}

export type CourseMetaPatch = Partial<{
  programme: string | null;
  title: string | null;
  subtitle: string | null;
  audience: string | null;
  format: string | null;
  deliveryMode: string | null;
  classDays: string | null;
  periodLabel: string | null;
  country: string | null;
  summary: string | null;
  realtimeInfo: string | null;
  capacity: number | null;
  deadline: string | null; // ISO or "" to clear
  status: CourseStatus;
}>;

/** 강좌 메타 upsert(관리자 편집). */
export async function upsertCourseMeta(courseId: string, patch: CourseMetaPatch): Promise<CourseMetaOverride> {
  const data: Record<string, unknown> = {};
  const textKeys = ["programme", "title", "subtitle", "audience", "format", "deliveryMode", "classDays", "periodLabel", "country", "summary", "realtimeInfo"] as const;
  for (const k of textKeys) {
    if (k in patch) {
      const v = (patch as Record<string, unknown>)[k];
      data[k] = typeof v === "string" ? v.slice(0, 5000) : null;
    }
  }
  if ("capacity" in patch) data.capacity = typeof patch.capacity === "number" && patch.capacity >= 0 ? Math.floor(patch.capacity) : null;
  if ("deadline" in patch) {
    const d = patch.deadline;
    data.deadline = d ? new Date(d) : null;
  }
  if ("status" in patch) data.status = normStatus(patch.status);

  const r = await prisma.courseMeta.upsert({
    where: { courseId },
    create: { courseId, ...data },
    update: data,
  });
  return toOverride(r);
}
