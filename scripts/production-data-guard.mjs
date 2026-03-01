import { PrismaClient } from "@prisma/client";

function isTrue(value) {
  return String(value).toLowerCase() === "true";
}

async function main() {
  const isProd = process.env.NODE_ENV === "production";
  const enforce = process.env.ENFORCE_NON_EMPTY_PROD_DB !== "false";

  if (!isProd || !enforce) {
    console.log("[prod-data-guard] skip");
    return;
  }

  const allowEmpty = isTrue(process.env.ALLOW_EMPTY_PROD_DB);
  if (allowEmpty) {
    console.log("[prod-data-guard] ALLOW_EMPTY_PROD_DB=true, skip");
    return;
  }

  const prisma = new PrismaClient();
  try {
    const [userCount, projectCount, boardPostCount] = await Promise.all([
      prisma.user.count(),
      prisma.project.count(),
      prisma.boardPost.count(),
    ]);

    console.log(
      `[prod-data-guard] counts users=${userCount}, projects=${projectCount}, boardPosts=${boardPostCount}`
    );

    if (userCount === 0 && projectCount === 0 && boardPostCount === 0) {
      throw new Error(
        "Production DB appears empty. Startup blocked to prevent accidental data-loss rollout. " +
          "If this is intentional first launch, set ALLOW_EMPTY_PROD_DB=true once."
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[prod-data-guard] failed:", error.message || error);
  process.exit(1);
});

