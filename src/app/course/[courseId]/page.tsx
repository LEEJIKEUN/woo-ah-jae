import { getCourse, courseActivityHref, isModuleLocked, weekOpenLabel, weekPeriodLabel } from "@/lib/course/content";
import { canEnterClassroom, getSession, isStaffRole } from "@/lib/course/access";
import { getCourseMeta } from "@/lib/course/meta-store";
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
  }

  // seed 가 없으면(커스텀 코스) CourseIntro 가 localStorage 에서 해석
  return <CourseIntro seed={seed} courseId={courseId} authed={authed} enrolled={enrolled} isAdmin={isAdmin} />;
}
