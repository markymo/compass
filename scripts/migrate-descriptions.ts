import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function replaceBranding(text: string | null): string | null {
    if (!text) return null;
    return text.replace(/coparity/ig, 'OnPro');
}

async function main() {
    console.log("Starting database description migration for branding change: CoParity -> OnPro");

    const filters = {
        OR: [
            { name: { contains: 'coparity', mode: 'insensitive' as any } },
            { description: { contains: 'coparity', mode: 'insensitive' as any } }
        ]
    };

    // Organizations
    const orgs = await prisma.organization.findMany({ where: filters });
    for (const org of orgs) {
        await prisma.organization.update({
            where: { id: org.id },
            data: { name: replaceBranding(org.name)!, description: replaceBranding(org.description) }
        });
        console.log(`Updated Organization ${org.id}`);
    }

    // ClientLEs
    const les = await prisma.clientLE.findMany({ where: filters });
    for (const le of les) {
        await prisma.clientLE.update({
            where: { id: le.id },
            data: { name: replaceBranding(le.name)!, description: replaceBranding(le.description) }
        });
        console.log(`Updated ClientLE ${le.id}`);
    }

    // Questionnaires
    const qs = await prisma.questionnaire.findMany({ where: filters });
    for (const q of qs) {
        await prisma.questionnaire.update({
            where: { id: q.id },
            data: { name: replaceBranding(q.name)!, description: replaceBranding(q.description) }
        });
        console.log(`Updated Questionnaire ${q.id}`);
    }
    
    // Questions
    const questions = await prisma.question.findMany({
        where: {
            OR: [
                { text: { contains: 'coparity', mode: 'insensitive' as any } },
                { compactText: { contains: 'coparity', mode: 'insensitive' as any } }
            ]
        }
    });
    for (const q of questions) {
        await prisma.question.update({
            where: { id: q.id },
            data: { text: replaceBranding(q.text)!, compactText: replaceBranding(q.compactText) }
        });
        console.log(`Updated Question ${q.id}`);
    }
    
    // MasterFieldDefinition
    const mfds = await prisma.masterFieldDefinition.findMany({
        where: {
            OR: [
                { fieldName: { contains: 'coparity', mode: 'insensitive' as any } },
                { description: { contains: 'coparity', mode: 'insensitive' as any } }
            ]
        }
    });
    for (const mfd of mfds) {
        await prisma.masterFieldDefinition.update({
            where: { fieldNo: mfd.fieldNo },
            data: { fieldName: replaceBranding(mfd.fieldName)!, description: replaceBranding(mfd.description) }
        });
        console.log(`Updated MasterFieldDefinition ${mfd.fieldNo}`);
    }
    
    // CustomFieldDefinition
    const cfds = await prisma.customFieldDefinition.findMany({
        where: {
            OR: [
                { label: { contains: 'coparity', mode: 'insensitive' as any } },
                { description: { contains: 'coparity', mode: 'insensitive' as any } }
            ]
        }
    });
    for (const cfd of cfds) {
        await prisma.customFieldDefinition.update({
            where: { id: cfd.id },
            data: { label: replaceBranding(cfd.label)!, description: replaceBranding(cfd.description) }
        });
        console.log(`Updated CustomFieldDefinition ${cfd.id}`);
    }

    console.log("Description migration complete.");
}

main()
    .catch((e) => {
        console.error("Migration failed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
