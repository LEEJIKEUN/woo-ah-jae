import { requireClassroomAccess, isStaffRole } from "@/lib/course/access";
import MentoringView from "./MentoringView";

export async function generateMetadata() {
  return { title: "탐구활동 멘토링 · 우아재" };
}

export default async function MentoringPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const session = await requireClassroomAccess(courseId, `/course/${courseId}/mentoring`);
  const staff = isStaffRole(session.role); // 관리자·퍼실리테이터 = 멘토(teacher)
  return <MentoringView courseId={courseId} role={staff ? "teacher" : "student"} isStaff={staff} />;
}
