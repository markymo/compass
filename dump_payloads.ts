import prisma from './src/lib/prisma';
async function run() {
  const payloads = await prisma.registrySourcePayload.findMany({
    take: 1
  });
  console.log("RegistrySourcePayload:", JSON.stringify(payloads, null, 2));

  const evidence = await prisma.evidenceStore.findMany({
    take: 1
  });
  console.log("EvidenceStore:", JSON.stringify(evidence, null, 2));
}
run();
