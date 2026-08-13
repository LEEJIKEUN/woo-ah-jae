import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/course/access";
import { getCourse } from "@/lib/course/content";
import { getAssignment } from "@/lib/mentoring-store";
import VideoViewer from "./VideoViewer";

export const dynamic = "force-dynamic";
export const metadata = { title: "과제 동영상 · 우아재" };

export default async function WatchPage({ params }: { params: Promise<{ courseId: string; assignmentId: string }> }) {
  const { courseId, assignmentId } = await params;
  if (!getCourse(courseId)) notFound();

  const session = await getSession();
  if (!session) redirect(`/login?next=/course/${courseId}/mentoring`);

  const a = await getAssignment(assignmentId);
  if (!a || a.courseId !== courseId) notFound();

  // 실제 접근 권한(본인·스태프·학부모·피어리뷰 대상자)은 파일 API가 검증한다.
  const src = `/api/courses/${courseId}/mentoring/assignment/${assignmentId}`;
  return <VideoViewer src={src} name={a.name} />;
}
