import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkNoc() {
  const fields = await prisma.fieldClaim.findMany({
    where: { 
        fieldNo: 62,
        valueJson: {
            path: ['natureOfControl'],
            not: 'null' // This is just to see if we can find it
        }
    },
    take: 10,
    orderBy: { assertedAt: 'desc' }
  });
  
  console.log(`Found ${fields.length} fields with natureOfControl in root`);
  
  // also let's just fetch ALL field 62 for a specific LE and inspect them.
  const all62 = await prisma.fieldClaim.findMany({
      where: { fieldNo: 62 },
      take: 20
  });
  let foundNoc = 0;
  for (const f of all62) {
      const v = f.valueJson as any;
      if (v && v.natureOfControl) foundNoc++;
      if (v && v.natures_of_control) foundNoc++;
      if (v && v.roles && v.roles.length > 0 && v.roles[0].natureOfControl) foundNoc++;
  }
  console.log(`Found ${foundNoc} fields with natureOfControl anywhere in 20 samples`);
  
  // print a full sample of one with natureOfControl if possible
  const withNoc = all62.find(f => {
      const v = f.valueJson as any;
      return v && (v.natureOfControl || v.natures_of_control || (v.roles && v.roles[0]?.natureOfControl));
  });
  if (withNoc) {
      console.log("Sample with NoC:");
      console.log(JSON.stringify(withNoc.valueJson, null, 2));
  } else {
      console.log("No sample with NoC found in the 20.");
  }
}

checkNoc().catch(console.error).finally(() => prisma.$disconnect());
