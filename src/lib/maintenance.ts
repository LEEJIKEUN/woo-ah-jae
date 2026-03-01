import { MaintenanceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type MaintenanceState = {
  status: MaintenanceStatus;
  lockAt: Date | null;
  messageKor: string | null;
};

const SINGLETON_ID = "singleton";

export async function getMaintenanceState(): Promise<MaintenanceState> {
  const record = await prisma.maintenance.findUnique({ where: { id: SINGLETON_ID } });
  return {
    status: record?.status ?? MaintenanceStatus.IDLE,
    lockAt: record?.lockAt ?? null,
    messageKor: record?.messageKor ?? null,
  };
}

export async function setMaintenanceState(data: Partial<MaintenanceState> & { status: MaintenanceStatus; updatedBy?: string }) {
  return prisma.maintenance.upsert({
    where: { id: SINGLETON_ID },
    update: { ...data },
    create: {
      id: SINGLETON_ID,
      status: data.status,
      lockAt: data.lockAt ?? null,
      messageKor: data.messageKor ?? null,
      updatedBy: data.updatedBy,
    },
  });
}
