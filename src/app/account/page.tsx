import AccountPageClient from "@/components/account/AccountPageClient";
import { requireUser } from "@/lib/auth";

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
        }
      : null,
  } as const;

  return <AccountPageClient initialMe={initialMe} />;
}
