import prisma from './src/lib/prisma';
async function main() {
  const field = await prisma.masterFieldDefinition.findUnique({ where: { fieldNo: 63 } });
  console.log(field?.profileConfig);
}
main();
