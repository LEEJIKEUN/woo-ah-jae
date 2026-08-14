import { getCourse } from "@/lib/course/content";
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

  return <LearningHome courseId={courseId} isStaff={isStaffRole(session.role)} isParent={session.role === "PARENT"} />;
}
