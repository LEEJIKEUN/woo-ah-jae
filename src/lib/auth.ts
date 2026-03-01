import { UserLifecycleStatus, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE = "wooahjae_session";

function shouldUseSecureCookie() {
  if (process.env.COOKIE_SECURE === "true") return true;
  if (process.env.COOKIE_SECURE === "false") return false;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";
  if (appUrl.startsWith("https://")) return true;
  if (appUrl.startsWith("http://localhost") || appUrl.startsWith("http://127.0.0.1")) return false;
  if (process.env.NODE_ENV !== "production") return false;

  return Boolean(process.env.VERCEL_URL || process.env.RENDER_EXTERNAL_URL);
}

type SessionPayload = {
  sub: string;
  role: UserRole;
  email: string;
};

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("JWT_SECRET must be set and at least 16 characters");
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT({ role: payload.role, email: payload.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtSecret());
}

export async function verifySessionToken(token: string) {
  const { payload } = await jwtVerify(token, getJwtSecret());
  const sub = payload.sub;
  const role = payload.role;
  const email = payload.email;

  if (typeof sub !== "string" || typeof role !== "string" || typeof email !== "string") {
    throw new Error("Invalid session payload");
  }

  return { userId: sub, role: role as UserRole, email };
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: shouldUseSecureCookie(),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const session = await verifySessionToken(token);
    return await prisma.user.findFirst({
      where: { id: session.userId, lifecycleStatus: UserLifecycleStatus.ACTIVE },
      include: { studentProfile: true },
    });
  } catch {
    return null;
  }
}

export async function requireUser(redirectTo = "/login") {
  const user = await getUser();
  if (!user) {
    redirect(redirectTo);
  }
  return user;
}
