import prisma from './src/lib/prisma';
async function run() {
  const q = await prisma.questionnaire.findFirst();
  if (q) {
     console.log(q.id);
  }
}
run();
