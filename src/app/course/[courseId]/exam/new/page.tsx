import { redirect } from "next/navigation";
import { requireClassroomAccess, isStaffRole } from "@/lib/course/access";
import ExamCreateForm from "./ExamCreateForm";

export async function generateMetadata() {
  return { title: "시험 만들기 · 우아재" };
}

export default async function ExamNewPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const session = await requireClassroomAccess(courseId, `/course/${courseId}/exam/new`);
  if (!isStaffRole(session.role)) redirect(`/course/${courseId}/exam`);
  return <ExamCreateForm courseId={courseId} />;
}
