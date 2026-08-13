import { requireUser } from "@/lib/auth";
import { getCourse, COURSES } from "@/lib/course/content";
import { prisma } from "@/lib/prisma";
import NotificationsClient from "./NotificationsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "알림 · 우아재" };

export default async function NotificationsPage() {
  const user = await requireUser("/login?next=/notifications");
  const role = user.role;
  const myName = user.studentProfile?.realName ?? "";

  let courseIds: string[] = [];
  let childNames: string[] = [];

  if (role === "ADMIN") {
    courseIds = COURSES.map((c) => c.id);
  } else if (role === "FACILITATOR") {
    const fc = await prisma.facilitatorCourse.findMany({ where: { facilitatorUserId: user.id }, select: { courseId: true } });
    courseIds = [...new Set(fc.map((f) => f.courseId))];
  } else if (role === "PARENT") {
    const links = await prisma.parentChildLink.findMany({
      where: { parentUserId: user.id, status: "APPROVED" },
      select: { childUserId: true, child: { select: { studentProfile: { select: { realName: true } } } } },
    });
    childNames = links.map((l) => l.child.studentProfile?.realName?.trim() ?? "").filter(Boolean);
    const childIds = links.map((l) => l.childUserId);
    if (childIds.length) {
      const enr = await prisma.enrollment.findMany({ where: { userId: { in: childIds } }, select: { courseId: true } });
      courseIds = [...new Set(enr.map((e) => e.courseId))];
    }
  } else {
    const enr = await prisma.enrollment.findMany({ where: { userId: user.id }, select: { courseId: true } });
    courseIds = [...new Set(enr.map((e) => e.courseId))];
  }

  const courses = courseIds
    .map((id) => ({ id, title: getCourse(id)?.title ?? id }))
    .filter((c) => !!getCourse(c.id));

  return <NotificationsClient role={role} myName={myName} childNames={childNames} courses={courses} />;
}
