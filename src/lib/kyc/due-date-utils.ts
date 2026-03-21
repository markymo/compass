import prisma from "@/lib/prisma";

/**
 * Resolves the effective due date for a given questionnaire instance.
 * Hierarchy: Questionnaire -> FIEngagement -> ClientLE
 */
export async function getEffectiveDueDateForQuestionnaire(questionnaireId: string) {
    const questionnaire = await prisma.questionnaire.findUnique({
        where: { id: questionnaireId },
        select: {
            dueDate: true,
            fiEngagement: {
                select: {
                    dueDate: true,
                    clientLE: {
                        select: {
                            dueDate: true
                        }
                    }
                }
            }
        }
    });

    if (!questionnaire) return null;

    // 1. Check Questionnaire level
    if (questionnaire.dueDate) {
        return { date: questionnaire.dueDate, source: 'QUESTIONNAIRE' as const };
    }

    // 2. Check Engagement (Relationship) level
    if (questionnaire.fiEngagement?.dueDate) {
        return { date: questionnaire.fiEngagement.dueDate, source: 'RELATIONSHIP' as const };
    }

    // 3. Check Legal Entity level
    if (questionnaire.fiEngagement?.clientLE?.dueDate) {
        return { date: questionnaire.fiEngagement.clientLE.dueDate, source: 'LE' as const };
    }

    return null;
}

/**
 * Resolves the effective due date for a given engagement.
 * Hierarchy: FIEngagement -> ClientLE
 */
export async function getEffectiveDueDateForEngagement(engagementId: string) {
    const engagement = await prisma.fIEngagement.findUnique({
        where: { id: engagementId },
        select: {
            dueDate: true,
            clientLE: {
                select: {
                    dueDate: true
                }
            }
        }
    });

    if (!engagement) return null;

    if (engagement.dueDate) {
        return { date: engagement.dueDate, source: 'RELATIONSHIP' as const };
    }

    if (engagement.clientLE?.dueDate) {
        return { date: engagement.clientLE.dueDate, source: 'LE' as const };
    }

    return null;
}
