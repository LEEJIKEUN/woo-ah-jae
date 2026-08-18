import { getCourse } from "@/lib/course/content";
import { getEffectiveCourse } from "@/lib/course/curriculum";
import { requireClassroomAccess, isStaffRole } from "@/lib/course/access";
import { loadDbCourse } from "@/lib/course/db-course";
import LearningHome from "./LearningHome";
import DbLearnView from "./DbLearnView";

export async function generateMetadata({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const course = getCourse(courseId);
  return { title: course ? `${course.title} 강의실 · 우아재` : "강의실 · 우아재" };
}

export default async function LearnPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const session = await requireClassroomAccess(courseId, `/course/${courseId}/learn`);

  // 하드코딩 강좌가 아니면 DB 강좌 강의실(1단계: 커리큘럼 읽기)
  if (!getCourse(courseId)) {
    const db = await loadDbCourse(courseId);
    if (db) return <DbLearnView course={db} />;
  }

  // 커리큘럼 오버라이드(관리자 편집)를 반영한 실효 강좌를 넘긴다(없으면 하드코딩 그대로).
  const course = await getEffectiveCourse(courseId);
  return <LearningHome courseId={courseId} course={course} isStaff={isStaffRole(session.role)} isParent={session.role === "PARENT"} />;
}
