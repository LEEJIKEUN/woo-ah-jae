import { requireClassroomAccess } from "@/lib/course/access";
import ExamAnswerView from "./ExamAnswerView";

export async function generateMetadata() {
  return { title: "답안 작성 · 우아재" };
}

export default async function ExamAnswerPage({ params }: { params: Promise<{ courseId: string; examId: string }> }) {
  const { courseId, examId } = await params;
  const session = await requireClassroomAccess(courseId, `/course/${courseId}/exam/${examId}/answer`);
  return <ExamAnswerView courseId={courseId} examId={examId} isStudent={session.role === "STUDENT"} />;
}
