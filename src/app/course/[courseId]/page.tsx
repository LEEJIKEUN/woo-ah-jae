import { getCourse, courseActivityHref, isModuleLocked, weekOpenLabel, weekPeriodLabel } from "@/lib/course/content";
import { canEnterClassroom, getSession, isStaffRole } from "@/lib/course/access";
import { getCourseMeta } from "@/lib/course/meta-store";
import { loadDbCourse } from "@/lib/course/db-course";
import CourseIntro from "./CourseIntro";
import type { IntroData } from "./CourseIntro";

export async function generateMetadata({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const course = getCourse(courseId);
  return { title: course ? `${course.title} · 우아재` : "강좌 · 우아재" };
}

export default async function CoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const course = getCourse(courseId);

  // 로그인 여부 + 수강신청 완료(또는 스태프) 여부 — seed 잠금 계산 전에 먼저 확인
  const session = await getSession();
  const authed = !!session;
  const isStaff = !!session && isStaffRole(session.role);
  const isAdmin = !!session && session.role === "ADMIN";
  const enrolled = await canEnterClassroom(courseId, session);
  const meta = course ? await getCourseMeta(courseId) : null;

  // 비공개 강좌는 관리자 외에는 접근 불가(목록에서도 숨김)
  const hiddenPrivate = !!meta && meta.status === "private" && !isAdmin;

  let seed: IntroData | null = null;
  if (course && !hiddenPrivate) {
    const activities = course.modules.flatMap((m) => m.blocks).flatMap((b) => b.activities);
    seed = {
      id: course.id,
      programme: meta?.programme ?? course.programme,
      title: meta?.title ?? course.title,
      subtitle: meta?.subtitle ?? course.subtitle,
      audience: meta?.audience ?? course.audience,
      deliveryMode: course.deliveryMode,
      classDays: meta?.classDays ?? course.classDays,
      timetable: course.timetable,
      periodLabel: meta?.periodLabel ?? course.periodLabel,
      country: meta?.country ?? course.country,
      summary: meta?.summary ?? course.summary,
      realtimeInfo: meta?.realtimeInfo ?? undefined,
      instructor: { name: course.instructor.name, initials: course.instructor.initials },
      modules: course.modules.map((m) => ({
        label: m.label,
        locked: isModuleLocked(m, Date.now(), isStaff),
        period: m.weekStart ? weekPeriodLabel(m.weekStart, m.weekEnd) : undefined,
        openLabel: m.weekStart ? weekOpenLabel(m.weekStart) : undefined,
        sessions: m.blocks
          .flatMap((b) => b.activities)
          .map((a) => ({ title: a.title, scheduleLabel: a.scheduleLabel })),
      })),
      firstHref: activities[0] ? courseActivityHref(course.id, activities[0].id) : undefined,
    };
  } else if (!course) {
    // DB 강좌(관리자가 새로 개설) — 하드코딩에 없으면 DB 조회
    const db = await loadDbCourse(courseId);
    if (db && !(db.status === "private" && !isAdmin)) {
      seed = {
        id: db.slug,
        programme: db.programme,
        title: db.title,
        subtitle: db.subtitle,
        audience: db.audience,
        deliveryMode: db.deliveryMode,
        classDays: db.classDays,
        periodLabel: db.periodLabel,
        country: db.country,
        summary: db.summary,
        realtimeInfo: db.realtimeInfo || undefined,
        instructor: { name: "우아재 서재", initials: "齋" },
        modules: db.modules.map((m) => ({ label: m.label, sessions: m.lessons.map((l) => ({ title: l.title, scheduleLabel: l.scheduleLabel || undefined })) })),
        firstHref: `/course/${db.slug}/learn`,
      };
    }
  }

  // DB 강좌(하드코딩 아님)를 관리자가 볼 때만 커리큘럼 편집 링크 노출
  const editHref = isAdmin && !course && seed ? `/course/${courseId}/edit` : undefined;
  const isFacilitator = !!session && session.role === "FACILITATOR";
  return <CourseIntro seed={seed} courseId={courseId} authed={authed} enrolled={enrolled} isAdmin={isAdmin} isFacilitator={isFacilitator} editHref={editHref} />;
}
