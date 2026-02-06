
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debugEngagementQuestions(engagementId: string) {
    console.log(`Inspecting Engagement: ${engagementId}`);

    const engagement = await prisma.fIEngagement.findUnique({
        where: { id: engagementId },
        include: {
            questionnaires: {
                include: {
                    questions: true
                }
            },
            questionnaireInstances: {
                include: {
                    questions: true
                }
            }
        }
    });

    if (!engagement) {
        console.log("Engagement not found");
        return;
    }

    console.log("--- Template Questionnaires ---");
    engagement.questionnaires.forEach(q => {
        console.log(`Questionnaire: ${q.name} (${q.id})`);
        q.questions.forEach(question => {
            console.log(`  Question: ${question.text.substring(0, 50)}...`);
            console.log(`    Status: ${question.status}`);
            console.log(`    IsLocked: ${question.isLocked}`);
            console.log(`    Answer Length: ${question.answer?.length || 0}`);
            console.log(`    Answer: ${question.answer ? question.answer.substring(0, 20) + "..." : "NULL"}`);
        });
    });

    console.log("--- Instance Questionnaires ---");
    engagement.questionnaireInstances.forEach(q => {
        console.log(`Questionnaire: ${q.name} (${q.id})`);
        q.questions.forEach(question => {
            console.log(`  Question: ${question.text.substring(0, 50)}...`);
            console.log(`    Status: ${question.status}`);
            console.log(`    IsLocked: ${question.isLocked}`);
            console.log(`    Answer Length: ${question.answer?.length || 0}`);
            console.log(`    Answer: ${question.answer ? question.answer.substring(0, 20) + "..." : "NULL"}`);
        });
    });
}

debugEngagementQuestions("69af903f-f9ef-40a2-9a16-3b96d7e7da8e")
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
