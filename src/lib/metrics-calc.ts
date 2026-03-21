import prisma from "@/lib/prisma";
import { DashboardMetric, emptyMetrics, rollupMetrics } from "./dashboard-metrics";

export { type DashboardMetric, emptyMetrics, rollupMetrics };

export async function calculateEngagementMetrics(engagementId: string): Promise<DashboardMetric> {
    const questions = await prisma.question.findMany({
        where: {
            questionnaire: {
                fiEngagementId: engagementId,
                isDeleted: false
            }
        },
        select: {
            id: true,
            status: true,
            answer: true,
            updatedAt: true,
            masterFieldNo: true,
            masterQuestionGroupId: true,
            customFieldDefinitionId: true
        }
    });

    const engagement = await prisma.fIEngagement.findUnique({
        where: { id: engagementId },
        include: {
            clientLE: {
                select: { id: true, customData: true, legalEntityId: true }
            }
        }
    });

    if (!engagement) return emptyMetrics();

    const m = await calculateMetricsFromQuestions(questions, engagement.clientLE?.legalEntityId, engagement.clientLE?.customData as any, engagement.clientLE?.id);

    // 3. Process Legacy/JSON content (Fallback) - Only if no structured questions exist
    if (questions.length === 0) {
        const questionnaires = await prisma.questionnaire.findMany({
            where: { fiEngagementId: engagementId, isDeleted: false },
            select: { extractedContent: true, updatedAt: true }
        });

        for (const q of questionnaires) {
            const extra = await calculateMetricsFromExtractedContent(q.extractedContent, engagement.clientLE?.legalEntityId, engagement.clientLE?.customData as any);
            rollupMetrics(m, extra);
        }
    }

    return m;
}

export async function calculateQuestionnaireMetrics(questionnaireId: string): Promise<DashboardMetric> {
    const questionnaire = await prisma.questionnaire.findUnique({
        where: { id: questionnaireId },
        include: {
            fiEngagement: {
                include: {
                    clientLE: {
                        select: { id: true, customData: true, legalEntityId: true }
                    }
                }
            }
        }
    });

    if (!questionnaire) return emptyMetrics();

    const questions = await prisma.question.findMany({
        where: { questionnaireId, questionnaire: { isDeleted: false } },
        select: {
            id: true,
            status: true,
            answer: true,
            updatedAt: true,
            masterFieldNo: true,
            masterQuestionGroupId: true,
            customFieldDefinitionId: true
        }
    });

    const m = await calculateMetricsFromQuestions(
        questions, 
        questionnaire.fiEngagement?.clientLE?.legalEntityId, 
        questionnaire.fiEngagement?.clientLE?.customData as any,
        questionnaire.fiEngagement?.clientLE?.id
    );

    if (questions.length === 0) {
        const extra = await calculateMetricsFromExtractedContent(
            questionnaire.extractedContent, 
            questionnaire.fiEngagement?.clientLE?.legalEntityId, 
            questionnaire.fiEngagement?.clientLE?.customData as any
        );
        rollupMetrics(m, extra);
    }

    return m;
}

async function calculateMetricsFromQuestions(questions: any[], legalEntityId?: string | null, customData?: any, clientLeId?: string | null): Promise<DashboardMetric> {
    const m = emptyMetrics();
    const { activeClaims, activeCustomClaims, groupHasClaim } = await getActiveClaimsContext(legalEntityId, customData);

    for (const q of questions) {
        m.total++;
        let hasAnswer = !!(q.answer && q.answer.trim().length > 0);
        const isMapped = q.masterFieldNo !== null || q.masterQuestionGroupId !== null || q.customFieldDefinitionId !== null;

        if (!hasAnswer && isMapped) {
            if (q.masterFieldNo !== null && activeClaims.has(q.masterFieldNo)) hasAnswer = true;
            else if (q.masterQuestionGroupId !== null && groupHasClaim.get(q.masterQuestionGroupId)) hasAnswer = true;
            else if (q.customFieldDefinitionId !== null && activeCustomClaims.has(q.customFieldDefinitionId)) hasAnswer = true;
        }

        if (!hasAnswer) m.noData++;
        if (isMapped) {
            m.mapped++;
            if (hasAnswer) m.answered++;
        }

        if (q.status === "APPROVED") m.approved++;
        else if (q.status === "RELEASED") m.released++;
    }
    return m;
}

async function calculateMetricsFromExtractedContent(extractedContent: any, legalEntityId?: string | null, customData?: any): Promise<DashboardMetric> {
    const m = emptyMetrics();
    if (!Array.isArray(extractedContent)) return m;

    const { activeClaims, activeCustomClaims } = await getActiveClaimsContext(legalEntityId, customData);
    const qs = extractedContent.filter((i: any) => (i.type || "").toLowerCase() === "question");

    for (const item of qs) {
        m.total++;
        let hasAns = !!item.answer;
        const isMapped = (item.masterFieldNo !== undefined && item.masterFieldNo !== null)
            || (item.customFieldDefinitionId !== undefined && item.customFieldDefinitionId !== null);

        if (!hasAns && isMapped) {
            if (item.masterFieldNo !== null && activeClaims.has(item.masterFieldNo)) hasAns = true;
            else if (item.customFieldDefinitionId !== null && activeCustomClaims.has(item.customFieldDefinitionId)) hasAns = true;
        }

        if (!hasAns) m.noData++;
        if (isMapped) {
            m.mapped++;
            if (hasAns) m.answered++;
        }
    }
    return m;
}

async function getActiveClaimsContext(legalEntityId?: string | null, customData?: any) {
    const activeClaims = new Set<number>();
    const activeCustomClaims = new Set<string>();
    const groupHasClaim = new Map<string, boolean>();

    if (legalEntityId) {
        const claims = await prisma.fieldClaim.findMany({
            where: { subjectLeId: legalEntityId, status: "VERIFIED" },
            select: { fieldNo: true }
        });
        claims.forEach((c: any) => activeClaims.add(c.fieldNo));

        if (customData) {
            const data = customData as Record<string, any>;
            for (const [key, details] of Object.entries(data)) {
                if (details && details.value !== undefined && details.value !== null && details.value !== "") {
                    activeCustomClaims.add(key);
                }
            }
        }

        const groupItems = await prisma.masterFieldGroupItem.findMany({
            select: { groupId: true, fieldNo: true, group: { select: { key: true } } }
        });
        for (const item of groupItems) {
            if (activeClaims.has(item.fieldNo)) {
                groupHasClaim.set(item.groupId, true);
                if (item.group?.key) groupHasClaim.set(item.group.key, true);
            }
        }
    }

    return { activeClaims, activeCustomClaims, groupHasClaim };
}
