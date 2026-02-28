import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  try {
    const forceSeedRequested = process.env.FORCE_SEED_ON_STARTUP === "true";
    const forceSeedAllowed =
      process.env.NODE_ENV !== "production" || process.env.ALLOW_FORCE_SEED_IN_PROD === "true";
    const forceSeed = forceSeedRequested && forceSeedAllowed;
    const userCount = await prisma.user.count();

    if (forceSeed || userCount === 0) {
      console.log(`[seed-if-empty] running seed (force=${forceSeed}, userCount=${userCount})`);
      execSync("node prisma/seed.mjs", { stdio: "inherit" });
    } else {
      console.log(`[seed-if-empty] skip seed (existing users=${userCount})`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[seed-if-empty] failed:", error);
  process.exit(1);
});
