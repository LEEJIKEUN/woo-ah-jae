import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireSuperAdmin } from "@/lib/guards";
import { setMaintenanceState } from "@/lib/maintenance";
import { MaintenanceStatus } from "@prisma/client";

const bodySchema = z.object({
  lockAt: z.string().datetime(),
  messageKor: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const admin = await requireSuperAdmin(request);
    const body = bodySchema.parse(await request.json());

    const lockAt = new Date(body.lockAt);
    if (Number.isNaN(lockAt.getTime())) {
      return NextResponse.json({ error: "lockAt is invalid" }, { status: 400 });
    }

    await setMaintenanceState({
      status: MaintenanceStatus.SCHEDULED,
      lockAt,
      messageKor: body.messageKor ?? "시스템 점검이 예정되어 있습니다.",
      updatedBy: admin.userId,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    return jsonError(error);
  }
}
