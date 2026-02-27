import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { VerificationStatus } from "@prisma/client";

export type LocalSignupItem = {
  id: string;
  email: string;
  passwordHash?: string;
  schoolName: string;
  grade: string;
  residenceCountry: string;
  birthDate: string;
  fileKey: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  status: VerificationStatus;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  rejectReasonCode: string | null;
  rejectReasonText: string | null;
};

const storeDir = path.join(process.cwd(), ".local_data");
const storePath = path.join(storeDir, "signup_queue.json");

async function ensureStore() {
  await fs.mkdir(storeDir, { recursive: true });
  try {
    await fs.access(storePath);
  } catch {
    await fs.writeFile(storePath, "[]", "utf8");
  }
}

async function readAll(): Promise<LocalSignupItem[]> {
  await ensureStore();
  const raw = await fs.readFile(storePath, "utf8");
  try {
    const parsed = JSON.parse(raw) as LocalSignupItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAll(items: LocalSignupItem[]) {
  await ensureStore();
  await fs.writeFile(storePath, JSON.stringify(items, null, 2), "utf8");
}

export async function createLocalSignup(
  data: Omit<
    LocalSignupItem,
    | "id"
    | "status"
    | "submittedAt"
    | "reviewedAt"
    | "reviewedBy"
    | "rejectReasonCode"
    | "rejectReasonText"
  >
) {
  const items = await readAll();
  const item: LocalSignupItem = {
    id: `local_${crypto.randomUUID()}`,
    status: VerificationStatus.PENDING_REVIEW,
    submittedAt: new Date().toISOString(),
    reviewedAt: null,
    reviewedBy: null,
    rejectReasonCode: null,
    rejectReasonText: null,
    ...data,
  };
  items.unshift(item);
  await writeAll(items);
  return item;
}

export async function listLocalSignups() {
  return readAll();
}

export async function findLocalSignupById(id: string) {
  const items = await readAll();
  return items.find((x) => x.id === id) ?? null;
}

export async function findLocalSignupByEmail(email: string) {
  const items = await readAll();
  return items.find((x) => x.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export async function setLocalSignupPasswordHash(id: string, passwordHash: string) {
  const items = await readAll();
  const idx = items.findIndex((x) => x.id === id);
  if (idx < 0) return null;
  items[idx] = { ...items[idx], passwordHash };
  await writeAll(items);
  return items[idx];
}

export async function decideLocalSignup(
  id: string,
  decision: "APPROVE" | "REJECT",
  reviewerId: string,
  rejectReasonCode?: string,
  rejectReasonText?: string
) {
  const items = await readAll();
  const idx = items.findIndex((x) => x.id === id);
  if (idx < 0) return null;

  const current = items[idx];
  if (current.status !== VerificationStatus.PENDING_REVIEW) {
    return { error: "Submission already processed" as const };
  }

  items[idx] = {
    ...current,
    status: decision === "APPROVE" ? VerificationStatus.VERIFIED : VerificationStatus.REJECTED,
    reviewedAt: new Date().toISOString(),
    reviewedBy: reviewerId,
    rejectReasonCode: decision === "REJECT" ? rejectReasonCode ?? "MANUAL_REJECT" : null,
    rejectReasonText: decision === "REJECT" ? rejectReasonText ?? "관리자 수동 반려" : null,
  };

  await writeAll(items);
  return { item: items[idx] };
}

export async function deleteLocalSignup(id: string) {
  const items = await readAll();
  const idx = items.findIndex((x) => x.id === id);
  if (idx < 0) return false;
  items.splice(idx, 1);
  await writeAll(items);
  return true;
}

export function isDbConnectionError(error: unknown) {
  const asAny = error as { code?: string; message?: string } | null;
  const msg = String(asAny?.message ?? error ?? "");
  if (asAny?.code === "P1001") return true;
  return /reach database server|P1001|ECONNREFUSED/i.test(msg);
}
