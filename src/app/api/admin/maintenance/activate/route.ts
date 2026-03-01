import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireSuperAdmin } from "@/lib/guards";
import { setMaintenanceState } from "@/lib/maintenance";
import { MaintenanceStatus } from "@prisma/client";

export async function POST(request: NextRequest) {
  try {
    const admin = await requireSuperAdmin(request);
    await setMaintenanceState({
      status: MaintenanceStatus.ACTIVE,
      updatedBy: admin.userId,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
