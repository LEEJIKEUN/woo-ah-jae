import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCourse, allActivities, type Course, type Module, type Activity, type ActivityKind } from "./content";

/**
 * 강좌 차시(커리큘럼) 런타임 편집 — 오버라이드 방식(opt-in).
 * - 저장본이 없으면 하드코딩 Course 를 그대로 사용(현행 동작, 활성 강좌 무영향).
 * - 저장본이 있으면 modules 를 교체해 강의실(홈·차시·출석·이수)과 소개에 동일 반영.
 * - 저장은 기존 LessonContent(Json) 테이블의 예약 activityId(__curriculum__)에 넣어
 *   별도 마이그레이션 없이 영구 저장한다. 각 차시의 '학습 콘텐츠'는 기존대로
 *   LessonContent[해당 activityId] 에 저장되므로, 차시 id 만 보존되면 콘텐츠도 유지된다.
 */
const CURRICULUM_KEY = "__curriculum__";

export type OverrideSession = { id: string; title: string; scheduleLabel?: string; durationMin?: number; kind?: string };
export type OverrideModule = { id: string; label: string; weekStart?: string; weekEnd?: string; sessions: OverrideSession[] };

export function newCurriculumId(prefix: string): string {
  return `${prefix}-${crypto.randomBytes(4).toString("hex")}`;
}

function cleanDate(v?: string): string | undefined {
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
}

function cleanModules(mods: OverrideModule[]): OverrideModule[] {
  if (!Array.isArray(mods)) return [];
  return mods
    .slice(0, 80)
    .map((m) => ({
      id: String(m.id || newCurriculumId("m")).slice(0, 80),
      label: String(m.label ?? "").slice(0, 200),
      weekStart: cleanDate(m.weekStart),
      weekEnd: cleanDate(m.weekEnd),
      sessions: (Array.isArray(m.sessions) ? m.sessions : [])
        .slice(0, 80)
        .map((s) => ({
          id: String(s.id || newCurriculumId("s")).slice(0, 80),
          title: String(s.title ?? "").slice(0, 300),
          scheduleLabel: s.scheduleLabel ? String(s.scheduleLabel).slice(0, 120) : undefined,
          durationMin: typeof s.durationMin === "number" && s.durationMin > 0 ? Math.min(600, Math.floor(s.durationMin)) : undefined,
          kind: s.kind === "assignment" || s.kind === "resource" || s.kind === "forum" ? s.kind : undefined,
        }))
        .filter((s) => s.title || s.scheduleLabel),
    }))
    .filter((m) => m.label || m.sessions.length);
}

/** 저장된 커리큘럼 오버라이드(모듈·차시). 없거나 오류면 null(=하드코딩 사용 — 안전 폴백). */
export async function getCurriculumOverride(courseId: string): Promise<OverrideModule[] | null> {
  try {
    const row = await prisma.lessonContent.findUnique({
      where: { courseId_activityId: { courseId, activityId: CURRICULUM_KEY } },
      select: { blocks: true },
    });
    const blocks = row?.blocks as unknown;
    if (blocks && typeof blocks === "object" && !Array.isArray(blocks) && Array.isArray((blocks as { modules?: unknown }).modules)) {
      return cleanModules((blocks as { modules: OverrideModule[] }).modules);
    }
    return null;
  } catch {
    return null; // DB 오류 시 하드코딩으로 폴백(강의실이 죽지 않도록)
  }
}

/** 커리큘럼 오버라이드 저장(정제 후). */
export async function setCurriculumOverride(courseId: string, modules: OverrideModule[]): Promise<OverrideModule[]> {
  const clean = cleanModules(modules);
  const data = { modules: clean } as unknown as Prisma.InputJsonValue;
  await prisma.lessonContent.upsert({
    where: { courseId_activityId: { courseId, activityId: CURRICULUM_KEY } },
    create: { courseId, activityId: CURRICULUM_KEY, blocks: data },
    update: { blocks: data },
  });
  return clean;
}

/** 하드코딩 Course → 오버라이드 모듈 형태(편집 초기값). */
export function hardcodedOverride(course: Course): OverrideModule[] {
  return course.modules.map((m) => ({
    id: m.id,
    label: m.label,
    weekStart: m.weekStart,
    weekEnd: m.weekEnd,
    sessions: m.blocks.flatMap((b) => b.activities).map((a) => ({ id: a.id, title: a.title, scheduleLabel: a.scheduleLabel, durationMin: a.durationMin, kind: a.kind })),
  }));
}

/** 오버라이드 모듈 → 하드코딩과 동일한 Course.modules 형태로 재구성(기존 activity body/materials 보존). */
function overrideToModules(base: Course, override: OverrideModule[]): Module[] {
  const hardActs = new Map(allActivities(base).map((x) => [x.activity.id, x.activity]));
  return override.map((m) => ({
    id: m.id,
    label: m.label,
    weekStart: m.weekStart,
    weekEnd: m.weekEnd,
    blocks: [
      {
        banner: m.label,
        activities: m.sessions.map((s): Activity => {
          const hard = hardActs.get(s.id);
          if (hard) return { ...hard, title: s.title || hard.title, scheduleLabel: s.scheduleLabel ?? hard.scheduleLabel, durationMin: s.durationMin ?? hard.durationMin };
          return { id: s.id, kind: (s.kind as ActivityKind) ?? "page", title: s.title, scheduleLabel: s.scheduleLabel, durationMin: s.durationMin, completion: "auto", body: [], materials: [] };
        }),
      },
    ],
  }));
}

/** 실효 Course — 오버라이드 있으면 modules 교체, 없으면 하드코딩 그대로. 강의실·소개·출석·이수 공용. */
export async function getEffectiveCourse(courseId: string): Promise<Course | undefined> {
  const base = getCourse(courseId);
  if (!base) return undefined;
  const override = await getCurriculumOverride(courseId);
  if (!override || !override.length) return base;
  return { ...base, modules: overrideToModules(base, override) };
}
