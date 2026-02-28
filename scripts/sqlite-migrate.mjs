import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const schemaDir = path.join(root, "prisma");

function resolveSqlitePath() {
  const raw = process.env.DATABASE_URL || "file:./dev.db";
  if (!raw.startsWith("file:")) {
    throw new Error(`Only sqlite file DATABASE_URL is supported by this script. Received: ${raw}`);
  }

  const filePart = raw.slice("file:".length);
  if (!filePart) {
    throw new Error("DATABASE_URL file path is empty");
  }

  // Prisma resolves relative sqlite paths from schema directory.
  if (path.isAbsolute(filePart)) {
    return filePart;
  }

  return path.resolve(schemaDir, filePart);
}

const dbPath = resolveSqlitePath();
const migrationsDir = path.join(root, "prisma", "migrations");

if (process.env.RENDER && !dbPath.startsWith("/var/data/")) {
  throw new Error(
    `[db-safety] Render에서는 영속 DB 경로(/var/data)만 허용됩니다. 현재: ${dbPath}`
  );
}

mkdirSync(path.dirname(dbPath), { recursive: true });
mkdirSync(migrationsDir, { recursive: true });

function runSql(sql) {
  const escaped = sql.replace(/"/g, '""');
  return execSync(`sqlite3 ${JSON.stringify(dbPath)} "${escaped}"`, { encoding: "utf-8" });
}

function applyFile(filePath) {
  execSync(`sqlite3 ${JSON.stringify(dbPath)} < ${JSON.stringify(filePath)}`, {
    stdio: "inherit",
    shell: true,
  });
}

runSql(
  "CREATE TABLE IF NOT EXISTS _codex_migrations (name TEXT PRIMARY KEY, appliedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);"
);

const appliedRows = runSql("SELECT name FROM _codex_migrations;")
  .split("\n")
  .map((v) => v.trim())
  .filter(Boolean);
const applied = new Set(appliedRows);

const migrationNames = readdirSync(migrationsDir)
  .filter((name) => !name.startsWith("."))
  .filter((name) => existsSync(path.join(migrationsDir, name, "migration.sql")))
  .sort();

const hasUserTable = runSql("SELECT name FROM sqlite_master WHERE type='table' AND name='User';").trim() === "User";

for (const name of migrationNames) {
  if (applied.has(name)) continue;

  const numericPrefix = Number(name.split("_")[0]);
  if (!Number.isNaN(numericPrefix) && numericPrefix < 3) {
    console.log(`Skip legacy migration: ${name}`);
    runSql(`INSERT INTO _codex_migrations (name) VALUES ('${name.replace(/'/g, "''")}');`);
    continue;
  }

  const filePath = path.join(migrationsDir, name, "migration.sql");
  const preview = readFileSync(filePath, "utf-8").trim();
  if (!preview) {
    console.log(`Skip empty migration: ${name}`);
    runSql(`INSERT INTO _codex_migrations (name) VALUES ('${name.replace(/'/g, "''")}');`);
    continue;
  }

  // Legacy PostgreSQL migrations are kept for history but are not executable on SQLite.
  if (preview.includes("CREATE TYPE") || preview.includes("ALTER TABLE") && preview.includes("ADD CONSTRAINT")) {
    console.log(`Skip non-SQLite migration: ${name}`);
    runSql(`INSERT INTO _codex_migrations (name) VALUES ('${name.replace(/'/g, "''")}');`);
    continue;
  }

  if (name === "0003_mvp_project_application_flow" && hasUserTable) {
    console.log(`Skip baseline migration on existing DB: ${name}`);
    runSql(`INSERT INTO _codex_migrations (name) VALUES ('${name.replace(/'/g, "''")}');`);
    continue;
  }

  console.log(`Applying migration: ${name}`);
  applyFile(filePath);
  runSql(`INSERT INTO _codex_migrations (name) VALUES ('${name.replace(/'/g, "''")}');`);
}

console.log("SQLite migrations applied.");
