import { requireClassroomAccess, isStaffRole } from "@/lib/course/access";
import { getEnrolledUserIds, isUserEnrolled } from "@/lib/enrollment-store";
import { prisma } from "@/lib/prisma";
import MentoringView from "./MentoringView";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: "탐구활동 멘토링 · 우아재" };
}

export default async function MentoringPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const session = await requireClassroomAccess(courseId, `/course/${courseId}/mentoring`);
  const staff = isStaffRole(session.role); // 관리자·퍼실리테이터 = 멘토(teacher)
  const isParent = session.role === "PARENT";
  const isStudent = session.role === "STUDENT";

  // 대상 학생 목록 + 초기 선택: 학생=본인 / 스태프=수강생 전체 / 학부모=승인된 자녀(수강중)
  let students: { id: string; name: string }[] = [];
  let initialStudentId = "";

  if (isStudent) {
    initialStudentId = session.userId;
  } else if (staff) {
    const ids = await getEnrolledUserIds(courseId);
    const users = ids.length
      ? await prisma.user.findMany({
          where: { id: { in: ids }, lifecycleStatus: "ACTIVE" },
          select: { id: true, email: true, studentProfile: { select: { realName: true } } },
        })
      : [];
    students = users
      .map((u) => ({ id: u.id, name: u.studentProfile?.realName || u.email }))
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));
    initialStudentId = students[0]?.id ?? "";
  } else if (isParent) {
    const links = await prisma.parentChildLink.findMany({
      where: { parentUserId: session.userId, status: "APPROVED" },
      select: { childUserId: true, child: { select: { email: true, studentProfile: { select: { realName: true } } } } },
    });
    for (const l of links) {
      if (await isUserEnrolled(courseId, l.childUserId)) {
        students.push({ id: l.childUserId, name: l.child.studentProfile?.realName || l.child.email });
      }
    }
    initialStudentId = students[0]?.id ?? "";
  }

  return (
    <MentoringView
      courseId={courseId}
      role={staff ? "teacher" : "student"}
      isStaff={staff}
      isParent={isParent}
      isStudent={isStudent}
      students={students}
      initialStudentId={initialStudentId}
    />
  );
}
