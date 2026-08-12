import { requireClassroomAccess, isStaffRole } from "@/lib/course/access";
import BoardView from "./BoardView";

export async function generateMetadata() {
  return { title: "수강생 토론 게시판 · 우아재" };
}

export default async function BoardPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const session = await requireClassroomAccess(courseId, `/course/${courseId}/board`);
  return <BoardView courseId={courseId} isStaff={isStaffRole(session.role)} />;
}
