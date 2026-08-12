import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * 회원가입 이메일 인증용 6자리 코드 저장소.
 * 라이브 DB에 부담을 주지 않도록 local-signup-store 와 동일하게 파일에 저장한다.
 * (코드는 10분 만료·일회성이라 파일 저장으로 충분. 서버리스 다중 인스턴스 환경으로
 *  이전 시에는 DB/KV 저장으로 교체 필요.)
 */
type EmailCodeRecord = {
  email: string;
  codeHash: string;
  expiresAt: string; // 코드 유효기간
  attempts: number; // 실패 시도 횟수
  verifiedAt: string | null; // 인증 성공 시각
  createdAt: string; // 최근 발송 시각(재발송 쿨다운 기준)
};

const CODE_TTL_MIN = 10;
const VERIFIED_TTL_MIN = 30; // 인증 후 이 시간 내에 가입을 완료해야 함
const RESEND_COOLDOWN_SEC = 30;
const MAX_ATTEMPTS = 5;

const persistentStoreDir =
  process.env.LOCAL_DATA_DIR ||
  (process.env.NODE_ENV === "production"
    ? "/var/data/local_data"
    : path.join(process.cwd(), ".local_data"));
const resolvedStorePath = path.join(persistentStoreDir, "email_codes.json");

// 프로세스 내 뮤텍스 — read-modify-write 경합(특히 시도횟수 카운터) 방지
let lock: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = lock.then(fn, fn);
  lock = run.then(() => undefined, () => undefined);
  return run;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashCode(code: string) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

async function ensureStore() {
  await fs.mkdir(persistentStoreDir, { recursive: true });
  try {
    await fs.access(resolvedStorePath);
  } catch {
    await fs.writeFile(resolvedStorePath, "[]", "utf8");
  }
}

async function readAll(): Promise<EmailCodeRecord[]> {
  await ensureStore();
  const raw = await fs.readFile(resolvedStorePath, "utf8");
  try {
    const parsed = JSON.parse(raw) as EmailCodeRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAll(items: EmailCodeRecord[]) {
  await ensureStore();
  await fs.writeFile(resolvedStorePath, JSON.stringify(items, null, 2), "utf8");
}

/** 오래된(만료·검증만료) 레코드 정리 */
function prune(items: EmailCodeRecord[], now: number) {
  return items.filter((x) => {
    const codeAlive = new Date(x.expiresAt).getTime() > now;
    const verifyAlive = x.verifiedAt && now - new Date(x.verifiedAt).getTime() < VERIFIED_TTL_MIN * 60 * 1000;
    return codeAlive || verifyAlive;
  });
}

/** 새 인증코드 발급(재발송 쿨다운 적용). 성공 시 평문 코드를 반환한다. */
export async function requestEmailCode(
  email: string
): Promise<{ code: string } | { error: string; retryAfterSec?: number }> {
  return withLock(async () => {
    const key = normalizeEmail(email);
    const now = Date.now();
    const items = await readAll();

    const existing = items.find((x) => x.email === key);
    if (existing) {
      const sinceMs = now - new Date(existing.createdAt).getTime();
      if (sinceMs < RESEND_COOLDOWN_SEC * 1000) {
        return {
          error: "인증코드를 방금 보냈습니다. 잠시 후 다시 시도해 주세요.",
          retryAfterSec: Math.ceil((RESEND_COOLDOWN_SEC * 1000 - sinceMs) / 1000),
        };
      }
    }

    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    const record: EmailCodeRecord = {
      email: key,
      codeHash: hashCode(code),
      expiresAt: new Date(now + CODE_TTL_MIN * 60 * 1000).toISOString(),
      attempts: 0,
      verifiedAt: null,
      createdAt: new Date(now).toISOString(),
    };

    const next = prune(items.filter((x) => x.email !== key), now);
    next.push(record);
    await writeAll(next);
    return { code };
  });
}

/** 코드 검증. 성공 시 verifiedAt 을 기록한다. */
export async function verifyEmailCode(
  email: string,
  code: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  return withLock(async () => {
    const key = normalizeEmail(email);
    const now = Date.now();
    const items = await readAll();
    const idx = items.findIndex((x) => x.email === key);
    if (idx < 0) return { ok: false, error: "인증코드를 먼저 요청해 주세요." };

    const rec = items[idx];
    if (new Date(rec.expiresAt).getTime() <= now) {
      return { ok: false, error: "인증코드가 만료되었습니다. 다시 요청해 주세요." };
    }
    if (rec.attempts >= MAX_ATTEMPTS) {
      return { ok: false, error: "시도 횟수를 초과했습니다. 코드를 다시 요청해 주세요." };
    }
    if (rec.codeHash !== hashCode(code)) {
      items[idx] = { ...rec, attempts: rec.attempts + 1 };
      await writeAll(items);
      const left = Math.max(MAX_ATTEMPTS - items[idx].attempts, 0);
      return { ok: false, error: `인증코드가 일치하지 않습니다. (남은 시도 ${left}회)` };
    }

    items[idx] = { ...rec, verifiedAt: new Date(now).toISOString() };
    await writeAll(items);
    return { ok: true };
  });
}

/** 최근(VERIFIED_TTL_MIN 이내)에 인증된 이메일인지 확인 */
export async function isEmailVerified(email: string): Promise<boolean> {
  const key = normalizeEmail(email);
  const items = await readAll();
  const rec = items.find((x) => x.email === key);
  if (!rec || !rec.verifiedAt) return false;
  return Date.now() - new Date(rec.verifiedAt).getTime() < VERIFIED_TTL_MIN * 60 * 1000;
}

/** 가입 완료 후 코드 레코드 제거 */
export async function clearEmailCode(email: string): Promise<void> {
  return withLock(async () => {
    const key = normalizeEmail(email);
    const items = await readAll();
    const next = items.filter((x) => x.email !== key);
    if (next.length !== items.length) await writeAll(next);
  });
}
