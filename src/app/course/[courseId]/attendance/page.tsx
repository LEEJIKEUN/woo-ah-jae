import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getSession, isStaffRole } from "@/lib/course/access";
import { getCourse, allActivities } from "@/lib/course/content";
import { getEnrolledUserIds } from "@/lib/enrollment-store";
import { prisma } from "@/lib/prisma";
import AttendanceGrid from "./AttendanceGrid";
import AchievementStandardsManager from "./AchievementStandardsManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "출석·이수 관리 · 우아재" };

export default async function AttendancePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const course = getCourse(courseId);
  if (!course) notFound();

  const session = await getSession();
  if (!session) redirect(`/login?next=/course/${courseId}/attendance`);
  if (!isStaffRole(session.role)) redirect(`/course/${courseId}`);

  // 이수 집계 대상(완료 가능한) 활동. 일정(scheduleLabel)이 있는 것은 실시간 수업 '회차'로 번호를 매긴다.
  let n = 0;
  const sessions = allActivities(course)
    .filter((x) => x.activity.completion !== "none")
    .map((x) => {
      const scheduled = !!x.activity.scheduleLabel;
      if (scheduled) n += 1;
      return {
        id: x.activity.id,
        title: x.activity.title,
        week: x.module.label,
        scheduleLabel: x.activity.scheduleLabel ?? null,
        no: scheduled ? n : null,
      };
    });
  const liveCount = n;

  const enrolledIds = await getEnrolledUserIds(courseId);
  const [users, completions] = await Promise.all([
    enrolledIds.length
      ? prisma.user.findMany({
          where: { id: { in: enrolledIds }, lifecycleStatus: "ACTIVE" },
          select: { id: true, email: true, studentProfile: { select: { realName: true } } },
        })
      : Promise.resolve([]),
    enrolledIds.length
      ? prisma.lessonCompletion.findMany({
          where: { courseId, userId: { in: enrolledIds } },
          select: { userId: true, activityId: true },
        })
      : Promise.resolve([]),
  ]);

  const students = users
    .map((u) => ({ id: u.id, name: u.studentProfile?.realName || u.email }))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  const initialDone = completions.map((c) => `${c.userId}:${c.activityId}`);

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8 md:px-6">
      <Link href={`/course/${courseId}/learn`} className="mb-2 inline-flex items-center gap-1 text-[13px] font-bold" style={{ color: "#6B5342" }}>
        <ChevronLeft size={14} /> 강의실
      </Link>
      <h1 className="text-[26px] font-semibold" style={{ fontFamily: "var(--font-serif)", color: "#2C2823" }}>출석·이수 관리</h1>
      <p className="mt-1.5 text-[14px] leading-6" style={{ color: "#8A8479" }}>
        {course.title} · 실시간 수업 {liveCount}회{course.classDays ? ` · ${course.classDays}` : ""}
        {course.periodLabel ? ` · ${course.periodLabel}` : ""}
      </p>
      <p className="mt-1 text-[13px] leading-6" style={{ color: "#8A8479" }}>
        각 회차에 참석한 수강생을 체크하세요. 체크하면 해당 학생의 이수(진도)로 기록되어 학생·학부모 화면에 반영됩니다.
      </p>

      <AttendanceGrid courseId={courseId} sessions={sessions} students={students} initialDone={initialDone} isAdmin={session.role === "ADMIN"} />

      <AchievementStandardsManager courseId={courseId} />
    </main>
  );
}
