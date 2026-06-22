import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const q = await prisma.question.findFirst({ where: { answer: { not: null } } });
  console.log("Answer JSON type:", typeof q?.answer, "Value:", q?.answer);
}
main().catch(console.error).finally(() => prisma.$disconnect());
