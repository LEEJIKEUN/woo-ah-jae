import { EntitlementStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isBillingEnabled } from "@/lib/feature-flags";
import { HttpError } from "@/lib/guards";

export async function requireEntitlement(userId: string) {
  const billingEnabled = await isBillingEnabled();
  if (!billingEnabled) {
    return;
  }

  const active = await prisma.entitlement.findFirst({
    where: {
      userId,
      status: EntitlementStatus.ACTIVE,
    },
    include: { plan: true },
  });

  if (!active) {
    throw new HttpError(402, "Active entitlement required");
  }
}
