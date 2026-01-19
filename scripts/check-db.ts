
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const qCount = await prisma.question.count();
  const tmplCount = await prisma.questionnaire.count({ where: { fiEngagementId: null } });
  const instCount = await prisma.questionnaire.count({ where: { fiEngagementId: { not: null } } });
  console.log('Total Questions:', qCount);
  console.log('Templates:', tmplCount);
  console.log('Instances:', instCount);
  
  // Check statuses
  const statuses = await prisma.question.groupBy({
    by: ['status'],
    _count: true
  });
  console.log('Statuses:', statuses);
}
main().catch(console.error).finally(() => prisma.$disconnect());

