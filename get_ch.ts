import prisma from './src/lib/prisma';
async function run() {
  const le = await prisma.legalEntity.findFirst({
      where: { localRegistrationNumber: { not: null }, jurisdiction: 'GB' }
  });
  console.log(le);
}
run();
