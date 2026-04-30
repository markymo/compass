import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const clientLE = await prisma.clientLE.findUnique({
    where: { id: '3f3b592b-20e3-46c8-9eb1-9af01958f99f' },
    select: { nationalRegistryData: true }
  });
  console.log("Keys:", Object.keys(clientLE?.nationalRegistryData as any || {}));
  console.log("sic_codes:", (clientLE?.nationalRegistryData as any)?.sic_codes);
  console.log("sicCodes:", (clientLE?.nationalRegistryData as any)?.sicCodes);
  console.log("pscs:", (clientLE?.nationalRegistryData as any)?.pscs);
  console.log("persons_with_significant_control:", (clientLE?.nationalRegistryData as any)?.persons_with_significant_control);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
