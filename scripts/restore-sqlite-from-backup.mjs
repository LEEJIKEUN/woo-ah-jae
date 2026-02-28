import { copyFileSync, existsSync, readdirSync } from "node:fs";
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

const backupDir = process.env.DB_BACKUP_DIR || "/var/data/backups";
const explicit = process.argv[2];
const dbPath = resolveSqlitePath();

if (!existsSync(backupDir)) {
  throw new Error(`[restore] backup dir not found: ${backupDir}`);
}

const backups = readdirSync(backupDir)
  .filter((name) => name.endsWith(".db"))
  .sort();

if (backups.length === 0) {
  throw new Error(`[restore] no backup files found in: ${backupDir}`);
}

const fileName = explicit || backups[backups.length - 1];
const source = path.join(backupDir, fileName);
if (!existsSync(source)) {
  throw new Error(`[restore] backup file not found: ${source}`);
}

copyFileSync(source, dbPath);
console.log(`[restore] restored ${source} -> ${dbPath}`);
