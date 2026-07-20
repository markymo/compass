import { PrismaClient, Prisma } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const qs = await prisma.question.findMany({
    where: { masterFieldProjectionPath: { contains: "138" }, answer: { not: Prisma.JsonNull } },
  });
  console.log(`Found ${qs.length} answered questions with projection path containing 138.`);
}
run().finally(() => prisma.$disconnect());
