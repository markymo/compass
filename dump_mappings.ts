import prisma from './src/lib/prisma';
async function run() {
  const mappings = await prisma.sourceFieldMapping.findMany();
  console.log("Total Mappings: ", mappings.length);
  if (mappings.length > 0) {
      console.log("Sample mapping:", mappings[0]);
  }
}
run();
