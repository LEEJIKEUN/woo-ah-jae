import { requireClassroomAccess } from "@/lib/course/access";
import MentoringView from "./MentoringView";

export async function generateMetadata() {
  return { title: "탐구활동 멘토링 · 우아재" };
}

export default async function MentoringPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const session = await requireClassroomAccess(courseId, `/course/${courseId}/mentoring`);
  const role = session.role === "ADMIN" ? "teacher" : "student";
  return <MentoringView courseId={courseId} role={role} />;
}
