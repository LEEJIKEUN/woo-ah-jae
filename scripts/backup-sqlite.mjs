import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, accessSync, constants } from "node:fs";
import path from "node:path";

function resolveSqlitePath() {
  const raw = process.env.DATABASE_URL || "file:./dev.db";
  if (!raw.startsWith("file:")) {
    throw new Error(`Only sqlite file DATABASE_URL is supported. Received: ${raw}`);
  }
  const filePart = raw.slice("file:".length);
  if (!filePart) throw new Error("DATABASE_URL file path is empty");
  if (path.isAbsolute(filePart)) return filePart;
  return path.resolve(process.cwd(), "prisma", filePart);
}

function stamp() {
  const d = new Date();
  const pad = (v) => String(v).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
}

const dbPath = resolveSqlitePath();
if (!existsSync(dbPath)) {
  console.log(`[backup] skip: db file not found (${dbPath})`);
  process.exit(0);
}

function resolveBackupDir() {
  const preferred = process.env.DB_BACKUP_DIR || "/var/data/backups";
  try {
    mkdirSync(preferred, { recursive: true });
    accessSync(preferred, constants.W_OK);
    return preferred;
  } catch {
    const fallback = path.resolve(process.cwd(), ".local_data", "backups");
    mkdirSync(fallback, { recursive: true });
    return fallback;
  }
}

const backupDir = resolveBackupDir();
const backupPath = path.join(backupDir, `dev-${stamp()}.db`);
copyFileSync(dbPath, backupPath);
console.log(`[backup] created: ${backupPath}`);

const keep = Number(process.env.DB_BACKUP_KEEP_COUNT || "30");
if (Number.isFinite(keep) && keep > 0) {
  const files = readdirSync(backupDir)
    .filter((name) => name.endsWith(".db"))
    .sort()
    .reverse();
  files.slice(keep).forEach((name) => {
    rmSync(path.join(backupDir, name), { force: true });
  });
}
