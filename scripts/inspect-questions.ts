import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Find a Client LE
    const le = await prisma.clientLE.findFirst({
        include: {
            fiEngagements: {
                include: {
                    questionnaireInstances: {
                        include: {
                            questions: true
                        }
                    }
                }
            }
        }
    });

    if (!le) {
        console.log("No Client LE found.");
        return;
    }

    console.log(`Checking LE: ${le.name} (${le.id})`);

    let totalQuestions = 0;
    let mappedQuestions = 0;

    for (const eng of le.fiEngagements) {
        console.log(`Engagement: ${eng.id}`);
        for (const qi of eng.questionnaireInstances) {
            console.log(`  Questionnaire: ${qi.questionnaireId}`);
            for (const q of qi.questions) {
                totalQuestions++;
                // @ts-ignore
                const isMapped = q.masterFieldNo || q.masterQuestionGroupId;
                if (isMapped) mappedQuestions++;
                // @ts-ignore
                console.log(`    Q: ${q.text.substring(0, 30)}... | FieldNo: ${q.masterFieldNo} | Group: ${q.masterQuestionGroupId}`);
            }
        }
    }

    console.log(`Total Questions: ${totalQuestions}`);
    console.log(`Mapped Questions: ${mappedQuestions}`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
