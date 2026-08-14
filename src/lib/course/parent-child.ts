import { isUserEnrolled } from "@/lib/enrollment-store";
import { prisma } from "@/lib/prisma";

/** 학부모의 승인된 자녀 userId 목록. */
export async function approvedChildIds(parentUserId: string): Promise<string[]> {
  const links = await prisma.parentChildLink.findMany({ where: { parentUserId, status: "APPROVED" }, select: { childUserId: true } });
  return links.map((l) => l.childUserId);
}

/** 해당 강좌에 수강 중인 첫 자녀(이름 포함). 없으면 null. (자녀 여럿이면 첫 자녀) */
export async function resolveChildInCourse(courseId: string, parentUserId: string): Promise<{ id: string; name: string } | null> {
  const links = await prisma.parentChildLink.findMany({
    where: { parentUserId, status: "APPROVED" },
    select: { childUserId: true, child: { select: { email: true, studentProfile: { select: { realName: true } } } } },
  });
  for (const l of links) {
    if (await isUserEnrolled(courseId, l.childUserId)) return { id: l.childUserId, name: l.child.studentProfile?.realName?.trim() || l.child.email };
  }
  return null;
}

/** parentUserId 가 childUserId 를 승인된 자녀로 두고 있는지. */
export async function isApprovedChild(parentUserId: string, childUserId: string): Promise<boolean> {
  const link = await prisma.parentChildLink.findFirst({ where: { parentUserId, childUserId, status: "APPROVED" }, select: { id: true } });
  return !!link;
}
