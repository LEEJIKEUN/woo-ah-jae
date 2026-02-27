import AccountPageClient from "@/components/account/AccountPageClient";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AccountPage() {
  const user = await requireUser("/login?next=/account");

  const [latestVerification, owned, joined, applied] = await Promise.all([
    prisma.verificationSubmission.findFirst({
      where: { userId: user.id },
      orderBy: { submittedAt: "desc" },
      select: {
        id: true,
        status: true,
        docType: true,
        submittedAt: true,
        reviewedAt: true,
        rejectReasonCode: true,
        rejectReasonText: true,
      },
    }),
    prisma.project.findMany({
      where: { ownerId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, tab: true, channel: true, status: true, createdAt: true },
    }),
    prisma.projectMember.findMany({
      where: { userId: user.id },
      orderBy: { joinedAt: "desc" },
      take: 5,
      select: {
        joinedAt: true,
        project: {
          select: { id: true, title: true, tab: true, channel: true, status: true, createdAt: true },
        },
      },
    }),
    prisma.application.findMany({
      where: { applicantId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        status: true,
        createdAt: true,
        project: {
          select: { id: true, title: true, tab: true, channel: true, status: true },
        },
      },
    }),
  ]);

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
    verificationStatus: latestVerification?.status ?? "NOT_SUBMITTED",
    verificationSubmission: latestVerification
      ? {
          ...latestVerification,
          submittedAt: latestVerification.submittedAt.toISOString(),
          reviewedAt: latestVerification.reviewedAt?.toISOString() ?? null,
        }
      : null,
  } as const;

  const initialActivity = {
    owned: owned.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
    joined: joined.map((item) => ({
      ...item.project,
      createdAt: item.project.createdAt.toISOString(),
      joinedAt: item.joinedAt.toISOString(),
    })),
    applied: applied.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
  } as const;

  return <AccountPageClient initialMe={initialMe} initialActivity={initialActivity} />;
}
