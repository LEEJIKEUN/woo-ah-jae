import { requireClassroomAccess, isStaffRole } from "@/lib/course/access";
import ExamReviewView from "./ExamReviewView";

export async function generateMetadata() {
  return { title: "채점 결과 · 우아재" };
}

export default async function ExamResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string; examId: string }>;
  searchParams: Promise<{ studentId?: string }>;
}) {
  const { courseId, examId } = await params;
  const sp = await searchParams;
  const session = await requireClassroomAccess(courseId, `/course/${courseId}/exam/${examId}/result`);
  const staff = isStaffRole(session.role);
  const studentId = staff && typeof sp.studentId === "string" ? sp.studentId : "";
  return <ExamReviewView courseId={courseId} examId={examId} isStaff={staff} studentId={studentId} />;
}
