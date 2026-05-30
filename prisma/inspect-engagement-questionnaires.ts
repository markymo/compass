import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ENGAGEMENT_ID = 'a04acebc-f585-4405-9a42-f536160a7399';

async function main() {
    const engagement = await prisma.fIEngagement.findUnique({
        where: { id: ENGAGEMENT_ID },
        include: {
            // Relation 1: "QuestionnaireInstance" — Questionnaires with fiEngagementId FK pointing here
            questionnaireInstances: {
                select: { id: true, name: true, status: true, isDeleted: true, isTemplate: true, fiEngagementId: true, createdAt: true, updatedAt: true }
            },
            // Relation 2: "FIEngagementToQuestionnaire" — many-to-many join table
            questionnaires: {
                select: { id: true, name: true, status: true, isDeleted: true, isTemplate: true, fiEngagementId: true, createdAt: true, updatedAt: true }
            },
        }
    });

    if (!engagement) {
        console.log('Engagement not found');
        return;
    }

    console.log('=== ENGAGEMENT ===');
    console.log(`ID: ${engagement.id}`);
    console.log(`Status: ${engagement.status}`);

    console.log('\n=== questionnaireInstances (FK: Questionnaire.fiEngagementId) ===');
    console.log(`Count: ${engagement.questionnaireInstances.length}`);
    engagement.questionnaireInstances.forEach((q: any) => {
        console.log(`  [${q.id}] "${q.name}" | status=${q.status} | isDeleted=${q.isDeleted} | isTemplate=${q.isTemplate} | fiEngagementId=${q.fiEngagementId}`);
    });

    console.log('\n=== questionnaires (many-to-many join) ===');
    console.log(`Count: ${engagement.questionnaires.length}`);
    engagement.questionnaires.forEach((q: any) => {
        console.log(`  [${q.id}] "${q.name}" | status=${q.status} | isDeleted=${q.isDeleted} | isTemplate=${q.isTemplate} | fiEngagementId=${q.fiEngagementId}`);
    });

    // Find IDs in both sets
    const instanceIds = new Set(engagement.questionnaireInstances.map((q: any) => q.id));
    const m2mIds = new Set(engagement.questionnaires.map((q: any) => q.id));
    const overlap = [...instanceIds].filter(id => m2mIds.has(id));

    console.log('\n=== OVERLAP (IDs in BOTH relations — these cause duplicates) ===');
    console.log(`Count: ${overlap.length}`);
    overlap.forEach(id => console.log(`  ${id}`));

    // Show what the combined deduplicated list looks like
    const combined = Array.from(
        new Map(
            [...engagement.questionnaireInstances, ...engagement.questionnaires].map((item: any) => [item.id, item])
        ).values()
    );
    console.log('\n=== COMBINED (after Map dedup — what the UI shows) ===');
    console.log(`Count: ${combined.length}`);
    combined.forEach((q: any) => {
        console.log(`  [${q.id}] "${q.name}" | status=${q.status} | isDeleted=${q.isDeleted}`);
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
