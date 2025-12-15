"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// 1. Search for Financial Institutions
export async function searchFinancialInstitutions(query: string) {
    if (!query || query.length < 2) return [];

    return await prisma.organization.findMany({
        where: {
            type: "FI",
            name: {
                contains: query,
                mode: 'insensitive'
            }
        },
        select: {
            id: true,
            name: true,
            _count: {
                select: { questionnaires: { where: { status: "ACTIVE" } } } // Show count of available forms
            }
        },
        take: 10
    });
}

// 2. Get Active Questionnaires for an FI
export async function getAvailableQuestionnaires(fiOrgId: string) {
    return await prisma.questionnaire.findMany({
        where: {
            fiOrgId,
            status: "ACTIVE"
        },
        select: {
            id: true,
            name: true,
            updatedAt: true
        }
    });
}

// 3. Add Requirement (Create Engagement + Link Questionnaires)
export async function addRequirement(clientLEId: string, fiOrgId: string, questionnaireIds: string[]) {
    try {
        // 1. Find or Create Engagement
        let engagement = await prisma.fIEngagement.findUnique({
            where: {
                fiOrgId_clientLEId: {
                    fiOrgId,
                    clientLEId
                }
            }
        });

        if (!engagement) {
            engagement = await prisma.fIEngagement.create({
                data: {
                    fiOrgId,
                    clientLEId,
                    status: "PENDING"
                }
            });
        }

        // 2. Link Questionnaires
        // We want to ADD to existing, not replace? Or is this a "Set" operation?
        // User journey: "I want to add Form B". If Form A is there, keep it?
        // Let's assume ADDITIVE for this action.

        await prisma.fIEngagement.update({
            where: { id: engagement.id },
            data: {
                questionnaires: {
                    connect: questionnaireIds.map(id => ({ id }))
                }
            }
        });

        revalidatePath(`/app/le/${clientLEId}`);
        return { success: true };

    } catch (error) {
        console.error("Failed to add requirement:", error);
        return { success: false, error: "Failed to add requirement" };
    }
}

// 4. Get Current Requirements (Engagements) for UI List
export async function getActiveEngagements(clientLEId: string) {
    return await prisma.fIEngagement.findMany({
        where: { clientLEId },
        include: {
            org: { select: { id: true, name: true } },
            questionnaires: { select: { id: true, name: true } }
        }
    });
}

// 5. Remove Requirement (Questionnaire only)
export async function removeRequirement(engagementId: string, questionnaireId: string) {
    try {
        await prisma.fIEngagement.update({
            where: { id: engagementId },
            data: {
                questionnaires: {
                    disconnect: { id: questionnaireId }
                }
            }
        });

        // Check if engagement is empty now? Maybe delete it? 
        // For now keep engagement open even if no forms.

        revalidatePath(`/app/le`); // Revalidate liberally
        return { success: true };
    } catch (e) {
        return { success: false, error: "Failed to remove" };
    }
}
