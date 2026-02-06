"use server";

import { getIdentity } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getStandingDataSections(leId: string) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };
    const { userId } = identity;

    try {
        const sections = await prisma.standingDataSection.findMany({
            where: { clientLEId: leId }
        });

        // Convert array to object map for easier consumption { "CORE": "content...", "GEOGRAPHY": "..." }
        const sectionsMap: Record<string, string> = {};
        sections.forEach((section: any) => {
            sectionsMap[section.category] = section.content;
        });

        // Mocking "Recently Learned" logs for UX Demo
        // Fetch Real "Recently Learned" logs
        const logs = await prisma.usageLog.findMany({
            where: {
                userId,
                action: "AI_LEARNED"
            },
            orderBy: { createdAt: 'desc' },
            take: 20 // Fetch more, then filter
        });

        const recentLearnings = logs
            .filter(log => {
                const d = (log.details as any) || {};
                // Backwards compatibility: if log has no LE ID, maybe show it? 
                // Better to be strict: only show if matches LE ID.
                // But for "Global" logs (e.g. system usage)?
                // Let's match strictly for "AI_LEARNED" events.
                return d.clientLEId === leId;
            })
            .slice(0, 5) // Take top 5 after filter
            .map(log => {
                const details = (log.details as any) || {};
                return {
                    id: log.id,
                    fact: details.fact || "New Fact Learned",
                    source: details.source || "User Activity",
                    timestamp: log.createdAt
                };
            });

        return { success: true, data: sectionsMap, logs: recentLearnings };
    } catch (error) {
        console.error("[getStandingDataSections]", error);
        return { success: false, error: "Failed to fetch standing data" };
    }
}

export async function updateStandingDataSection(leId: string, category: string, content: string) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };
    const { userId } = identity;

    try {
        const section = await prisma.standingDataSection.upsert({
            where: {
                clientLEId_category: {
                    clientLEId: leId,
                    category: category
                }
            },
            update: {
                content: content
            },
            create: {
                clientLEId: leId,
                category: category,
                content: content
            }
        });

        revalidatePath(`/app/le/${leId}/v2`);
        return { success: true, data: section };
    } catch (error: any) {
        console.error("[updateStandingDataSection]", error);
        return { success: false, error: error.message || "Failed to update section" };
    }
}
