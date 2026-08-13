import AccountPageClient from "@/components/account/AccountPageClient";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AccountPage() {
  const user = await requireUser("/login?next=/account");

  const initialMe = {
    id: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    studentProfile: user.studentProfile
      ? {
          realName: user.studentProfile.realName,
          schoolName: user.studentProfile.schoolName,
          grade: user.studentProfile.grade,
          className: user.studentProfile.className,
          number: user.studentProfile.number,
          bio: user.studentProfile.bio,
          residenceCountry: user.studentProfile.residenceCountry,
          birthDate: user.studentProfile.birthDate ? user.studentProfile.birthDate.toISOString() : null,
        }
      : null,
  } as const;

  // 학부모: 연결된 자녀 목록(가입 시 입력한 자녀)
  let childrenLinks: { name: string; email: string; status: string }[] = [];
  if (user.role === "PARENT") {
    const links = await prisma.parentChildLink.findMany({
      where: { parentUserId: user.id },
      orderBy: { createdAt: "asc" },
      select: { status: true, child: { select: { email: true, studentProfile: { select: { realName: true } } } } },
    });
    childrenLinks = links.map((l) => ({ name: l.child.studentProfile?.realName ?? "", email: l.child.email, status: l.status }));
  }

  return <AccountPageClient initialMe={initialMe} childrenLinks={childrenLinks} />;
}
