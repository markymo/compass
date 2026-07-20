import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const qs = await prisma.question.findMany({
    where: { text: { contains: "Legal Form", mode: "insensitive" } }
  });
  console.log("Questions with answers:");
  for (const q of qs) {
      if (q.answer) {
          console.log(`Q ${q.id}:`, JSON.stringify(q.answer));
      }
  }
}
run().finally(() => prisma.$disconnect());
