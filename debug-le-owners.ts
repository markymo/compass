
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const clientId = "d2988607-517c-4995-aa09-e733f712b059";

    console.log("--- Checking Organization ---");
    const org = await prisma.organization.findUnique({ where: { id: clientId } });
    console.log("Org:", org ? org.name : "Not Found");

    console.log("\n--- Checking ClientLEs ---");
    const allLEs = await prisma.clientLE.findMany();
    console.log(`Total ClientLEs: ${allLEs.length}`);
    allLEs.forEach(le => console.log(`- ${le.name} (${le.id})`));

    console.log("\n--- Fixing Orphaned LEs ---");
    for (const le of allLEs) {
        const existingOwner = await prisma.clientLEOwner.findFirst({
            where: {
                clientLEId: le.id,
                endAt: null // Only check active owners
            }
        });

        if (!existingOwner) {
            console.log(`Linking orphan LE: ${le.name} (${le.id}) to Org...`);
            await prisma.clientLEOwner.create({
                data: {
                    clientLEId: le.id,
                    partyId: clientId,
                    startAt: new Date(),
                }
            });
        } else if (existingOwner.partyId !== clientId) {
            console.log(`Transferring LE ${le.name} from ${existingOwner.partyId} to ${clientId}...`);
            // Close old ownership
            await prisma.clientLEOwner.update({
                where: { id: existingOwner.id },
                data: { endAt: new Date() }
            });
            // Create new ownership
            await prisma.clientLEOwner.create({
                data: {
                    clientLEId: le.id,
                    partyId: clientId,
                    startAt: new Date(),
                }
            });
        } else {
            console.log(`LE ${le.name} already linked.`);
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
