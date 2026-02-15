const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const LE_ID = '3ad084b8-8c6e-440f-9492-8829419eeca7';

async function main() {
    console.log(`Inspecting LE: ${LE_ID}`);

    const engagements = await prisma.fIEngagement.findMany({
        where: { clientLEId: LE_ID },
        include: {
            questionnaireInstances: {
                include: {
                    questions: true
                }
            }
        }
    });

    if (engagements.length === 0) {
        console.log("No Engagements found for this LE.");
        return;
    }

    let totalQuestions = 0;
    let mappedQuestions = 0;

    for (const eng of engagements) {
        console.log(`Engagement: ${eng.id}`);
        for (const qi of eng.questionnaireInstances) {
            console.log(`  Questionnaire Instance: ${qi.id} (Template: ${qi.questionnaireId})`);
            for (const q of qi.questions) {
                totalQuestions++;
                if (q.masterFieldNo || q.masterQuestionGroupId) {
                    mappedQuestions++;
                    console.log(`    [MAPPED] Q: "${q.text.substring(0, 40)}..." -> Field: ${q.masterFieldNo} / Group: ${q.masterQuestionGroupId}`);
                } else {
                    console.log(`    [UNMAPPED] Q: "${q.text.substring(0, 40)}..."`);
                }
            }
        }
    }

    console.log(`\nSummary:`);
    console.log(`Total Questions: ${totalQuestions}`);
    console.log(`Mapped Questions: ${mappedQuestions}`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
