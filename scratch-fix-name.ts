import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const clientLEs = await prisma.clientLE.findMany({
      include: { legalEntity: true }
  });
  
  for (const clientLE of clientLEs) {
      if (clientLE.legalEntity && !clientLE.legalEntity.name && clientLE.name) {
          await prisma.legalEntity.update({
              where: { id: clientLE.legalEntity.id },
              data: { name: clientLE.name }
          });
          console.log(`Updated LegalEntity ${clientLE.legalEntity.id} name to: ${clientLE.name}`);
      }
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
