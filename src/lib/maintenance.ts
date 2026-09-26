import { MaintenanceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type MaintenanceState = {
  status: MaintenanceStatus;
  lockAt: Date | null;
  messageKor: string | null;
};

const SINGLETON_ID = "singleton";

// In-memory cache. The middleware runs this on nearly every request; without a
// cache that meant a DB query per request (page loads, API calls, 2–4s polls),
// which kept the Neon compute from ever scaling to zero. Maintenance state
// changes very rarely, so a short TTL is invisible operationally, and
// setMaintenanceState() clears it so admin toggles still take effect at once.
const CACHE_TTL_MS = 30_000;
let cached: { state: MaintenanceState; at: number } | null = null;

export async function getMaintenanceState(): Promise<MaintenanceState> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.state;
  const record = await prisma.maintenance.findUnique({ where: { id: SINGLETON_ID } });
  const state: MaintenanceState = {
    status: record?.status ?? MaintenanceStatus.IDLE,
    lockAt: record?.lockAt ?? null,
    messageKor: record?.messageKor ?? null,
  };
  cached = { state, at: Date.now() };
  return state;
}

export async function setMaintenanceState(data: Partial<MaintenanceState> & { status: MaintenanceStatus; updatedBy?: string }) {
  const result = await prisma.maintenance.upsert({
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
  cached = null; // bust so the change is reflected on the very next read
  return result;
}
