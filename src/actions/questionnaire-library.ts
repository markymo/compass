
"use server";

import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

// 1. Get questionnaires already in the LE's library
export async function getLibraryEngagements(leId: string) {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Unauthorized" };

    try {
        const engagements = await prisma.fIEngagement.findMany({
            where: { clientLEId: leId },
            include: {
                org: true,
                questionnaires: true
            },
            orderBy: { status: 'asc' }
        });
        return { success: true, data: engagements };
    } catch (error) {
        console.error("[getLibraryEngagements]", error);
        return { success: false, error: "Failed to fetch library" };
    }
}

import { extractDetailedContent } from "@/actions/questionnaire";
import { isSystemAdmin } from "@/actions/security";

// ... existing imports

// 2. Search for all active questionnaires in the system
export async function searchAvailableQuestionnaires(query: string) {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Unauthorized" };

    try {
        const isSysAdmin = await isSystemAdmin();

        // Find user's client orgs to partial match
        const userRoles = await prisma.userOrganizationRole.findMany({
            where: { userId, org: { types: { has: "CLIENT" } } },
            select: { orgId: true }
        });
        const userOrgIds = userRoles.map(r => r.orgId);

        const questionnaires = await prisma.questionnaire.findMany({
            where: {
                status: "ACTIVE",
                AND: [
                    {
                        OR: [
                            { name: { contains: query, mode: 'insensitive' } },
                            { fiOrg: { name: { contains: query, mode: 'insensitive' } } }
                        ]
                    },
                    {
                        OR: [
                            { ownerOrgId: null }, // Public System Questionnaires
                            { ownerOrgId: { in: userOrgIds } }, // Owned by my org
                            ...(isSysAdmin ? [{}] : []) // System admin sees all (hacky way to add "OR true")
                        ]
                    }
                ]
            },
            include: {
                fiOrg: true
            },
            take: 10
        });

        // Filter out if not sys admin and array logic failed (double check)
        // (Prisma OR logic above should handle it, but being safe)

        return { success: true, data: questionnaires };
    } catch (error) {
        console.error("[searchAvailableQuestionnaires]", error);
        return { success: false, error: "Search failed" };
    }
}

// 3. Link a questionnaire to an LE (Preparation Mode)
export async function linkQuestionnaireToLE(leId: string, questionnaireId: string) {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Unauthorized" };

    try {
        const questionnaire = await prisma.questionnaire.findUnique({
            where: { id: questionnaireId }
        });

        if (!questionnaire) return { success: false, error: "Questionnaire not found" };

        // Create or find engagement
        const engagement = await prisma.fIEngagement.upsert({
            where: {
                fiOrgId_clientLEId: {
                    fiOrgId: questionnaire.fiOrgId,
                    clientLEId: leId
                }
            },
            update: {
                questionnaires: {
                    connect: { id: questionnaireId }
                }
            },
            create: {
                fiOrgId: questionnaire.fiOrgId,
                clientLEId: leId,
                status: "PREPARATION" as any,
                questionnaires: {
                    connect: { id: questionnaireId }
                }
            }
        });

        revalidatePath(`/app/le/${leId}/v2`);
        return { success: true, data: engagement };
    } catch (error) {
        console.error("[linkQuestionnaireToLE]", error);
        return { success: false, error: "Failed to link questionnaire" };
    }
}

// 4. Client Upload: Find/Create FI, Create Questionnaire, then link
export async function uploadClientQuestionnaire(leId: string, fiName: string, formData: FormData) {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Unauthorized" };

    const file = formData.get("file") as File;
    const questionnaireName = formData.get("name") as string || file.name;

    if (!file) return { success: false, error: "File is required" };

    try {
        // Find user's Client Org to set ownership
        const userRole = await prisma.userOrganizationRole.findFirst({
            where: { userId, org: { types: { has: "CLIENT" } } },
            select: { orgId: true }
        });

        // Find or Create FI Org
        let fiOrg = await prisma.organization.findFirst({
            where: {
                name: { equals: fiName, mode: 'insensitive' },
                types: { has: "FI" }
            }
        });

        if (!fiOrg) {
            fiOrg = await prisma.organization.create({
                data: {
                    name: fiName,
                    types: ["FI"]
                }
            });
        }

        // Convert file to buffer
        const buffer = Buffer.from(await file.arrayBuffer());

        // Create Questionnaire
        const questionnaire = await prisma.questionnaire.create({
            data: {
                fiOrgId: fiOrg.id,
                name: questionnaireName,
                fileName: file.name,
                fileType: file.type,
                fileContent: buffer,
                status: "ACTIVE",
                ownerOrgId: userRole?.orgId // Set ownership!
            }
        });

        // Trigger AI Extraction (Async/Fire-and-forget or await?)
        // Let's await it so the user sees results immediately
        await extractDetailedContent(questionnaire.id);

        // Link to LE
        const linkRes = await linkQuestionnaireToLE(leId, questionnaire.id);
        if (!linkRes.success) {
            console.error("Failed to link after upload:", linkRes.error);
            return { success: false, error: linkRes.error };
        }

        revalidatePath(`/app/le/${leId}/v2`);
        return { success: true };
    } catch (error) {
        console.error("[uploadClientQuestionnaire]", error);
        return { success: false, error: "Upload failed" };
    }
}

// 5. Get all FIs for the selector
export async function getFIs() {
    return await prisma.organization.findMany({
        where: { types: { has: "FI" } },
        orderBy: { name: 'asc' }
    });
}

// 6. Remove (Unlink) a questionnaire from an LE
export async function removeQuestionnaireFromLibrary(leId: string, questionnaireId: string) {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Unauthorized" };

    try {
        const questionnaire = await prisma.questionnaire.findUnique({
            where: { id: questionnaireId },
            select: { fiOrgId: true }
        });

        if (!questionnaire) return { success: false, error: "Questionnaire not found" };

        await prisma.fIEngagement.delete({
            where: {
                fiOrgId_clientLEId: {
                    fiOrgId: questionnaire.fiOrgId,
                    clientLEId: leId
                }
            }
        });

        revalidatePath(`/app/le/${leId}/v2`);
        return { success: true };
    } catch (error) {
        console.error("[removeQuestionnaireFromLibrary]", error);
        return { success: false, error: "Failed to remove questionnaire" };
    }
}
