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
            case "UNMAPPED":
            case "MAPPED_DRAFT":
                // If it has answer regarding Prepop/System, we need more flags.
                // For now, simple bucket:
                m.drafted++;
                break;

            // Client Done
            case "MAPPED_APPROVED":
                m.approved++;
                break;

            // External
            case "SHARED":
                m.released++;
                break;

            // Supplier Done
            case "RELEASED":
                m.acknowledged++;
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
