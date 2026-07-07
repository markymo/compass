import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
    const questions = await prisma.question.findMany({
        where: {
            text: {
                contains: 'LEGAL REGISTERED ADDRESS',
                mode: 'insensitive'
            }
        },
        include: { questionnaire: { include: { fiEngagement: { include: { clientLE: true } } } } }
    });
    
    console.log(`Found ${questions.length} questions matching "LEGAL REGISTERED ADDRESS".`);
    for (const q of questions) {
        console.log(`\n--- Q: ${q.id} (Order: ${q.order}) ---`);
        console.log(`Questionnaire: ${q.questionnaire.name}`);
        console.log(`masterFieldNo: ${q.masterFieldNo}, masterGroup: ${q.masterQuestionGroupId}`);
        console.log(`proj: ${q.masterFieldProjectionPath}`);
        console.log(`Subject LE ID: ${q.questionnaire.fiEngagement?.clientLE?.legalEntityId}`);
    }

    const mfs = await prisma.masterFieldDefinition.findMany({
        where: {
            fieldName: {
                contains: 'REGISTERED ADDRESS',
                mode: 'insensitive'
            }
        }
    });
    console.log(`\n--- MASTER FIELDS MATCHING "REGISTERED ADDRESS" ---`);
    for (const mf of mfs) {
        console.log(`fieldNo: ${mf.fieldNo}, name: ${mf.fieldName}, type: ${mf.appDataType}`);
    }
}
run().finally(() => prisma.$disconnect());
