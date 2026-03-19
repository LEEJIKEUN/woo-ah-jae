import "dotenv/config";
import { spawn } from "node:child_process";

function isTrue(value) {
  return String(value).toLowerCase() === "true";
}

function run(command, args, { required = true } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env: process.env,
    });

    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve(undefined);
        return;
      }

      const detail = signal ? `signal ${signal}` : `code ${code ?? "unknown"}`;
      const message = `[startup] ${command} ${args.join(" ")} failed with ${detail}`;
      if (required) {
        reject(new Error(message));
        return;
      }
      console.warn(`${message}; continuing startup`);
      resolve(undefined);
    });

    child.on("error", (error) => {
      if (required) {
        reject(error);
        return;
      }
      console.warn(`[startup] failed to launch ${command}: ${error.message}; continuing startup`);
      resolve(undefined);
    });
  });
}

async function main() {
  const port = process.env.PORT || "10000";
  const bestEffortDbTasks = process.env.STARTUP_DB_TASKS_REQUIRED !== "true";
  const preferredDbUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

  if (process.env.DATABASE_URL_UNPOOLED) {
    process.env.DATABASE_URL = preferredDbUrl;
    console.warn("[startup] Using DATABASE_URL_UNPOOLED as the runtime database URL.");
  }

  await run("npm", ["run", "ops:check"]);

  if (isTrue(process.env.SKIP_STARTUP_DB_TASKS)) {
    console.warn("[startup] SKIP_STARTUP_DB_TASKS=true; skipping prepare/seed/guard steps.");
  } else {
    await run("node", ["scripts/prepare-db.mjs"], { required: !bestEffortDbTasks });
    await run("npm", ["run", "db:seed:if-empty"], { required: !bestEffortDbTasks });
    await run("npm", ["run", "ops:guard:prod-data"], { required: !bestEffortDbTasks });
  }

  await run("npm", ["run", "start", "--", "-p", port]);
}

main().catch((error) => {
  console.error(`[startup] fatal: ${error.message}`);
  process.exit(1);
});
