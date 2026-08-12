import { requireClassroomAccess } from "@/lib/course/access";
import NoticesView from "./NoticesView";

export async function generateMetadata() {
  return { title: "공지사항 · 우아재" };
}

export default async function NoticesPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  await requireClassroomAccess(courseId, `/course/${courseId}/notices`);
  return <NoticesView courseId={courseId} />;
}
