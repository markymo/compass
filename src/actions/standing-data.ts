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

/**
 * Attach a file to a specific Master Data field as evidence.
 * Creates a Document record with docType = "EVIDENCE" and masterFieldKey set.
 */
export async function attachDocumentToMasterField(
    leId: string,
    fieldKey: string,
    fileUrl: string,
    fileName: string,
    fileSize?: number
) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };

    try {
        const document = await prisma.document.create({
            data: {
                clientLEId: leId,
                name: fileName,
                fileUrl: fileUrl,
                fileType: fileName.split('.').pop() || 'unknown',
                kbSize: fileSize ? Math.round(fileSize / 1024) : null,
                docType: 'EVIDENCE',
                masterFieldKey: fieldKey,
            }
        });

        revalidatePath(`/app/le/${leId}/master`);
        revalidatePath(`/app/le/${leId}/sources/vault`);
        return { success: true, document };
    } catch (error: any) {
        console.error("[attachDocumentToMasterField]", error);
        return { success: false, error: error.message || "Failed to attach document" };
    }
}

/**
 * Fetch all documents attached to a specific Master Data field.
 */
export async function getMasterFieldDocuments(leId: string, fieldKey: string) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized", documents: [] };

    try {
        const documents = await prisma.document.findMany({
            where: {
                clientLEId: leId,
                masterFieldKey: fieldKey,
                isDeleted: false,
            },
            orderBy: { createdAt: 'desc' }
        });

        return { success: true, documents };
    } catch (error: any) {
        console.error("[getMasterFieldDocuments]", error);
        return { success: false, error: "Failed to fetch documents", documents: [] };
    }
}

/**
 * Assign a Master Data field to a user within the ClientLE workspace.
 */
export async function setMasterFieldAssignment(leId: string, fieldNo: number, assignedToUserId: string | null) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };

    try {
        if (!assignedToUserId) {
            // Unassign
            await prisma.masterFieldAssignment.deleteMany({
                where: {
                    clientLEId: leId,
                    fieldNo: fieldNo
                }
            });
        } else {
            // Assign / Reassign
            await prisma.masterFieldAssignment.upsert({
                where: {
                    clientLEId_fieldNo: {
                        clientLEId: leId,
                        fieldNo: fieldNo
                    }
                },
                update: {
                    assignedToUserId,
                    assignedByUserId: identity.userId,
                },
                create: {
                    clientLEId: leId,
                    fieldNo: fieldNo,
                    assignedToUserId,
                    assignedByUserId: identity.userId,
                }
            });
        }

        revalidatePath(`/app/le/${leId}/master`);
        return { success: true };
    } catch (error: any) {
        console.error("[setMasterFieldAssignment]", error);
        return { success: false, error: "Failed to set assignment" };
    }
}

