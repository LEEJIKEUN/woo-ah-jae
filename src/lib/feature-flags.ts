import { prisma } from "@/lib/prisma";

export async function isBillingEnabled() {
  const flag = await prisma.featureFlag.findUnique({
    where: { key: "billingEnabled" },
    select: { valueBool: true },
  });
  return flag?.valueBool ?? false;
}
