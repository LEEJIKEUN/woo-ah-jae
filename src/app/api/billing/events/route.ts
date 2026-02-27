import { EntitlementStatus, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

const eventSchema = z.object({
  eventType: z.enum(["SUBSCRIPTION_CREATED", "SUBSCRIPTION_UPDATED", "SUBSCRIPTION_CANCELED"]),
  userEmail: z.string().email(),
  planCode: z.string().min(1).default("FREE"),
  status: z.enum(["ACTIVE", "EXPIRED", "CANCELED"]).default("ACTIVE"),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
});

export async function POST(request: NextRequest) {
  const secret = process.env.BILLING_WEBHOOK_SECRET;
  const got = request.headers.get("x-billing-secret");

  if (secret && got !== secret) {
    return NextResponse.json({ error: "Invalid webhook secret" }, { status: 401 });
  }

  let actorUserId = "system";
  try {
    const auth = await requireAdmin(request);
    actorUserId = auth.userId;
  } catch {
    // webhook caller can be non-session based when secret is valid
  }

  const parsed = eventSchema.parse(await request.json());

  const result = await prisma.$transaction(async (tx) => {
    const plan = await tx.plan.upsert({
      where: { code: parsed.planCode },
      update: { isActive: true },
      create: { code: parsed.planCode, name: parsed.planCode, isActive: true },
    });

    const user = await tx.user.upsert({
      where: { email: parsed.userEmail },
      update: {},
      create: {
        email: parsed.userEmail,
        passwordHash: "BILLING_ONLY_PLACEHOLDER",
        role: UserRole.STUDENT,
      },
    });

    const entitlement = await tx.entitlement.create({
      data: {
        userId: user.id,
        planId: plan.id,
        status: parsed.status as EntitlementStatus,
        startAt: parsed.startAt ? new Date(parsed.startAt) : new Date(),
        endAt: parsed.endAt ? new Date(parsed.endAt) : null,
      },
    });

    const admin = await tx.user.findFirst({ where: { role: UserRole.ADMIN }, select: { id: true } });
    await tx.auditLog.create({
      data: {
        actorUserId: admin?.id ?? user.id,
        actionType: "BILLING_EVENT_RECEIVED",
        targetType: "Entitlement",
        targetId: entitlement.id,
        metadataJson: {
          actorUserId,
          eventType: parsed.eventType,
          userEmail: parsed.userEmail,
          planCode: parsed.planCode,
          status: parsed.status,
        },
      },
    });

    return { userId: user.id, entitlementId: entitlement.id };
  });

  return NextResponse.json({ ok: true, ...result });
}
