import { requireClassroomAccess } from "@/lib/course/access";
import MyProgressView from "./MyProgressView";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: "내 수강 현황 · 우아재" };
}

export default async function MyProgressPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  await requireClassroomAccess(courseId, `/course/${courseId}/my-progress`);
  return <MyProgressView courseId={courseId} />;
}
