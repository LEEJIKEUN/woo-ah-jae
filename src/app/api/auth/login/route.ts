import { UserLifecycleStatus, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSessionToken, hashPassword, setSessionCookie, verifyPassword } from "@/lib/auth";
import {
  findLocalSignupByEmail,
  isDbConnectionError,
  setLocalSignupPasswordHash,
} from "@/lib/local-signup-store";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = bodySchema.parse(body);

    try {
      const user = await prisma.user.findUnique({
        where: { email: parsed.email },
        select: {
          id: true,
          email: true,
          role: true,
          passwordHash: true,
          lifecycleStatus: true,
        },
      });
      if (!user) {
        return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
      }
      if (user.lifecycleStatus !== UserLifecycleStatus.ACTIVE) {
        return NextResponse.json({ error: "비활성화된 계정입니다. 관리자에게 문의하세요." }, { status: 403 });
      }

      const ok = await verifyPassword(parsed.password, user.passwordHash);
      if (!ok) {
        return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
      }

      const token = await createSessionToken({
        sub: user.id,
        role: user.role,
        email: user.email,
      });
      await setSessionCookie(token);

      return NextResponse.json({ id: user.id, email: user.email, role: user.role });
    } catch (dbError) {
      if (!isDbConnectionError(dbError)) throw dbError;

      const adminEmail = process.env.SEED_ADMIN_EMAIL;
      const adminPassword = process.env.SEED_ADMIN_PASSWORD;

      if (
        adminEmail &&
        adminPassword &&
        parsed.email === adminEmail &&
        parsed.password === adminPassword
      ) {
        const token = await createSessionToken({
          sub: "local_admin",
          role: UserRole.ADMIN,
          email: adminEmail,
        });
        await setSessionCookie(token);

        return NextResponse.json({ id: "local_admin", email: adminEmail, role: UserRole.ADMIN, fallback: true });
      }

      const localSignup = await findLocalSignupByEmail(parsed.email);
      if (localSignup) {
        let passwordOk = false;

        if (localSignup.passwordHash) {
          passwordOk = await verifyPassword(parsed.password, localSignup.passwordHash);
        } else if (process.env.NODE_ENV !== "production") {
          // Development fallback for old local records created before passwordHash support.
          const migratedHash = await hashPassword(parsed.password);
          await setLocalSignupPasswordHash(localSignup.id, migratedHash);
          passwordOk = true;
        }

        if (!passwordOk) {
          return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
        }

        const token = await createSessionToken({
          sub: localSignup.id,
          role: UserRole.STUDENT,
          email: localSignup.email,
        });
        await setSessionCookie(token);

        return NextResponse.json({
          id: localSignup.id,
          email: localSignup.email,
          role: UserRole.STUDENT,
          fallback: true,
        });
      }

      return NextResponse.json(
        { error: "DB 연결 없음: 가입된 로컬 계정 또는 관리자 계정으로 로그인하세요." },
        { status: 503 }
      );
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
