import Link from "next/link";
import { notFound } from "next/navigation";
import { getCourse, findActivity, isModuleLocked, weekOpenLabel } from "@/lib/course/content";
import { requireClassroomAccess, isStaffRole } from "@/lib/course/access";
import ClassroomSidebar from "@/components/course/ClassroomSidebar";
import { CompletionProvider } from "@/components/course/completion";
import LessonBlocks from "@/components/course/LessonBlocks";
import ActivityView from "./ActivityView";
import CustomLessonView from "./CustomLessonView";

export async function generateMetadata({ params }: { params: Promise<{ courseId: string; activityId: string }> }) {
  const { courseId, activityId } = await params;
  const course = getCourse(courseId);
  const found = course ? findActivity(course, activityId) : undefined;
  return { title: found ? `${found.activity.title} · 우아재` : "학습 · 우아재" };
}

export default async function ActivityPage({
  params,
}: {
  params: Promise<{ courseId: string; activityId: string }>;
}) {
  const { courseId, activityId } = await params;
  const session = await requireClassroomAccess(courseId, `/course/${courseId}/a/${activityId}`);
  const isStaff = isStaffRole(session.role); // 관리자·퍼실리테이터 = 잠금 무시 + 콘텐츠 편집
  const isParent = session.role === "PARENT";
  const course = getCourse(courseId);

  // 시드 강좌 → 기존 학습 뷰 (홈 브라운 톤)
  if (course) {
    const found = findActivity(course, activityId);
    if (!found) notFound();

    // 아직 열리지 않은 주차는 접근 차단 (스태프는 잠금 무시)
    if (isModuleLocked(found.module, Date.now(), isStaff)) {
      const openLabel = found.module.weekStart ? weekOpenLabel(found.module.weekStart) : "";
      return (
        <div className="mx-auto max-w-[560px] px-6 py-40 text-center">
          <p style={{ fontSize: 40 }}>🔒</p>
          <h1 className="mt-4 text-[24px] font-normal" style={{ fontFamily: "var(--font-serif)", color: "#2C2823" }}>{found.module.label}</h1>
          <p className="mt-3 text-[15px] leading-7" style={{ color: "#8A8479" }}>
            아직 열리지 않은 주차입니다.
            <br />
            {openLabel ? `${openLabel}에 자동으로 열립니다.` : "곧 열립니다."}
          </p>
          <Link
            href={`/course/${courseId}/learn`}
            className="mt-8 inline-flex items-center gap-2 text-white transition hover:opacity-90"
            style={{ background: "#8C6E59", borderRadius: 8, padding: "12px 28px", fontSize: 15, fontFamily: "var(--font-serif)" }}
          >
            강의실로 돌아가기
          </Link>
        </div>
      );
    }

    return (
      <div className="flex w-full items-start" style={{ background: "#fff" }}>
        <ClassroomSidebar courseId={courseId} isStaff={isStaff} isParent={isParent} />
        <main className="min-w-0 flex-1 px-6 py-8 lg:px-12">
          <div className="mx-auto max-w-[860px]">
            <CompletionProvider courseId={courseId}>
              <ActivityView course={course} module={found.module} activity={found.activity} autoComplete={session.role === "STUDENT"} />
              <LessonBlocks courseId={courseId} activityId={activityId} isAdmin={isStaff} />
            </CompletionProvider>
          </div>
        </main>
      </div>
    );
  }

  // 개설(커스텀) 강좌 → localStorage 기반 학습 뷰
  return <CustomLessonView courseId={courseId} lessonId={activityId} />;
}
