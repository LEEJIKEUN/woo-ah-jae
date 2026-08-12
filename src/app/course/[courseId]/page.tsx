import { getCourse, courseActivityHref, isModuleLocked, weekOpenLabel, weekPeriodLabel } from "@/lib/course/content";
import { canEnterClassroom, getSession } from "@/lib/course/access";
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

  let seed: IntroData | null = null;
  if (course) {
    const activities = course.modules.flatMap((m) => m.blocks).flatMap((b) => b.activities);
    seed = {
      id: course.id,
      programme: course.programme,
      title: course.title,
      subtitle: course.subtitle,
      audience: course.audience,
      deliveryMode: course.deliveryMode,
      classDays: course.classDays,
      timetable: course.timetable,
      periodLabel: course.periodLabel,
      country: course.country,
      summary: course.summary,
      instructor: { name: course.instructor.name, initials: course.instructor.initials },
      modules: course.modules.map((m) => ({
        label: m.label,
        locked: isModuleLocked(m),
        period: m.weekStart ? weekPeriodLabel(m.weekStart, m.weekEnd) : undefined,
        openLabel: m.weekStart ? weekOpenLabel(m.weekStart) : undefined,
        sessions: m.blocks
          .flatMap((b) => b.activities)
          .map((a) => ({ title: a.title, scheduleLabel: a.scheduleLabel })),
      })),
      firstHref: activities[0] ? courseActivityHref(course.id, activities[0].id) : undefined,
    };
  }

  // 로그인 여부 + 수강신청 완료(또는 관리자) 여부
  const session = await getSession();
  const authed = !!session;
  const enrolled = await canEnterClassroom(courseId, session);

  // seed 가 없으면(커스텀 코스) CourseIntro 가 localStorage 에서 해석
  return <CourseIntro seed={seed} courseId={courseId} authed={authed} enrolled={enrolled} />;
}
