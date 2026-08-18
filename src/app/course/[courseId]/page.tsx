import { getCourse, courseActivityHref, isModuleLocked, weekOpenLabel, weekPeriodLabel } from "@/lib/course/content";
import { canEnterClassroom, getSession, isStaffRole } from "@/lib/course/access";
import { getCourseMeta, resolveCourseStatus, type CourseStatus } from "@/lib/course/meta-store";
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

  // 비공개 강좌는 관리자 외에는 접근 불가(목록에서도 숨김).
  // 메타 오버라이드가 없으면 강좌의 defaultStatus(복제 강좌=private)를 따른다.
  const effStatus = meta?.status ?? course?.defaultStatus ?? "open";
  const hiddenPrivate = !!course && effStatus === "private" && !isAdmin;
  let resolvedStatus: string = effStatus; // 하드코딩=effStatus, DB강좌는 아래에서 db.status 로 갱신

  let seed: IntroData | null = null;
  if (course && !hiddenPrivate) {
    const activities = course.modules.flatMap((m) => m.blocks).flatMap((b) => b.activities);
    seed = {
      id: course.id,
      programme: meta?.programme ?? course.programme,
      title: meta?.title ?? course.title,
      subtitle: meta?.subtitle ?? course.subtitle,
      objectives: meta?.objectives ?? course.objectives,
      audience: meta?.audience ?? course.audience,
      format: meta?.format ?? course.format ?? "실시간수업",
      deliveryMode: meta?.deliveryMode ?? course.deliveryMode ?? "온라인",
      classDays: meta?.classDays ?? course.classDays,
      timetable: course.timetable,
      periodLabel: meta?.periodLabel ?? course.periodLabel,
      country: meta?.country ?? course.country,
      summary: meta?.summary ?? course.summary,
      capacity: meta?.capacity ?? 20,
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
      resolvedStatus = db.status;
      seed = {
        id: db.slug,
        programme: db.programme,
        title: db.title,
        subtitle: db.subtitle,
        objectives: db.objectives,
        audience: db.audience,
        format: db.format,
        deliveryMode: db.deliveryMode,
        classDays: db.classDays,
        periodLabel: db.periodLabel,
        country: db.country,
        summary: db.summary,
        capacity: db.capacity,
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

  // 시간 자동 전환(+DB 반영): 접수중→(신청마감일 지남)→마감, 마감→(개강일 지남)→진행중
  if (resolvedStatus === "open" || resolvedStatus === "full") {
    resolvedStatus = await resolveCourseStatus(courseId, resolvedStatus as CourseStatus);
  }

  // 접수중(open)이 아니면 신규 수강신청 차단 + 상태 라벨/안내
  // statusLabel = 신청 현황의 짧은 상태, message = 있을 때만 안내 박스 노출(마감은 '20/20 · 마감' 으로 충분)
  const ENROLL_BLOCK_UI: Record<string, { label: string; statusLabel: string; message?: string }> = {
    ongoing: { label: "진행 중 — 신청 마감", statusLabel: "진행 중", message: "이미 진행 중이라 신청을 받지 않습니다." },
    full: { label: "정원 마감", statusLabel: "마감" },
    prep: { label: "오픈 준비 중", statusLabel: "오픈 준비 중", message: "곧 접수를 시작합니다. 잠시만 기다려 주세요." },
  };
  const enrollBlock = ENROLL_BLOCK_UI[resolvedStatus] ?? null;

  return <CourseIntro seed={seed} courseId={courseId} authed={authed} enrolled={enrolled} isAdmin={isAdmin} isFacilitator={isFacilitator} editHref={editHref} enrollBlock={enrollBlock} />;
}
