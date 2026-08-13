import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * 회원가입 이메일 인증용 6자리 코드 저장소.
 * Neon DB(EmailVerificationCode, 이메일당 1행)에 저장 — Render 배포에도 유지된다.
 * (코드는 10분 만료·일회성. 과거엔 /var/data 파일 저장 → 배포마다 초기화됐다.)
 */
const CODE_TTL_MIN = 10;
const VERIFIED_TTL_MIN = 30; // 인증 후 이 시간 내에 가입을 완료해야 함
const RESEND_COOLDOWN_SEC = 30;
const MAX_ATTEMPTS = 5;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashCode(code: string) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

/** 오래된(코드·검증 모두 만료) 레코드 정리 — best-effort */
async function prune(now: number) {
  const codeDead = new Date(now);
  const verifyDead = new Date(now - VERIFIED_TTL_MIN * 60 * 1000);
  try {
    await prisma.emailVerificationCode.deleteMany({
      where: { expiresAt: { lt: codeDead }, OR: [{ verifiedAt: null }, { verifiedAt: { lt: verifyDead } }] },
    });
  } catch {
    /* 정리는 실패해도 무시 */
  }
}

/** 새 인증코드 발급(재발송 쿨다운 적용). 성공 시 평문 코드를 반환한다. */
export async function requestEmailCode(
  email: string
): Promise<{ code: string } | { error: string; retryAfterSec?: number }> {
  const key = normalizeEmail(email);
  const now = Date.now();

  const existing = await prisma.emailVerificationCode.findUnique({ where: { email: key }, select: { createdAt: true } });
  if (existing) {
    const sinceMs = now - existing.createdAt.getTime();
    if (sinceMs < RESEND_COOLDOWN_SEC * 1000) {
      return {
        error: "인증코드를 방금 보냈습니다. 잠시 후 다시 시도해 주세요.",
        retryAfterSec: Math.ceil((RESEND_COOLDOWN_SEC * 1000 - sinceMs) / 1000),
      };
    }
  }

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const record = {
    codeHash: hashCode(code),
    expiresAt: new Date(now + CODE_TTL_MIN * 60 * 1000),
    attempts: 0,
    verifiedAt: null as Date | null,
    createdAt: new Date(now),
  };
  await prisma.emailVerificationCode.upsert({
    where: { email: key },
    create: { email: key, ...record },
    update: record,
  });
  void prune(now);
  return { code };
}

/** 코드 검증. 성공 시 verifiedAt 을 기록한다. */
export async function verifyEmailCode(
  email: string,
  code: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const key = normalizeEmail(email);
  const now = Date.now();
  const rec = await prisma.emailVerificationCode.findUnique({ where: { email: key } });
  if (!rec) return { ok: false, error: "인증코드를 먼저 요청해 주세요." };

  if (rec.expiresAt.getTime() <= now) {
    return { ok: false, error: "인증코드가 만료되었습니다. 다시 요청해 주세요." };
  }
  if (rec.attempts >= MAX_ATTEMPTS) {
    return { ok: false, error: "시도 횟수를 초과했습니다. 코드를 다시 요청해 주세요." };
  }
  if (rec.codeHash !== hashCode(code)) {
    const updated = await prisma.emailVerificationCode.update({ where: { email: key }, data: { attempts: { increment: 1 } }, select: { attempts: true } });
    const left = Math.max(MAX_ATTEMPTS - updated.attempts, 0);
    return { ok: false, error: `인증코드가 일치하지 않습니다. (남은 시도 ${left}회)` };
  }

  await prisma.emailVerificationCode.update({ where: { email: key }, data: { verifiedAt: new Date(now) } });
  return { ok: true };
}

/** 최근(VERIFIED_TTL_MIN 이내)에 인증된 이메일인지 확인 */
export async function isEmailVerified(email: string): Promise<boolean> {
  const key = normalizeEmail(email);
  const rec = await prisma.emailVerificationCode.findUnique({ where: { email: key }, select: { verifiedAt: true } });
  if (!rec || !rec.verifiedAt) return false;
  return Date.now() - rec.verifiedAt.getTime() < VERIFIED_TTL_MIN * 60 * 1000;
}

/** 가입 완료 후 코드 레코드 제거 */
export async function clearEmailCode(email: string): Promise<void> {
  const key = normalizeEmail(email);
  await prisma.emailVerificationCode.deleteMany({ where: { email: key } });
}
