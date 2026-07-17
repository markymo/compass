import prisma from '@/lib/prisma';
import { AttachmentLifecycleResolver } from '@/lib/kyc/AttachmentLifecycleResolver';
import { DocumentLibraryItemDTO, DocumentDetailDTO, CurrentDocumentUsageDTO, DocumentUsageEventDTO } from './DocumentLibraryDTOs';
import { getMasterFieldDefinition } from '@/services/masterData/definitionService';

export class DocumentLibraryService {
    /**
     * Lists all non-deleted documents owned by a Client LE.
     * Derives current and historical usage authoritatively from the attachment lifecycle.
     */
    static async listLibraryDocuments(clientLEId: string): Promise<DocumentLibraryItemDTO[]> {
        // 1. Fetch all documents for this LE in one batch
        const documents = await prisma.document.findMany({
            where: { clientLEId, isDeleted: false },
            include: { uploadedBy: true },
            orderBy: { createdAt: 'desc' }
        });

        if (documents.length === 0) return [];

        // 2. Fetch all FILE_ATTACHMENT claims for this LE in one batch
        const claims = await prisma.fieldClaim.findMany({
            where: {
                clientLeScopeId: clientLEId,
                claimRole: 'FILE_ATTACHMENT',
                status: { in: ['VERIFIED', 'ASSERTED'] }
            }
        });

        // 3. Resolve lifecycle history per instance
        const histories = AttachmentLifecycleResolver.resolveHistories(claims);

        // 4. Map instances to documents
        const docCurrentUsages = new Map<string, Set<string>>();
        const docHistoricalUsages = new Map<string, Set<string>>();

        for (const [instanceId, history] of histories.entries()) {
            const usedDocIds = new Set<string>();
            for (const event of history.events) {
                if (event.attachmentDocumentId) {
                    usedDocIds.add(event.attachmentDocumentId);
                }
            }

            const activeDocId = (!history.isRemoved && history.currentDocumentId) ? history.currentDocumentId : null;

            for (const docId of usedDocIds) {
                if (docId === activeDocId) {
                    if (!docCurrentUsages.has(docId)) docCurrentUsages.set(docId, new Set());
                    docCurrentUsages.get(docId)!.add(instanceId);
                } else {
                    if (!docHistoricalUsages.has(docId)) docHistoricalUsages.set(docId, new Set());
                    docHistoricalUsages.get(docId)!.add(instanceId);
                }
            }
        }

        // 5. Build DTOs
        return documents.map((doc: any) => {
            const currentCount = docCurrentUsages.get(doc.id)?.size || 0;
            const historicalCount = docHistoricalUsages.get(doc.id)?.size || 0;
            
            let status: 'IN_USE' | 'PREVIOUSLY_USED' | 'UNUSED' = 'UNUSED';
            if (currentCount > 0) status = 'IN_USE';
            else if (historicalCount > 0) status = 'PREVIOUSLY_USED';

            return {
                id: doc.id,
                filename: doc.name,
                mimeType: doc.mimeType || 'application/octet-stream',
                sizeBytes: doc.sizeBytes ? doc.sizeBytes.toString() : '0',
                createdAt: doc.createdAt.toISOString(),
                uploadedBy: doc.uploadedBy ? {
                    id: doc.uploadedBy.id,
                    displayName: doc.uploadedBy.name
                } : null,
                currentUsageCount: currentCount,
                historicalUsageCount: historicalCount,
                status
            };
        });
    }

    /**
     * Gets detailed metadata and a timeline of usage for a specific document.
     */
    static async getDocumentDetails(documentId: string, clientLEId: string): Promise<DocumentDetailDTO> {
        // 1. Fetch document
        const doc = await prisma.document.findUnique({
            where: { id: documentId },
            include: { uploadedBy: true }
        });

        if (!doc) throw new Error("Document not found");
        if (doc.clientLEId !== clientLEId) throw new Error("Unauthorized access to document");
        if (doc.isDeleted) throw new Error("Document is deleted");

        // 2. Find all instances where this document was ever used
        const rawClaimsForDoc = await prisma.fieldClaim.findMany({
            where: {
                attachmentDocumentId: documentId,
                clientLeScopeId: clientLEId,
                claimRole: 'FILE_ATTACHMENT',
                status: { in: ['VERIFIED', 'ASSERTED'] }
            },
            select: { instanceId: true }
        });

        const instanceIds = Array.from(new Set(rawClaimsForDoc.map((c: any) => c.instanceId).filter(Boolean))) as string[];

        // 3. Fetch full history for those instances
        const allClaimsForInstances = await prisma.fieldClaim.findMany({
            where: {
                instanceId: { in: instanceIds },
                clientLeScopeId: clientLEId,
                claimRole: 'FILE_ATTACHMENT',
                status: { in: ['VERIFIED', 'ASSERTED'] }
            },
            include: { attachmentDocument: true }
        });

        const histories = AttachmentLifecycleResolver.resolveHistories(allClaimsForInstances);

        // 4. Resolve field definitions (batch to avoid N+1)
        const fieldNos: number[] = Array.from(new Set(allClaimsForInstances.map((c: any) => c.fieldNo)));
        const fieldLabels = new Map<number, string>();
        for (const fNo of fieldNos) {
            try {
                const def = await getMasterFieldDefinition(fNo);
                fieldLabels.set(fNo, def.fieldName);
            } catch (e) {
                fieldLabels.set(fNo, `Field ${fNo}`);
            }
        }

        // 5. Build usages and events
        const currentUsages: CurrentDocumentUsageDTO[] = [];
        const usageHistory: DocumentUsageEventDTO[] = [];

        for (const [instanceId, history] of histories.entries()) {
            const fieldLabel = fieldLabels.get(history.fieldNo) || `Field ${history.fieldNo}`;
            
            // Check if this document is the CURRENT document for this instance
            if (!history.isRemoved && history.currentDocumentId === documentId) {
                currentUsages.push({
                    type: 'MASTER_FIELD',
                    instanceId,
                    fieldNo: history.fieldNo,
                    fieldLabel,
                    attachedAt: history.events[history.events.length - 1].assertedAt.toISOString()
                });
            }

            // Build timeline events for this document in this instance
            let isActive = false;
            let lastEventId: string | null = null;
            let lastEventAttachedAt: Date | null = null;

            for (const claim of history.events) {
                const isTomb = AttachmentLifecycleResolver.isTombstone(claim);
                
                if (claim.attachmentDocumentId === documentId && !isTomb) {
                    if (!isActive) {
                        isActive = true;
                        lastEventId = claim.id;
                        lastEventAttachedAt = claim.assertedAt;
                        usageHistory.push({
                            eventId: claim.id,
                            type: 'MASTER_FIELD',
                            instanceId,
                            fieldNo: claim.fieldNo,
                            fieldLabel,
                            action: 'ATTACHED',
                            timestamp: claim.assertedAt.toISOString()
                        });
                    }
                } else if (isActive) {
                    // It was active, now it's replaced or removed
                    isActive = false;
                    usageHistory.push({
                        eventId: claim.id,
                        type: 'MASTER_FIELD',
                        instanceId,
                        fieldNo: claim.fieldNo,
                        fieldLabel,
                        action: isTomb ? 'REMOVED' : 'REPLACED',
                        timestamp: claim.assertedAt.toISOString(),
                        replacementDocumentId: isTomb ? undefined : (claim.attachmentDocumentId || undefined),
                        replacementFilename: isTomb ? undefined : ((claim as any).attachmentDocument?.name || undefined)
                    });
                }
            }
        }

        // Sort history newest first
        usageHistory.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        // 6. Build final DTO
        const currentCount = currentUsages.length;
        // Count instances where it was attached but is NOT current
        let historicalCount = 0;
        for (const [instanceId, history] of histories.entries()) {
            const usedOnce = history.events.some(e => e.attachmentDocumentId === documentId);
            const isCurrent = !history.isRemoved && history.currentDocumentId === documentId;
            if (usedOnce && !isCurrent) {
                historicalCount++;
            }
        }

        let status: 'IN_USE' | 'PREVIOUSLY_USED' | 'UNUSED' = 'UNUSED';
        if (currentCount > 0) status = 'IN_USE';
        else if (historicalCount > 0) status = 'PREVIOUSLY_USED';

        return {
            id: doc.id,
            filename: doc.name,
            mimeType: doc.mimeType || 'application/octet-stream',
            sizeBytes: doc.sizeBytes ? doc.sizeBytes.toString() : '0',
            createdAt: doc.createdAt.toISOString(),
            uploadedBy: doc.uploadedBy ? {
                id: doc.uploadedBy.id,
                displayName: doc.uploadedBy.name
            } : null,
            currentUsageCount: currentCount,
            historicalUsageCount: historicalCount,
            status,
            currentUsages,
            usageHistory
        };
    }
}
