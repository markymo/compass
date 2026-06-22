import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const qs = await prisma.question.findMany({ take: 50 });
  const answered = qs.filter(q => q.answer !== null && q.answer !== undefined && String(q.answer) !== 'null' && String(q.answer) !== '');
  console.log("Found answered:", answered.length);
  if (answered.length > 0) {
      console.log(answered[0]);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
