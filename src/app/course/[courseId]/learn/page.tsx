import { getCourse } from "@/lib/course/content";
import { requireClassroomAccess, isStaffRole } from "@/lib/course/access";
import LearningHome from "./LearningHome";

export async function generateMetadata({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const course = getCourse(courseId);
  return { title: course ? `${course.title} 강의실 · 우아재` : "강의실 · 우아재" };
}

export default async function LearnPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const session = await requireClassroomAccess(courseId, `/course/${courseId}/learn`);
  return <LearningHome courseId={courseId} isStaff={isStaffRole(session.role)} />;
}
