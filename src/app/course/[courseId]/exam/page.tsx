import { requireClassroomAccess, isStaffRole } from "@/lib/course/access";
import ExamListView from "./ExamListView";

export async function generateMetadata() {
  return { title: "시험 · 우아재" };
}

export default async function ExamListPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const session = await requireClassroomAccess(courseId, `/course/${courseId}/exam`);
  return <ExamListView courseId={courseId} isStaff={isStaffRole(session.role)} />;
}
