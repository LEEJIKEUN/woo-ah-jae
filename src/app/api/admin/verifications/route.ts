import { VerificationStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { isDbConnectionError, listLocalSignups } from "@/lib/local-signup-store";
import { jsonError, requireAdmin } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

const VALID_STATUS = new Set<string>(["ALL", ...Object.values(VerificationStatus)]);

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const statusParam = request.nextUrl.searchParams.get("status") ?? "PENDING_REVIEW";
    const status = VALID_STATUS.has(statusParam) ? statusParam : "PENDING_REVIEW";

    try {
      const submissions = await prisma.verificationSubmission.findMany({
        where: {
          ...(status !== "ALL" ? { status: status as VerificationStatus } : {}),
          ...(q
            ? {
                OR: [
                  { user: { email: { contains: q } } },
                  {
                    user: {
                      studentProfile: {
                        schoolName: { contains: q },
                      },
                    },
                  },
                ],
              }
            : {}),
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              studentProfile: {
                select: {
                  schoolName: true,
                  grade: true,
                  residenceCountry: true,
                  birthDate: true,
                },
              },
            },
          },
        },
        orderBy: { submittedAt: "desc" },
      });

      return NextResponse.json({ items: submissions, source: "db" });
    } catch (dbError) {
      if (!isDbConnectionError(dbError)) throw dbError;

      const locals = await listLocalSignups();
      const filtered = locals.filter((x) => {
        const statusOk = status === "ALL" ? true : x.status === status;
        const qOk =
          !q ||
          x.email.toLowerCase().includes(q.toLowerCase()) ||
          x.schoolName.toLowerCase().includes(q.toLowerCase());
        return statusOk && qOk;
      });

      const items = filtered.map((x) => ({
        id: x.id,
        status: x.status,
        docType: "STUDENT_ID",
        originalFilename: x.originalFilename,
        mimeType: x.mimeType,
        submittedAt: x.submittedAt,
        reviewedAt: x.reviewedAt,
        rejectReasonCode: x.rejectReasonCode,
        rejectReasonText: x.rejectReasonText,
        user: {
          id: x.id,
          email: x.email,
          studentProfile: {
            schoolName: x.schoolName,
            grade: x.grade,
            residenceCountry: x.residenceCountry,
            birthDate: x.birthDate,
          },
        },
      }));

      return NextResponse.json({ items, source: "local" });
    }
  } catch (error) {
    return jsonError(error);
  }
}
