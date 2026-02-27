import { EntitlementStatus, UserRole, VerificationStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { isDbConnectionError, listLocalSignups } from "@/lib/local-signup-store";
import { jsonError, requireAdmin } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

type MemberItem = {
  id: string;
  email: string;
  role: UserRole;
  schoolName: string | null;
  grade: string | null;
  residenceCountry: string | null;
  verificationStatus: VerificationStatus | "UNKNOWN";
  planCode: string;
  entitlementStatus: EntitlementStatus | "NONE";
  createdAt: string;
};

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

    try {
      const [users, billingFlag] = await Promise.all([
        prisma.user.findMany({
          where: q ? { email: { contains: q } } : undefined,
          include: {
            studentProfile: {
              select: {
                schoolName: true,
                grade: true,
                residenceCountry: true,
              },
            },
            verificationSubmissions: {
              orderBy: { submittedAt: "desc" },
              take: 1,
              select: { status: true },
            },
            entitlements: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                status: true,
                plan: { select: { code: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.featureFlag.findUnique({ where: { key: "billingEnabled" }, select: { valueBool: true } }),
      ]);

      const items: MemberItem[] = users.map((u) => ({
        id: u.id,
        email: u.email,
        role: u.role,
        schoolName: u.studentProfile?.schoolName ?? null,
        grade: u.studentProfile?.grade ?? null,
        residenceCountry: u.studentProfile?.residenceCountry ?? null,
        verificationStatus: u.verificationSubmissions[0]?.status ?? VerificationStatus.NOT_SUBMITTED,
        planCode: u.entitlements[0]?.plan.code ?? "FREE",
        entitlementStatus: u.entitlements[0]?.status ?? "NONE",
        createdAt: u.createdAt.toISOString(),
      }));

      return NextResponse.json({
        items,
        billingEnabled: billingFlag?.valueBool ?? false,
        source: "db",
        polledAt: new Date().toISOString(),
      });
    } catch (dbError) {
      if (!isDbConnectionError(dbError)) throw dbError;

      const locals = await listLocalSignups();
      const filtered = locals.filter((x) => !q || x.email.toLowerCase().includes(q.toLowerCase()));

      const items: MemberItem[] = filtered.map((x) => ({
        id: x.id,
        email: x.email,
        role: UserRole.STUDENT,
        schoolName: x.schoolName ?? null,
        grade: x.grade ?? null,
        residenceCountry: x.residenceCountry ?? null,
        verificationStatus: x.status,
        planCode: "FREE",
        entitlementStatus: "NONE",
        createdAt: x.submittedAt,
      }));

      return NextResponse.json({
        items,
        billingEnabled: false,
        source: "local",
        polledAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    return jsonError(error);
  }
}
