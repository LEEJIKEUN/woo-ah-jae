import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

if (process.env.NODE_ENV === "production" && process.env.ALLOW_DESTRUCTIVE_ADMIN_SCRIPT !== "true") {
  throw new Error(
    "[safety-lock] purge-sample-projects is blocked in production. Set ALLOW_DESTRUCTIVE_ADMIN_SCRIPT=true only for explicit maintenance."
  );
}

async function main() {
  const before = await prisma.project.count();

  const result = await prisma.project.deleteMany({
    where: {
      OR: [
        { likeCount: { gt: 0 } },
        { commentCount: { gt: 0 } },
        { popularityScore: { gt: 0 } },
      ],
    },
  });

  const after = await prisma.project.count();

  console.log(JSON.stringify({
    deleted: result.count,
    before,
    after,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
