import { EntitlementStatus, UserRole, VerificationStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { isDbConnectionError, listLocalSignups } from "@/lib/local-signup-store";
import { jsonError, requireAdmin } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

type MemberItem = {
  id: string;
  email: string;
  realName: string | null;
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

    const nameQuery =
      request.nextUrl.searchParams.get("name")?.trim() ??
      request.nextUrl.searchParams.get("q")?.trim() ??
      "";

    try {
      const [users, billingFlag] = await Promise.all([
        prisma.user.findMany({
          where: nameQuery
            ? {
                studentProfile: {
                  is: {
                    realName: { contains: nameQuery },
                  },
                },
              }
            : undefined,
          include: {
            studentProfile: {
              select: {
                realName: true,
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
          orderBy: { createdAt: "asc" },
        }),
        prisma.featureFlag.findUnique({ where: { key: "billingEnabled" }, select: { valueBool: true } }),
      ]);

      const items: MemberItem[] = users.map((u) => ({
        id: u.id,
        email: u.email,
        realName: u.studentProfile?.realName?.trim() || null,
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

      // 운영 환경에서는 부분 데이터(local)로 오인되지 않게 fallback을 차단한다.
      const allowLocalFallback =
        process.env.NODE_ENV !== "production" ||
        request.nextUrl.searchParams.get("allowLocalFallback") === "1";
      if (!allowLocalFallback) {
        return NextResponse.json(
          {
            error:
              "회원 목록 DB 연결이 일시적으로 불안정합니다. 잠시 후 새로고침해주세요. (부분 목록 전환 방지)",
            source: "db_unavailable",
          },
          { status: 503 }
        );
      }

      const locals = await listLocalSignups();
      const filtered = locals.filter(() => {
        if (!nameQuery) return true;
        return false;
      });

      const items: MemberItem[] = filtered.map((x) => ({
        id: x.id,
        email: x.email,
        realName: null,
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
