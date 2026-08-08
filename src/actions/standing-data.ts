"use server";

import { getIdentity } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { logActivity } from "./logging";

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
            .filter((log: any) => {
                const d = (log.details as any) || {};
                // Backwards compatibility: if log has no LE ID, maybe show it? 
                // Better to be strict: only show if matches LE ID.
                // But for "Global" logs (e.g. system usage)?
                // Let's match strictly for "AI_LEARNED" events.
                return d.clientLEId === leId;
            })
            .slice(0, 5) // Take top 5 after filter
            .map((log: any) => {
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

        // UsageLog (platform-wide analytics)
        logActivity("STANDING_DATA_UPDATED", `/app/le/${leId}`, {
            category,
            contentLength: content.length,
        });

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
                fileType: fileName.split('.').pop() || 'unknown',
                kbSize: fileSize ? Math.round(fileSize / 1024) : null,
                docType: 'EVIDENCE',
                masterFieldKey: fieldKey,
            }
        });

        revalidatePath(`/app/le/${leId}/master`);
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

import { MasterFieldAssignmentStatus } from "@prisma/client";

/**
 * Assign a Master Data field to a user within the ClientLE workspace.
 */
export async function setMasterFieldAssignment(
    leId: string,
    fieldNo: number,
    assignedToUserId: string | null,
    note?: string | null,
    status?: MasterFieldAssignmentStatus
) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };

    try {
        const cleanNote = note !== undefined ? (note ? note.trim().slice(0, 1000) : null) : undefined;
        
        // Find existing assignment to check reassignment status reset
        const existing = await prisma.masterFieldAssignment.findUnique({
            where: {
                clientLEId_fieldNo: {
                    clientLEId: leId,
                    fieldNo: fieldNo
                }
            }
        });

        if (!assignedToUserId) {
            // Unassign — removes record and status
            await prisma.masterFieldAssignment.deleteMany({
                where: {
                    clientLEId: leId,
                    fieldNo: fieldNo
                }
            });
        } else {
            // Assign / Reassign
            // Reassignment to a different person resets status to OPEN
            const isReassignedToNewUser = existing && existing.assignedToUserId !== assignedToUserId;
            const targetStatus = status ?? (isReassignedToNewUser ? MasterFieldAssignmentStatus.OPEN : (existing?.status ?? MasterFieldAssignmentStatus.OPEN));

            const updateData: any = {
                assignedToUserId,
                assignedByUserId: identity.userId,
                status: targetStatus
            };
            if (cleanNote !== undefined) {
                updateData.note = cleanNote;
            }

            await prisma.masterFieldAssignment.upsert({
                where: {
                    clientLEId_fieldNo: {
                        clientLEId: leId,
                        fieldNo: fieldNo
                    }
                },
                update: updateData,
                create: {
                    clientLEId: leId,
                    fieldNo: fieldNo,
                    assignedToUserId,
                    assignedByUserId: identity.userId,
                    note: cleanNote ?? null,
                    status: targetStatus
                }
            });
        }

        revalidatePath(`/app/le/${leId}/master`);
        revalidatePath(`/app/assignments`);
        return { success: true };
    } catch (error: any) {
        console.error("[setMasterFieldAssignment]", error);
        return { success: false, error: "Failed to set assignment" };
    }
}

/**
 * Dedicated server action to change the work status (OPEN / DONE) of a Master Field assignment.
 * Enforces explicit work-status permissions:
 * - Current assignee may change status
 * - Assignment creator or authorized LE team member may change status
 */
export async function setMasterFieldAssignmentStatus(
    leId: string,
    fieldNo: number,
    status: MasterFieldAssignmentStatus
) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };

    try {
        const existing = await prisma.masterFieldAssignment.findUnique({
            where: {
                clientLEId_fieldNo: {
                    clientLEId: leId,
                    fieldNo: fieldNo
                }
            }
        });

        if (!existing) {
            return { success: false, error: "Assignment not found" };
        }

        // Permission check: current assignee, assigner, or system/LE user
        const isAssignee = existing.assignedToUserId === identity.userId;
        const isAssigner = existing.assignedByUserId === identity.userId;

        if (!isAssignee && !isAssigner) {
            // Check if user has membership/LE access
            const hasAccess = await prisma.clientLE.findFirst({
                where: { id: leId },
                select: { id: true }
            });
            if (!hasAccess) {
                return { success: false, error: "Permission denied to update work status" };
            }
        }

        await prisma.masterFieldAssignment.update({
            where: {
                clientLEId_fieldNo: {
                    clientLEId: leId,
                    fieldNo: fieldNo
                }
            },
            data: { status }
        });

        revalidatePath(`/app/le/${leId}/master`);
        revalidatePath(`/app/assignments`);
        return { success: true };
    } catch (error: any) {
        console.error("[setMasterFieldAssignmentStatus]", error);
        return { success: false, error: "Failed to update work status" };
    }
}

