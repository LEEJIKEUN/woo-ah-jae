#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const APPROVAL_FILE = path.resolve(".deploy-approval.json");

function getHeadSha() {
  return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
}

function getBranch() {
  return execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8" }).trim();
}

function getDirty() {
  const out = execSync("git status --porcelain", { encoding: "utf8" }).trim();
  return out.length > 0;
}

function readApproval() {
  if (!fs.existsSync(APPROVAL_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(APPROVAL_FILE, "utf8"));
  } catch {
    return null;
  }
}

function writeApproval(data) {
  fs.writeFileSync(APPROVAL_FILE, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function clearApproval() {
  if (fs.existsSync(APPROVAL_FILE)) {
    fs.unlinkSync(APPROVAL_FILE);
  }
}

function parseArg(name, fallback = null) {
  const idx = process.argv.indexOf(name);
  if (idx === -1 || idx + 1 >= process.argv.length) return fallback;
  return process.argv[idx + 1];
}

function cmdAllow() {
  const reason = parseArg("--reason", "manual-confirm");
  const minsRaw = parseArg("--minutes", "30");
  const minutes = Number(minsRaw);
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 240) {
    throw new Error("--minutes must be between 1 and 240");
  }

  const branch = getBranch();
  if (branch !== "main") {
    throw new Error(`allow is only supported on main (current: ${branch})`);
  }

  const sha = getHeadSha();
  const now = Date.now();
  const expiresAt = now + minutes * 60 * 1000;

  writeApproval({
    approvedAt: new Date(now).toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
    reason,
    branch,
    sha,
  });

  console.log(`[release-guard] ALLOW saved for sha ${sha} (expires in ${minutes}m)`);
}

function cmdStatus() {
  const approval = readApproval();
  const sha = getHeadSha();
  const branch = getBranch();
  if (!approval) {
    console.log("[release-guard] status: LOCKED (no approval file)");
    return;
  }

  const now = Date.now();
  const exp = Date.parse(approval.expiresAt || "");
  const expired = !Number.isFinite(exp) || exp < now;
  const shaMismatch = approval.sha !== sha;
  const branchMismatch = approval.branch !== branch;

  console.log("[release-guard] status:");
  console.log(`  branch=${branch}, head=${sha}`);
  console.log(`  approvedBranch=${approval.branch}, approvedSha=${approval.sha}`);
  console.log(`  approvedAt=${approval.approvedAt}, expiresAt=${approval.expiresAt}`);
  console.log(`  reason=${approval.reason || "(none)"}`);
  console.log(`  dirty=${getDirty()}`);
  console.log(`  valid=${!expired && !shaMismatch && !branchMismatch}`);
}

function cmdVerifyPush() {
  const approval = readApproval();
  const branch = getBranch();
  const sha = getHeadSha();

  if (branch !== "main") {
    // only gate main
    process.exit(0);
  }

  if (!approval) {
    console.error("[release-guard] PUSH BLOCKED: no deploy approval.");
    console.error("Run: npm run release:allow -- --reason \"deploy note\"");
    process.exit(1);
  }

  const exp = Date.parse(approval.expiresAt || "");
  if (!Number.isFinite(exp) || exp < Date.now()) {
    console.error("[release-guard] PUSH BLOCKED: deploy approval expired.");
    console.error("Run: npm run release:allow -- --reason \"deploy note\"");
    process.exit(1);
  }

  if (approval.branch !== branch) {
    console.error(`[release-guard] PUSH BLOCKED: approval branch mismatch (${approval.branch} != ${branch}).`);
    process.exit(1);
  }

  if (approval.sha !== sha) {
    console.error("[release-guard] PUSH BLOCKED: HEAD changed after approval.");
    console.error(`approved=${approval.sha}`);
    console.error(`current=${sha}`);
    console.error("Re-run: npm run release:allow -- --reason \"updated commit\"");
    process.exit(1);
  }

  console.log(`[release-guard] PUSH ALLOWED for ${sha}`);
}

function cmdInstallHook() {
  const hookDir = path.resolve(".githooks");
  const hookFile = path.join(hookDir, "pre-push");
  fs.mkdirSync(hookDir, { recursive: true });
  fs.writeFileSync(
    hookFile,
    "#!/usr/bin/env sh\nnode scripts/release-guard.mjs verify-push\n",
    "utf8",
  );
  fs.chmodSync(hookFile, 0o755);
  execSync("git config core.hooksPath .githooks");
  console.log("[release-guard] Installed pre-push hook and set core.hooksPath=.githooks");
}

function cmdClear() {
  clearApproval();
  console.log("[release-guard] Approval cleared.");
}

const cmd = process.argv[2];

try {
  switch (cmd) {
    case "allow":
      cmdAllow();
      break;
    case "status":
      cmdStatus();
      break;
    case "verify-push":
      cmdVerifyPush();
      break;
    case "install-hook":
      cmdInstallHook();
      break;
    case "clear":
      cmdClear();
      break;
    default:
      console.log("Usage:");
      console.log("  node scripts/release-guard.mjs install-hook");
      console.log("  node scripts/release-guard.mjs allow --reason \"...\" [--minutes 30]");
      console.log("  node scripts/release-guard.mjs status");
      console.log("  node scripts/release-guard.mjs clear");
      console.log("  node scripts/release-guard.mjs verify-push");
      process.exit(1);
  }
} catch (error) {
  console.error(`[release-guard] FAIL: ${error.message}`);
  process.exit(1);
}
