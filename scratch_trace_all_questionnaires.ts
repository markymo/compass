import prisma from "./src/lib/prisma";

async function main() {
    console.log("=== ALL QUESTIONNAIRES IN DATABASE AND THEIR LINKS ===");
    const questionnaires = await prisma.questionnaire.findMany({
        select: {
            id: true,
            name: true,
            kind: true,
            status: true,
            isDeleted: true,
            isTemplate: true,
            visibility: true,
            createdAt: true,
            updatedAt: true,
            ownerOrgId: true,
            ownerOrg: { select: { id: true, name: true } },
            fiEngagementId: true,
            fiEngagement: {
                select: {
                    id: true,
                    clientLEId: true,
                    clientLE: { select: { id: true, name: true } },
                    fiOrgId: true,
                    org: { select: { id: true, name: true } }
                }
            },
            commonForClients: {
                select: {
                    id: true,
                    name: true,
                    owners: {
                        where: { endAt: null },
                        select: { partyId: true, party: { select: { id: true, name: true } } }
                    }
                }
            }
        }
    });

    console.log(`Total Questionnaire records in DB: ${questionnaires.length}\n`);

    for (const q of questionnaires) {
        console.log(`--------------------------------------------------`);
        console.log(`ID: ${q.id}`);
        console.log(`Name: ${q.name}`);
        console.log(`Kind: ${q.kind} | Status: ${q.status} | Template: ${q.isTemplate} | Deleted: ${q.isDeleted} | Created: ${q.createdAt.toISOString()}`);
        console.log(`Owner Org: ${q.ownerOrg ? `${q.ownerOrg.name} (${q.ownerOrg.id})` : 'None'}`);
        if (q.commonForClients.length > 0) {
            console.log(`LINKED AS COMMON QUESTIONNAIRE TO CLIENT LEs:`);
            for (const le of q.commonForClients) {
                console.log(`  - ClientLE: "${le.name}" (${le.id})`);
                console.log(`    Owner Party: ${le.owners.map(o => `${o.party.name} (${o.partyId})`).join(", ")}`);
            }
        } else {
            console.log(`LINKED AS COMMON QUESTIONNAIRE TO CLIENT LEs: None`);
        }
        if (q.fiEngagement) {
            console.log(`LINKED TO ENGAGEMENT:`);
            console.log(`  - Engagement ID: ${q.fiEngagement.id}`);
            console.log(`  - ClientLE: "${q.fiEngagement.clientLE?.name}" (${q.fiEngagement.clientLEId})`);
            console.log(`  - Supplier Org: "${q.fiEngagement.org?.name}" (${q.fiEngagement.fiOrgId})`);
        } else {
            console.log(`LINKED TO ENGAGEMENT: None`);
        }
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
