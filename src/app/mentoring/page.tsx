import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isStaffRole } from "@/lib/course/access";
import { getMentoringRooms } from "@/lib/mentoring-inbox";
import MentoringBoard from "./MentoringBoard";

export const dynamic = "force-dynamic";
export const metadata = { title: "멘토링 더보기 · 우아재" };

export default async function MentoringMorePage() {
  const user = await requireUser("/login?next=/mentoring");
  if (!isStaffRole(user.role)) redirect("/");

  const { courses, rooms } = await getMentoringRooms({ userId: user.id, role: user.role });
  return <MentoringBoard courses={courses} rooms={rooms} viewerId={user.id} />;
}
