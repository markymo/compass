import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Starting database migration for branding change: COPARITY -> ONPRO");

    const questionnaires = await prisma.questionnaire.findMany({
        where: {
            OR: [
                { referenceCode: { contains: 'COPARITY' } },
                { name: { contains: 'COPARITY' } }
            ]
        }
    });

    console.log(`Found ${questionnaires.length} questionnaires to update.`);

    for (const q of questionnaires) {
        const newReferenceCode = q.referenceCode ? q.referenceCode.replace('COPARITY', 'ONPRO') : null;
        const newName = q.name.replace('COPARITY', 'ONPRO');

        await prisma.questionnaire.update({
            where: { id: q.id },
            data: {
                referenceCode: newReferenceCode,
                name: newName
            }
        });

        console.log(`Updated Questionnaire ${q.id}: ${q.referenceCode} -> ${newReferenceCode}`);
    }

    console.log("Migration complete.");
}

main()
    .catch((e) => {
        console.error("Migration failed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
