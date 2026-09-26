import { jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";
import { MaintenanceStatus } from "@prisma/client";
import { getMaintenanceState } from "@/lib/maintenance";

const SESSION_COOKIE = "wooahjae_session";

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    return null;
  }
  return new TextEncoder().encode(secret);
}

async function getRoleFromRequest(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const secret = getJwtSecret();

  if (!token || !secret) return null;

  try {
    const { payload } = await jwtVerify(token, secret);
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // allow-list paths even during maintenance
  const maintenanceBypass = ["/login", "/api/admin/maintenance", "/api/maintenance/status", "/maintenance"];
  if (maintenanceBypass.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  // Global maintenance gate for non-admins. Uses the cached lookup so this
  // per-request check doesn't hit the DB every time (which kept Neon awake).
  const maintenance = await getMaintenanceState();
  if (maintenance.status === MaintenanceStatus.ACTIVE) {
    const role = await getRoleFromRequest(req);
    if (role !== "ADMIN") {
      const maintenanceUrl = new URL("/maintenance", req.url);
      maintenanceUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(maintenanceUrl);
    }
  }

  if (pathname.startsWith("/admin")) {
    const role = await getRoleFromRequest(req);
    if (role !== "ADMIN") {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("next", pathname);
      loginUrl.searchParams.set("error", "admin_required");
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/maintenance", "/((?!_next/static|_next/image|favicon.ico).*)"],
};
