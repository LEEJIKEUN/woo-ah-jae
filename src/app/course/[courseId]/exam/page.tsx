import { requireClassroomAccess, isStaffRole } from "@/lib/course/access";
import ExamListView from "./ExamListView";
import ExamRoster from "./ExamRoster";

export async function generateMetadata() {
  return { title: "시험 · 우아재" };
}

export default async function ExamListPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const session = await requireClassroomAccess(courseId, `/course/${courseId}/exam`);
  // 스태프는 명렬표(수강생×시험 자동채점), 학생은 본인 시험 목록
  if (isStaffRole(session.role)) return <ExamRoster courseId={courseId} />;
  return <ExamListView courseId={courseId} isStaff={false} />;
}
