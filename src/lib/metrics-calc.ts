import prisma from "@/lib/prisma";
import { DashboardMetric, emptyMetrics, rollupMetrics } from "./dashboard-metrics";

export { type DashboardMetric, emptyMetrics, rollupMetrics };

export async function calculateEngagementMetrics(engagementId: string): Promise<DashboardMetric> {
    // 1. Get Questions via Questionnaire linked to Engagement
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

    const m = emptyMetrics();

    // 1b. Fetch active field claims and custom data for the LE to resolve dynamic answers for mapped questions
    const engagement = await prisma.fIEngagement.findUnique({
        where: { id: engagementId },
        include: {
            clientLE: {
                select: { customData: true, legalEntityId: true }
            }
        }
    });

    const activeClaims = new Set<number>();
    const activeCustomClaims = new Set<string>();

    if (engagement?.clientLE?.legalEntityId) {
        const claims = await prisma.fieldClaim.findMany({
            where: { subjectLeId: engagement.clientLE.legalEntityId, status: "VERIFIED" },
            select: { fieldNo: true }
        });
        claims.forEach(c => activeClaims.add(c.fieldNo));

        // Also track populated custom fields
        if (engagement.clientLE?.customData) {
            const data = engagement.clientLE.customData as Record<string, any>;
            for (const [key, details] of Object.entries(data)) {
                if (details && details.value !== undefined && details.value !== null && details.value !== "") {
                    activeCustomClaims.add(key);
                }
            }
        }
    }

    const groupItems = await prisma.masterFieldGroupItem.findMany({
        select: {
            groupId: true,
            fieldNo: true,
            group: {
                select: { key: true }
            }
        }
    });
    const groupHasClaim = new Map<string, boolean>();
    for (const item of groupItems) {
        if (activeClaims.has(item.fieldNo)) {
            groupHasClaim.set(item.groupId, true);
            if (item.group?.key) {
                groupHasClaim.set(item.group.key, true);
            }
        }
    }

    // 2. Process Standard Questions
    for (const q of questions) {
        m.total++;
        let hasAnswer = !!(q.answer && q.answer.trim().length > 0);
        const isMapped = q.masterFieldNo !== null || q.masterQuestionGroupId !== null || q.customFieldDefinitionId !== null;

        // Resolve dynamic answer from master data if mapped
        if (!hasAnswer) {
            if (q.masterFieldNo !== null && activeClaims.has(q.masterFieldNo)) {
                hasAnswer = true;
            } else if (q.masterQuestionGroupId !== null && groupHasClaim.get(q.masterQuestionGroupId)) {
                hasAnswer = true;
            } else if (q.customFieldDefinitionId !== null && activeCustomClaims.has(q.customFieldDefinitionId)) {
                hasAnswer = true;
            }
        }

        // "No Data": No answer
        if (!hasAnswer) {
            m.noData++;
        }

        if (isMapped) {
            m.mapped++;
            if (hasAnswer) m.answered++;
        }

        // Status Mapping
        switch (q.status) {
            case "DRAFT":
            case "APPROVED":
            case "MAPPED_APPROVED":
                m.approved++;
                break;
            case "RELEASED":
                m.released++;
                break;
        }
    }

    // 3. Process Legacy/JSON content (Fallback)
    if (questions.length === 0) {
        const questionnaires = await prisma.questionnaire.findMany({
            where: { fiEngagementId: engagementId, isDeleted: false },
            select: { extractedContent: true, updatedAt: true }
        });

        for (const q of questionnaires) {
            if (Array.isArray(q.extractedContent)) {
                const items = q.extractedContent as any[];
                const qs = items.filter(i => (i.type || "").toLowerCase() === "question");

                for (const item of qs) {
                    m.total++;
                    let hasAns = !!item.answer;
                    const isMapped = (item.masterFieldNo !== undefined && item.masterFieldNo !== null)
                        || (item.customFieldDefinitionId !== undefined && item.customFieldDefinitionId !== null);

                    if (!hasAns && isMapped) {
                        if (item.masterFieldNo !== null && activeClaims.has(item.masterFieldNo)) {
                            hasAns = true;
                        } else if (item.customFieldDefinitionId !== null && activeCustomClaims.has(item.customFieldDefinitionId)) {
                            hasAns = true;
                        }
                    }

                    if (!hasAns) m.noData++;

                    if (isMapped) {
                        m.mapped++;
                        if (hasAns) m.answered++;
                    }
                }
            }
        }
    }

    return m;
}
