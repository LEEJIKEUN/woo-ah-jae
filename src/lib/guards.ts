import { UserRole, VerificationStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function getAuthFromRequest(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    throw new HttpError(401, "Unauthorized");
  }
  try {
    return await verifySessionToken(token);
  } catch {
    throw new HttpError(401, "Invalid session");
  }
}

export async function requireAdmin(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, role: true },
  });
  if (!user) {
    throw new HttpError(401, "세션이 만료되었습니다. 다시 로그인해 주세요.");
  }
  if (user.role !== UserRole.ADMIN) {
    throw new HttpError(403, "Admin only");
  }
  return auth;
}

export async function requireSuperAdmin(request: NextRequest) {
  const auth = await requireAdmin(request);
  const superAdminEmail = (process.env.SUPER_ADMIN_EMAIL || "admin@wooahjae.local").toLowerCase();
  if ((auth.email || "").toLowerCase() !== superAdminEmail) {
    throw new HttpError(403, "Super admin only");
  }
  return auth;
}

export async function getUserVerificationStatus(userId: string) {
  const latest = await prisma.verificationSubmission.findFirst({
    where: { userId },
    orderBy: { submittedAt: "desc" },
    select: { status: true },
  });
  return latest?.status ?? VerificationStatus.NOT_SUBMITTED;
}

export async function requireVerifiedOrAdmin(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, role: true },
  });
  if (!user) {
    throw new HttpError(401, "세션이 만료되었습니다. 다시 로그인해 주세요.");
  }
  if (user.role === UserRole.ADMIN) {
    return auth;
  }
  const status = await getUserVerificationStatus(auth.userId);
  if (status !== VerificationStatus.VERIFIED) {
    throw new HttpError(403, "Only VERIFIED students can access this resource");
  }
  return auth;
}

export function jsonError(error: unknown) {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
}
