import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function syncQuestionsToDatabase(
    id: string,
    items: any[],
    userId: string | null = null,
    db: Prisma.TransactionClient | typeof prisma = prisma
) {
    // 1. Delete existing questions for this questionnaire (Template Mode)
    await db.question.deleteMany({
        where: { questionnaireId: id }
    });

    const qn = await db.questionnaire.findUnique({
        where: { id },
        select: { kind: true, fiEngagementId: true }
    });
    const isEngagementQ = qn?.kind === "ENGAGEMENT_QUESTIONNAIRE" && qn?.fiEngagementId != null;
    const now = new Date();

    // 2. Filter for Questions only
    const questionsToCreate = items
        .filter((i: any) => (i.type || "").toLowerCase() === "question")
        .map((item: any, index: any) => ({
            questionnaireId: id,
            text: item.text || item.originalText || "Untitled Question",
            compactText: item.compactText || null,
            order: item.order || index + 1,
            status: isEngagementQ ? ("SHARED" as any) : ("DRAFT" as any),
            sharedAt: isEngagementQ ? now : null,
            sharedByUserId: isEngagementQ ? userId : null,
            // Persist Mapping
            masterFieldNo: item.masterFieldNo || null,
            masterQuestionGroupId: item.masterQuestionGroupId || null,
            customFieldDefinitionId: item.customFieldDefinitionId || null,
            masterFieldProjectionPath: item.masterFieldProjectionPath || null,
            approvedMappingConfig: item.approvedMappingConfig ? JSON.parse(JSON.stringify(item.approvedMappingConfig)) : null,
            expectedDataType: item.expectedDataType || "TEXT",
            prefilledValue: item.prefilledValue || null,
            answer: item.answer || null,
            allowAttachments: true
        }));

    if (questionsToCreate.length > 0) {
        await db.question.createMany({
            data: questionsToCreate
        });
    }
}
