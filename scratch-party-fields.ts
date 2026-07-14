import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const fields = await prisma.masterFieldDefinition.findMany({
    where: {
      appDataType: {
        in: ['PARTY', 'PARTY_REF', 'PERSON_REF', 'ORG_REF']
      }
    },
    include: {
      sourceMappings: true,
      graphBindings: true,
      optionSet: true
    }
  });

  console.log(JSON.stringify(fields, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
