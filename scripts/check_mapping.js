const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Checking Questionnaire 27e2594a-4d53-44b1-80a9-bcf08ddb8100...");
    const questionnaire = await prisma.questionnaire.findUnique({
        where: { id: '27e2594a-4d53-44b1-80a9-bcf08ddb8100' },
        include: { questions: true }
    });
    
    if (!questionnaire) {
        console.log("Questionnaire not found!");
        return;
    }
    
    console.log("Questions:");
    questionnaire.questions.forEach(q => {
        console.log(`- ID: ${q.id}, Text: ${q.text}, MasterFieldNo: ${q.masterFieldNo}, MasterQuestionGroupId: ${q.masterQuestionGroupId}`);
    });
    
    console.log("\nChecking Engagement / Questionnaire Instance for LE b8bfc0b8-c3cf-4ff6-81e5-98429f7cd49e...");
    const engagements = await prisma.fIEngagement.findMany({
        where: { clientLEId: 'b8bfc0b8-c3cf-4ff6-81e5-98429f7cd49e' },
        include: {
            questionnaires: true,
            questionnaireInstances: {
                include: { questions: true }
            }
        }
    });
    
    for (const eng of engagements) {
        const instances = eng.questionnaireInstances.filter(qi => 
            qi.fileName === questionnaire.name || qi.id === questionnaire.id || qi.ownerOrgId === questionnaire.ownerOrgId
        ); // Need to see if there's a link
        
        console.log(`Engagement: ${eng.id}, Instances count: ${eng.questionnaireInstances.length}`);
        eng.questionnaireInstances.forEach(qi => {
            console.log(`  Instance: ${qi.id} (${qi.name}) - parent: ${qi.ownerOrgId}`);
            if (qi.name === questionnaire.name) {
                console.log("    Questions in instance:");
                qi.questions.forEach(q => {
                    console.log(`      - ID: ${q.id}, Text: ${q.text}, MasterFieldNo: ${q.masterFieldNo}, Group: ${q.masterQuestionGroupId}`);
                });
            }
        });
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
