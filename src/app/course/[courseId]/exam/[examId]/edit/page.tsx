import { redirect } from "next/navigation";
import { requireClassroomAccess, isStaffRole } from "@/lib/course/access";
import ExamCreateForm from "../../new/ExamCreateForm";

export async function generateMetadata() {
  return { title: "시험 수정 · 우아재" };
}

export default async function ExamEditPage({ params }: { params: Promise<{ courseId: string; examId: string }> }) {
  const { courseId, examId } = await params;
  const session = await requireClassroomAccess(courseId, `/course/${courseId}/exam/${examId}/edit`);
  if (!isStaffRole(session.role)) redirect(`/course/${courseId}/exam`);
  return <ExamCreateForm courseId={courseId} examId={examId} />;
}
