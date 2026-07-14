import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const enumsToAdd = ['LEVEL_1', 'LEVEL_2_RELATIONSHIPS', 'ELF'];
  for (const e of enumsToAdd) {
    try {
      await prisma.$executeRawUnsafe(`ALTER TYPE "PayloadSubtype" ADD VALUE '${e}';`);
      console.log(`Added ${e}`);
    } catch (err: any) {
      if (err.message.includes('already exists')) {
        console.log(`${e} already exists`);
      } else {
        console.error(`Error adding ${e}:`, err.message);
      }
    }
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
