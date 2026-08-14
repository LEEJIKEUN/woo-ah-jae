import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

export type DbLesson = { id?: string; title: string; kind: string; scheduleLabel: string; body: string };
export type DbModule = { id?: string; label: string; lessons: DbLesson[] };
export type DbCourse = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  programme: string;
  audience: string;
  format: string;
  deliveryMode: string;
  classDays: string;
  periodLabel: string;
  fromDate: string;
  toDate: string;
  country: string;
  summary: string;
  realtimeInfo: string;
  capacity: number;
  deadline: string | null;
  status: string;
  modules: DbModule[];
};

export type DbCourseInput = {
  title: string;
  subtitle?: string;
  programme?: string;
  audience?: string;
  format?: string;
  deliveryMode?: string;
  classDays?: string;
  periodLabel?: string;
  fromDate?: string;
  toDate?: string;
  country?: string;
  summary?: string;
  realtimeInfo?: string;
  capacity?: number;
  deadline?: string | null;
  status?: string;
  modules?: DbModule[];
};

const STATUSES = ["private", "prep", "open", "full", "ongoing"];

function cleanModules(mods: DbModule[] | undefined): DbModule[] {
  if (!Array.isArray(mods)) return [];
  return mods
    .map((m) => ({
      label: String(m.label ?? "").slice(0, 200),
      lessons: (Array.isArray(m.lessons) ? m.lessons : []).map((l) => ({
        title: String(l.title ?? "").slice(0, 300),
        kind: l.kind === "assignment" ? "assignment" : "page",
        scheduleLabel: String(l.scheduleLabel ?? "").slice(0, 120),
        body: String(l.body ?? "").slice(0, 20000),
      })),
    }))
    .filter((m) => m.label || m.lessons.length);
}

function scalarData(input: DbCourseInput) {
  const status = STATUSES.includes(input.status ?? "") ? input.status! : "private";
  return {
    title: String(input.title ?? "").slice(0, 200),
    subtitle: String(input.subtitle ?? "").slice(0, 500),
    programme: String(input.programme ?? "우아재 강좌").slice(0, 120),
    audience: String(input.audience ?? "고등학생").slice(0, 80),
    format: String(input.format ?? "실시간수업").slice(0, 40),
    deliveryMode: String(input.deliveryMode ?? "온라인").slice(0, 40),
    classDays: String(input.classDays ?? "").slice(0, 200),
    periodLabel: String(input.periodLabel ?? "").slice(0, 120),
    fromDate: String(input.fromDate ?? "").slice(0, 20),
    toDate: String(input.toDate ?? "").slice(0, 20),
    country: String(input.country ?? "한국").slice(0, 80),
    summary: String(input.summary ?? "").slice(0, 20000),
    realtimeInfo: String(input.realtimeInfo ?? "").slice(0, 5000),
    capacity: typeof input.capacity === "number" && input.capacity >= 0 ? Math.floor(input.capacity) : 20,
    deadline: input.deadline ? new Date(input.deadline) : null,
    status,
  };
}

async function uniqueSlug(): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const slug = "c-" + crypto.randomBytes(4).toString("hex");
    const exists = await prisma.courseDb.findUnique({ where: { slug }, select: { id: true } });
    if (!exists) return slug;
  }
  return "c-" + crypto.randomBytes(8).toString("hex");
}

/** slug 로 DB 강좌 로드(커리큘럼 포함). 없으면 null. */
export async function loadDbCourse(slug: string): Promise<DbCourse | null> {
  const c = await prisma.courseDb.findUnique({
    where: { slug },
    include: { modules: { orderBy: { sort: "asc" }, include: { lessons: { orderBy: { sort: "asc" } } } } },
  });
  if (!c) return null;
  return {
    id: c.id,
    slug: c.slug,
    title: c.title,
    subtitle: c.subtitle,
    programme: c.programme,
    audience: c.audience,
    format: c.format,
    deliveryMode: c.deliveryMode,
    classDays: c.classDays,
    periodLabel: c.periodLabel,
    fromDate: c.fromDate,
    toDate: c.toDate,
    country: c.country,
    summary: c.summary,
    realtimeInfo: c.realtimeInfo,
    capacity: c.capacity,
    deadline: c.deadline ? c.deadline.toISOString() : null,
    status: c.status,
    modules: c.modules.map((m) => ({ id: m.id, label: m.label, lessons: m.lessons.map((l) => ({ id: l.id, title: l.title, kind: l.kind, scheduleLabel: l.scheduleLabel, body: l.body })) })),
  };
}

export async function dbCourseExists(slug: string): Promise<boolean> {
  const c = await prisma.courseDb.findUnique({ where: { slug }, select: { id: true } });
  return !!c;
}

/** 홈 목록용 DB 강좌 요약 목록. */
export async function listDbCourses(): Promise<Array<{ slug: string; title: string; audience: string; format: string; deliveryMode: string; fromDate: string; toDate: string; periodLabel: string; country: string; capacity: number; deadline: string | null; status: string }>> {
  const rows = await prisma.courseDb.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map((c) => ({
    slug: c.slug,
    title: c.title,
    audience: c.audience,
    format: c.format,
    deliveryMode: c.deliveryMode,
    fromDate: c.fromDate,
    toDate: c.toDate,
    periodLabel: c.periodLabel,
    country: c.country,
    capacity: c.capacity,
    deadline: c.deadline ? c.deadline.toISOString() : null,
    status: c.status,
  }));
}

export async function createDbCourse(input: DbCourseInput, createdBy: string): Promise<{ slug: string }> {
  const slug = await uniqueSlug();
  const data = scalarData(input);
  const modules = cleanModules(input.modules);
  await prisma.courseDb.create({
    data: {
      slug,
      createdBy,
      ...data,
      modules: {
        create: modules.map((m, mi) => ({
          sort: mi,
          label: m.label,
          lessons: { create: m.lessons.map((l, li) => ({ sort: li, title: l.title, kind: l.kind, scheduleLabel: l.scheduleLabel, body: l.body })) },
        })),
      },
    },
  });
  return { slug };
}

/** 전체 수정 — 스칼라 필드 + 커리큘럼 교체. */
export async function updateDbCourse(slug: string, input: DbCourseInput): Promise<boolean> {
  const c = await prisma.courseDb.findUnique({ where: { slug }, select: { id: true } });
  if (!c) return false;
  const data = scalarData(input);
  const modules = cleanModules(input.modules);
  await prisma.$transaction([
    prisma.courseDb.update({ where: { id: c.id }, data }),
    prisma.courseDbModule.deleteMany({ where: { courseId: c.id } }),
    ...modules.map((m, mi) =>
      prisma.courseDbModule.create({
        data: {
          courseId: c.id,
          sort: mi,
          label: m.label,
          lessons: { create: m.lessons.map((l, li) => ({ sort: li, title: l.title, kind: l.kind, scheduleLabel: l.scheduleLabel, body: l.body })) },
        },
      })
    ),
  ]);
  return true;
}

export async function deleteDbCourse(slug: string): Promise<boolean> {
  const c = await prisma.courseDb.findUnique({ where: { slug }, select: { id: true } });
  if (!c) return false;
  await prisma.courseDb.delete({ where: { id: c.id } });
  return true;
}
