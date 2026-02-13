
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Fetching Questionnaires...");

    const questionnaires = await prisma.questionnaire.findMany({
        take: 10,
        orderBy: { updatedAt: 'desc' },
        include: {
            questions: true,
            fiEngagement: {
                include: {
                    clientLE: true,
                    org: true
                }
            },
            ownerOrg: true
        }
    });

    console.log(`Found ${questionnaires.length} questionnaires.`);

    for (const q of questionnaires) {
        console.log(`\nQuestionnaire: ${q.name} (ID: ${q.id})`);
        console.log(`  - Status: ${q.status}`);
        console.log(`  - Questions: ${q.questions.length}`);

        if (q.fiEngagement) {
            console.log(`  - Linked to Engagement: ${q.fiEngagement.id}`);
            console.log(`    - ClientLE: ${q.fiEngagement.clientLE.name} (${q.fiEngagement.clientLE.id})`);
            console.log(`    - FI Org: ${q.fiEngagement.org.name}`);
        } else {
            console.log(`  - NOT Linked to Engagement (Template?)`);
        }

        if (q.ownerOrg) {
            console.log(`  - Owner Org: ${q.ownerOrg.name}`);
        }

        // Check first few questions for mapping
        if (q.questions.length > 0) {
            console.log("  - Sample Questions:");
            q.questions.slice(0, 3).forEach((ques: any) => {
                console.log(`    - [${ques.status}] ${ques.text.substring(0, 50)}...`);
                console.log(`      (MasterField: ${ques.masterFieldNo}, Group: ${ques.masterQuestionGroupId})`);
            });
        }
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
