import { redirect } from "next/navigation";
import { requireClassroomAccess, isStaffRole } from "@/lib/course/access";
import WatchProgressView from "./WatchProgressView";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: "강의 수강 현황 · 우아재" };
}

export default async function WatchPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const session = await requireClassroomAccess(courseId, `/course/${courseId}/watch`);
  if (!isStaffRole(session.role)) redirect(`/course/${courseId}/learn`);
  return <WatchProgressView courseId={courseId} />;
}
