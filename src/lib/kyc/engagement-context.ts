import prisma from "@/lib/prisma";
import { KycStateService } from "@/lib/kyc/KycStateService";

export interface QuestionnaireContext {
    questionnaire: any;
    engagement: any;
    clientLE: any;
    clientLeId?: string;
    subjectLeId?: string;
    ownerScopeId?: string;
}

/**
 * Resolves the engagement context for a given questionnaire, handling both 
 * direct FI engagements and many-to-many (supplier) engagements.
 */
export async function resolveQuestionnaireContext(questionnaireId: string): Promise<QuestionnaireContext | null> {
    const questionnaire = await prisma.questionnaire.findUnique({
        where: { id: questionnaireId },
        include: {
            fiEngagement: {
                include: {
                    org: true,
                    clientLE: { include: { owners: { where: { endAt: null }, include: { party: true } } } }
                }
            },
            engagements: {
                include: {
                    org: true,
                    clientLE: { include: { owners: { where: { endAt: null }, include: { party: true } } } }
                },
                take: 1
            }
        }
    });

    if (!questionnaire) return null;

    const engagement = questionnaire.fiEngagement || questionnaire.engagements?.[0];
    const clientLE = engagement?.clientLE;
    const clientLeId = clientLE?.id;
    const subjectLeId = clientLE?.legalEntityId || undefined;
    const ownerScopeId = clientLeId ? await KycStateService.resolveScopeId(clientLeId) : undefined;

    return {
        questionnaire,
        engagement,
        clientLE,
        clientLeId,
        subjectLeId,
        ownerScopeId: ownerScopeId || undefined
    };
}
