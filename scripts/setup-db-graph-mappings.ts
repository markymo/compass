import { PrismaClient, SourceType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Adding Relational Graph Mappings for Companies House / Registration Authority...");

    const mappings = [
        // Map the Registered Address nested object to Field 120 (Registered Address Structured)
        {
            sourceType: SourceType.REGISTRATION_AUTHORITY,
            sourcePath: 'registeredAddress',
            targetFieldNo: 120, 
            transformType: 'TO_ADDRESS_OBJECT',
            confidenceDefault: 1.0,
            priority: 10,
            notes: 'Graph: Registered Address'
        },
        // Map the PSC Array to Field 62 (UBO list)
        {
            sourceType: SourceType.REGISTRATION_AUTHORITY,
            sourcePath: 'pscs', // Note: mapped off canonical payload
            targetFieldNo: 62,
            transformType: 'TO_PARTY_LIST',
            confidenceDefault: 1.0,
            priority: 10,
            notes: 'Graph: UBO List'
        },
        // Map the Officers Array to Field 63 (Director list)
        {
            sourceType: SourceType.REGISTRATION_AUTHORITY,
            sourcePath: 'officers',
            targetFieldNo: 63,
            transformType: 'TO_PARTY_LIST',
            confidenceDefault: 1.0,
            priority: 10,
            notes: 'Graph: Director List'
        }
    ];

    for (const data of mappings) {
        // Upsert based on compound uniqueness
        // Since we don't have a unique constraint, we'll findFirst and create
        const exists = await prisma.sourceFieldMapping.findFirst({
            where: {
                sourceType: data.sourceType,
                sourcePath: data.sourcePath,
                targetFieldNo: data.targetFieldNo
            }
        });

        if (!exists) {
            await prisma.sourceFieldMapping.create({
                data: {
                    ...data,
                    isActive: true,
                    createdByUserId: 'SYSTEM'
                }
            });
            console.log(`Created mapping: ${data.sourcePath} -> Field ${data.targetFieldNo}`);
        } else {
            // update it just in case
            await prisma.sourceFieldMapping.update({
                where: { id: exists.id },
                data: {
                    transformType: data.transformType,
                    isActive: true
                }
            });
            console.log(`Updated mapping: ${data.sourcePath} -> Field ${data.targetFieldNo}`);
        }
    }

    console.log("Graph Mappings Set.");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
