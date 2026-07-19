import prisma from "@/lib/prisma";
import { AttachmentLifecycleResolver, InstanceAttachmentHistory } from "./AttachmentLifecycleResolver";
import { ClaimStatus } from "@prisma/client";

export class AttachmentService {
    /**
     * Resolves active attachments for a given list of document IDs within a client LE scope.
     * Delegates to AttachmentLifecycleResolver to resolve the append-only history.
     */
    static async getActiveAttachmentsForDocuments(clientLEId: string, documentIds: string[]): Promise<InstanceAttachmentHistory[]> {
        if (documentIds.length === 0) return [];

        // Fetch all claims that involve these document IDs
        // Note: we must fetch ALL claims for any instanceId that currently or historically 
        // referenced one of these documents, to properly resolve the authoritative state.
        
        // 1. Find instance IDs that have ever referenced these documents
        const claimsReferencingDocs = await prisma.fieldClaim.findMany({
            where: {
                clientLeScopeId: clientLEId,
                claimRole: 'FILE_ATTACHMENT',
                attachmentDocumentId: { in: documentIds },
                status: { in: [ClaimStatus.VERIFIED, ClaimStatus.ASSERTED] }
            },
            select: { instanceId: true }
        });

        const instanceIds = Array.from(new Set(claimsReferencingDocs.map((c: { instanceId: string | null }) => c.instanceId).filter(Boolean))) as string[];
        
        if (instanceIds.length === 0) return [];

        // 2. Fetch full history for those instances
        const allClaimsForInstances = await prisma.fieldClaim.findMany({
            where: {
                clientLeScopeId: clientLEId,
                claimRole: 'FILE_ATTACHMENT',
                instanceId: { in: instanceIds },
                status: { in: [ClaimStatus.VERIFIED, ClaimStatus.ASSERTED] }
            },
            orderBy: [{ assertedAt: 'desc' }, { id: 'desc' }]
        });

        // 3. Delegate to canonical lifecycle resolver
        const histories = AttachmentLifecycleResolver.resolveHistories(allClaimsForInstances);
        
        // 4. Return only the active histories that point to one of the requested document IDs
        return Array.from(histories.values()).filter(h => 
            !h.isRemoved && 
            h.currentDocumentId && 
            documentIds.includes(h.currentDocumentId)
        );
    }

    /**
     * Resolves complete chronological attachment history involving a specific document.
     * Yields all instances where the document was ever referenced, returning their full resolved timelines.
     */
    static async getAttachmentHistoryForDocument(clientLEId: string, documentId: string): Promise<InstanceAttachmentHistory[]> {
        const claimsReferencingDoc = await prisma.fieldClaim.findMany({
            where: {
                clientLeScopeId: clientLEId,
                claimRole: 'FILE_ATTACHMENT',
                attachmentDocumentId: documentId,
                status: { in: [ClaimStatus.VERIFIED, ClaimStatus.ASSERTED] }
            },
            select: { instanceId: true }
        });

        const instanceIds = Array.from(new Set(claimsReferencingDoc.map((c: { instanceId: string | null }) => c.instanceId).filter(Boolean))) as string[];
        
        if (instanceIds.length === 0) return [];

        const allClaimsForInstances = await prisma.fieldClaim.findMany({
            where: {
                clientLeScopeId: clientLEId,
                claimRole: 'FILE_ATTACHMENT',
                instanceId: { in: instanceIds },
                status: { in: [ClaimStatus.VERIFIED, ClaimStatus.ASSERTED] }
            },
            orderBy: [{ assertedAt: 'asc' }, { id: 'asc' }],
            include: { attachmentDocument: true }
        });

        const histories = AttachmentLifecycleResolver.resolveHistories(allClaimsForInstances);
        return Array.from(histories.values());
    }

}
