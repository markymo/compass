import { PrismaClient } from "@prisma/client";
import { fetchGLEIFData } from "../src/actions/gleif";
import { LegalEntityEnrichmentService } from "../src/domain/registry/LegalEntityEnrichmentService";

const prisma = new PrismaClient();

async function run() {
    console.log("Fetching GLEIF Data for UK LEI: 5493006MHB84DD0ZWV18");
    const lei = "5493006MHB84DD0ZWV18"; 
    const gleifResult = await fetchGLEIFData(lei);
    
    if (!gleifResult.success) {
        console.error("Failed to fetch gleif", gleifResult);
        return;
    }

    // Get an organization to attach to
    const org = await prisma.organization.findFirst({ where: { types: { has: "CLIENT" } } });
    if (!org) throw new Error("No client org found");

    console.log("Creating Client LE...");
    const gleifPayload = gleifResult.data as any;
    let nationalPayload = null;
    if (gleifPayload.nationalRegistryData) {
        nationalPayload = gleifPayload.nationalRegistryData;
        delete gleifPayload.nationalRegistryData;
    }

    let newLE = await prisma.clientLE.findUnique({ where: { lei } });
    
    if (!newLE) {
        newLE = await prisma.clientLE.create({
            data: {
                name: "Test UK Co",
                jurisdiction: "UK",
                lei: lei,
                gleifData: gleifPayload,
                gleifFetchedAt: new Date(),
                nationalRegistryData: nationalPayload,
                registryFetchedAt: nationalPayload ? new Date() : null,
                status: "ACTIVE",
                owners: {
                    create: {
                        partyId: org.id,
                        startAt: new Date()
                    }
                }
            }
        });
    }

    console.log(`Client LE Created: ${newLE.id}, Bootstrapping...`);

    const result = await LegalEntityEnrichmentService.bootstrapEntity(newLE.id);

    console.log("Bootstrap complete:", result);
}

run().catch(console.error).finally(() => prisma.$disconnect());
