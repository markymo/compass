"use server";

import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getStandingDataSections(leId: string) {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Unauthorized" };

    try {
        const sections = await prisma.standingDataSection.findMany({
            where: { clientLEId: leId }
        });

        // Convert array to object map for easier consumption { "CORE": "content...", "GEOGRAPHY": "..." }
        const sectionsMap: Record<string, string> = {};
        sections.forEach((section: any) => {
            sectionsMap[section.category] = section.content;
        });

        return { success: true, data: sectionsMap };
    } catch (error) {
        console.error("[getStandingDataSections]", error);
        return { success: false, error: "Failed to fetch standing data" };
    }
}

export async function updateStandingDataSection(leId: string, category: string, content: string) {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Unauthorized" };

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
