import prisma from "@/lib/prisma";

export type DashboardMetric = {
    noData: number;
    prepopulated: number;
    systemUpdated: number;
    drafted: number; // DRAFT, INTERNAL_REVIEW
    approved: number; // CLIENT_SIGNED_OFF
    released: number; // SHARED, SUPPLIER_REVIEW, QUERY
    acknowledged: number; // SUPPLIER_SIGNED_OFF
    lastEdit: Date | null;
    targetCompletion: Date | null;
}

export function emptyMetrics(): DashboardMetric {
    return {
        noData: 0, prepopulated: 0, systemUpdated: 0,
        drafted: 0, approved: 0, released: 0, acknowledged: 0,
        lastEdit: null, targetCompletion: null
    };
}

export function rollupMetrics(parent: DashboardMetric, child: DashboardMetric) {
    parent.noData += child.noData;
    parent.prepopulated += child.prepopulated;
    parent.systemUpdated += child.systemUpdated;
    parent.drafted += child.drafted;
    parent.approved += child.approved;
    parent.released += child.released;
    parent.acknowledged += child.acknowledged;

    if (child.lastEdit) {
        if (!parent.lastEdit || child.lastEdit > parent.lastEdit) {
            parent.lastEdit = child.lastEdit;
        }
    }
}

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
        }
    });

    const m = emptyMetrics();

    // 2. Process Standard Questions
    for (const q of questions) {
        // Last Edit
        if (!m.lastEdit || q.updatedAt > m.lastEdit) {
            m.lastEdit = q.updatedAt;
        }

        const hasAnswer = q.answer && q.answer.trim().length > 0;

        // "No Data": No answer
        if (!hasAnswer) {
            m.noData++;
        }

        // Status Mapping
        switch (q.status) {
            // Internal States
            case "DRAFT":
            case "INTERNAL_REVIEW":
                // If it has answer regarding Prepop/System, we need more flags.
                // For now, simple bucket:
                m.drafted++;
                break;

            // Client Done
            case "CLIENT_SIGNED_OFF":
                m.approved++;
                break;

            // External
            case "SHARED":
            case "SUPPLIER_REVIEW":
            case "QUERY":
                m.released++;
                break;

            // Supplier Done
            case "SUPPLIER_SIGNED_OFF":
                m.acknowledged++;
                break;
        }
    }

    // 3. Process Legacy/JSON content (Fallback)
    // We need to fetch questionnaires that might NOT have Questions expanded yet
    // This is expensive if we do it for every call, but necessary for correctness during transition.
    // Optimization: Only fetch if question count is low? Or fetch Questionnaires alongside Questions above.
    // Let's keep it simple: If questions > 0, we assume migration happened.
    // If questions == 0, check for JSON blobs.

    if (questions.length === 0) {
        const questionnaires = await prisma.questionnaire.findMany({
            where: { fiEngagementId: engagementId, isDeleted: false },
            select: { extractedContent: true, updatedAt: true }
        });

        for (const q of questionnaires) {
            if (q.updatedAt && (!m.lastEdit || q.updatedAt > m.lastEdit)) {
                m.lastEdit = q.updatedAt;
            }

            if (Array.isArray(q.extractedContent)) {
                const items = q.extractedContent as any[];
                const qs = items.filter(i => (i.type || "").toLowerCase() === "question");

                for (const item of qs) {
                    const hasAns = !!item.answer;
                    if (!hasAns) m.noData++;
                    else m.drafted++; // Default to drafted for legacy JSON
                }
            }
        }
    }

    return m;
}
