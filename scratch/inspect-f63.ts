import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const claims = await prisma.fieldClaim.findMany({
    where: {
      fieldNo: 63,
    },
    select: {
      id: true,
      valueText: true,
      valueJson: true,
      subjectLeId: true,
      sourceType: true,
    },
  });

  const namedClaims = claims.filter(c => {
    if (c.valueJson === null) return false;
    const v = c.valueJson as any;
    return typeof v.surname === 'string' || typeof v.forenames === 'string';
  });

  console.log(`Found ${namedClaims.length} claims with non-null name values`);
  for (const c of namedClaims.slice(0, 10)) {
    console.log(`Claim ID: ${c.id}`);
    console.log(`- valueText type: ${typeof c.valueText}, value: ${c.valueText}`);
    console.log(`- valueJson type: ${typeof c.valueJson}`);
    console.log(`- valueJson content:`, JSON.stringify(c.valueJson));
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
