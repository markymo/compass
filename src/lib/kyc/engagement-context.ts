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
 * 
 * If an explicitEngagementId is provided (e.g. for Common Questionnaires or ambiguous M2M),
 * that context is prioritized over the questionnaire's relations.
 */
export async function resolveQuestionnaireContext(
    questionnaireId: string, 
    explicitEngagementId?: string
): Promise<QuestionnaireContext | null> {
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
                }
            }
        }
    });

    if (!questionnaire) return null;

    let clientLE: any = null;
    let engagement: any = null;

    if (explicitEngagementId) {
        // Prioritize explicitly provided context
        engagement = await prisma.fIEngagement.findUnique({
            where: { id: explicitEngagementId },
            include: { org: true, clientLE: { include: { owners: { where: { endAt: null }, include: { party: true } } } } }
        });

        if (!engagement) {
            engagement = await prisma.engagement.findUnique({
                where: { id: explicitEngagementId },
                include: { org: true, clientLE: { include: { owners: { where: { endAt: null }, include: { party: true } } } } }
            });
        }
        
        clientLE = engagement?.clientLE;
    } else {
        // Fallback to legacy behavior if no explicit context is provided
        engagement = questionnaire.fiEngagement || questionnaire.engagements?.[0];
        clientLE = engagement?.clientLE;
    }

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
