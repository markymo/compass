import prisma from "@/lib/prisma";
import { Action, can, UserWithMemberships } from "@/lib/auth/permissions";

export interface DocumentDownloadAuthResult {
    allowed: boolean;
    document: any | null;
    status: number;
    reason?: string;
}

export async function canUserDownloadDocument(
    userId: string | null | undefined,
    documentId: string
): Promise<DocumentDownloadAuthResult> {
    if (!userId) {
        return { allowed: false, document: null, status: 401, reason: "Unauthorized: User not authenticated" };
    }

    // 1. Retrieve target document with relationship chain
    const document = await prisma.document.findUnique({
        where: { id: documentId },
        include: {
            question: {
                include: {
                    questionnaire: {
                        include: {
                            fiEngagement: true
                        }
                    }
                }
            },
            prefilledForQuestion: {
                include: {
                    questionnaire: {
                        include: {
                            fiEngagement: true
                        }
                    }
                }
            }
        }
    });

    if (!document || document.isDeleted) {
        return { allowed: false, document: null, status: 404, reason: "Document not found" };
    }

    // 2. Fetch user's organization and clientLE memberships
    const memberships = await prisma.membership.findMany({
        where: { userId },
        select: {
            organizationId: true,
            clientLEId: true,
            fiEngagementId: true,
            role: true,
            organization: {
                select: {
                    types: true
                }
            }
        }
    });

    type UserMembershipRecord = typeof memberships[number];

    const user: UserWithMemberships = {
        id: userId,
        memberships: memberships.map((m: UserMembershipRecord) => ({
            organizationId: m.organizationId,
            clientLEId: m.clientLEId,
            role: m.role
        }))
    };

    // 3. Check Client-side ownership access
    if (document.clientLEId) {
        const canClientAccess = await can(user, Action.LE_VIEW_MASTER_DATA, { clientLEId: document.clientLEId }, prisma);
        if (canClientAccess) {
            return { allowed: true, document, status: 200 };
        }
    }

    // 5. Check Supplier-side access rules
    const question = document.question || document.prefilledForQuestion;
    if (!question) {
        // Document is a private ClientLE document not attached to any question
        return { allowed: false, document: null, status: 403, reason: "Forbidden: Document not attached to a visible question" };
    }

    // Question status MUST be "SHARED" or "RELEASED" for Supplier downloads
    if (question.status !== "SHARED" && question.status !== "RELEASED") {
        return { allowed: false, document: null, status: 403, reason: "Forbidden: Question answer is not shared or released" };
    }

    const engagement = question.questionnaire?.fiEngagement;
    if (!engagement || engagement.isDeleted) {
        return { allowed: false, document: null, status: 403, reason: "Forbidden: Questionnaire is not assigned to an active Relationship" };
    }

    // Verify Supplier user membership for this engagement's fiOrgId or specific fiEngagementId
    const supplierOrgId = engagement.fiOrgId;
    const hasSupplierOrgAccess = memberships.some((m: UserMembershipRecord) => m.organizationId === supplierOrgId);
    const hasSupplierEngagementAccess = memberships.some((m: UserMembershipRecord) => m.fiEngagementId === engagement.id);

    if (hasSupplierOrgAccess || hasSupplierEngagementAccess) {
        return { allowed: true, document, status: 200 };
    }

    return { allowed: false, document: null, status: 403, reason: "Forbidden: User lacks relationship authorization for this document" };
}
