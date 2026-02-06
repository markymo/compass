import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSchema() {
  console.log("Checking DB connection and schema...");
  try {
    // 1. Create a dummy LE with LEI
    const org = await prisma.organization.findFirst();
    if (!org) {
      console.log("No organization found to attach to. skipping create.");
    } else {
      const lei = "TEST" + Date.now().toString().substring(0, 16);
      console.log(`Attempting to create LE with LEI: ${lei}`);

      try {
        const le = await prisma.clientLE.create({
          data: {
            name: "Schema Test Entity",
            jurisdiction: "TEST",
            status: "ACTIVE",
            lei: lei, // Testing the new column
            owners: {
              create: {
                partyId: org.id,
              }
            }
          }
        });
        console.log("SUCCESS: Created entity with LEI:", le.id);

        // Clean up
        await prisma.clientLE.delete({ where: { id: le.id } });
        console.log("Cleaned up test entity.");
      } catch (e) {
        console.error("FAILED to create entity with LEI.");
        // Cast error to any to access message
        const err = e;
        console.error(err);
      }
    }

    // 2. Introspect (indirectly via raw query if needed, or just relying on above)
    // trying a raw query to check columns if possible, but prisma raw is easier
    try {
      const result = await prisma.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_name = 'ClientLE' AND column_name = 'lei';`;
      console.log("Column check result:", result);
    } catch (e) {
      console.error("Failed to query information_schema", e);
    }

  } catch (error) {
    console.error("General Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSchema();
