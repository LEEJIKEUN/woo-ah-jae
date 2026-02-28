import "dotenv/config";

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

function isTrue(v) {
  return String(v).toLowerCase() === "true";
}

function assertSafeDefaults() {
  if (isTrue(process.env.ALLOW_DESTRUCTIVE_ADMIN_SCRIPT)) {
    throw new Error("ALLOW_DESTRUCTIVE_ADMIN_SCRIPT must be false in production");
  }
  if (isTrue(process.env.ALLOW_MEMBER_WITHDRAW_IN_PROD)) {
    throw new Error("ALLOW_MEMBER_WITHDRAW_IN_PROD must be false in production");
  }
  if (isTrue(process.env.ALLOW_DEMO_SEED_IN_PROD)) {
    throw new Error("ALLOW_DEMO_SEED_IN_PROD must be false in production");
  }
}

function validateDatabase() {
  const pooled = required("DATABASE_URL");
  const unpooled = required("DATABASE_URL_UNPOOLED");
  if (!/^postgres(ql)?:\/\//.test(pooled)) {
    throw new Error("DATABASE_URL must be a PostgreSQL URL");
  }
  if (!/^postgres(ql)?:\/\//.test(unpooled)) {
    throw new Error("DATABASE_URL_UNPOOLED must be a PostgreSQL URL");
  }
}

function validateCore() {
  required("NODE_ENV");
  required("APP_URL");
  required("NEXT_PUBLIC_APP_URL");
  required("JWT_SECRET");
  required("SUPER_ADMIN_EMAIL");
}

function validateMail() {
  required("RESEND_API_KEY");
  required("MAIL_FROM");
}

function validateStorage() {
  const backend = (process.env.STORAGE_BACKEND || "local").toLowerCase();
  if (backend !== "local" && backend !== "r2") {
    throw new Error("STORAGE_BACKEND must be either local or r2");
  }
  if (backend === "r2") {
    required("R2_ACCOUNT_ID");
    required("R2_ACCESS_KEY_ID");
    required("R2_SECRET_ACCESS_KEY");
    required("R2_BUCKET_PUBLIC");
    required("R2_BUCKET_PRIVATE");
    required("R2_PUBLIC_BASE_URL");
  }
}

try {
  validateCore();
  validateDatabase();
  validateMail();
  validateStorage();
  assertSafeDefaults();
  console.log("[ops-check] OK: production configuration looks valid.");
} catch (error) {
  console.error(`[ops-check] FAIL: ${error.message}`);
  process.exit(1);
}
