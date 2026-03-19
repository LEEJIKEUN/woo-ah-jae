import "dotenv/config";
import { execSync } from "node:child_process";

function getDbUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  return url;
}

function run(cmd) {
  console.log(`[prepare-db] ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

const dbUrl = getDbUrl();
if (!process.env.DATABASE_URL_UNPOOLED) {
  process.env.DATABASE_URL_UNPOOLED = dbUrl;
}

if (dbUrl.startsWith("file:")) {
  // Legacy/local SQLite path support
  run("node scripts/backup-sqlite.mjs");
  run("node scripts/sqlite-migrate.mjs");
} else if (dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://")) {
  // Postgres (Neon/Supabase/Render Postgres)
  run("npx prisma db push --skip-generate");
} else {
  throw new Error(`Unsupported DATABASE_URL scheme: ${dbUrl}`);
}

console.log("[prepare-db] done");
