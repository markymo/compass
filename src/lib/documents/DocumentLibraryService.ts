import { DocumentUsageHistoryResolver } from './usage/DocumentUsageHistoryResolver';
import prisma from '@/lib/prisma';
import { DocumentLibraryItemDTO, DocumentDetailDTO, CurrentDocumentUsageDTO, DocumentUsageEventDTO } from './DocumentLibraryDTOs';
import { DocumentUsageResolver } from './usage/DocumentUsageResolver';

export class DocumentLibraryService {
    /**
     * Lists all non-deleted documents owned by a Client LE.
     * Uses DocumentUsageResolver to determine current usages.
     */
    static async listLibraryDocuments(clientLEId: string): Promise<DocumentLibraryItemDTO[]> {
        // 1. Fetch all documents for this LE in one batch
        const documents = await prisma.document.findMany({
            where: { clientLEId, isDeleted: false },
            include: { uploadedBy: true },
            orderBy: { createdAt: 'desc' }
        });

        if (documents.length === 0) return [];

        // 2. Fetch usages across the platform
        const docIds = documents.map((d: { id: string }) => d.id);
        const usagesMap = await DocumentUsageResolver.resolveActiveUsages(clientLEId, docIds);

        // 3. Build DTOs
        return documents.map((doc: { id: string, name: string, mimeType: string | null, sizeBytes: bigint | null, createdAt: Date, uploadedBy: { id: string, name: string | null } | null }) => {
            const usages = usagesMap.get(doc.id) || [];
            const currentCount = usages.length;
            
            let status: 'IN_USE' | 'PREVIOUSLY_USED' | 'UNUSED' = 'UNUSED';
            if (currentCount > 0) status = 'IN_USE';

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
                historicalUsageCount: 0, // Not supported in the unified active-only view yet
                status
            };
        });
    }

    /**
     * Gets detailed metadata and active usage for a specific document.
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

        // 2. Resolve usages
        const usagesMap = await DocumentUsageResolver.resolveActiveUsages(clientLEId, [documentId]);
        const historyMap = await DocumentUsageHistoryResolver.resolveHistory(clientLEId, [documentId]);
        
        const usages = usagesMap.get(documentId) || [];
        const history = historyMap.get(documentId) || [];

        // 3. Build DTO
        const currentUsages: CurrentDocumentUsageDTO[] = usages.map(u => ({
            type: u.type,
            instanceId: u.instanceId,
            attachedAt: u.attachedAt.toISOString(),
            isActive: u.isActive,
            display: u.display,
            metadata: u.metadata
        }));
        
        const usageHistory: DocumentUsageEventDTO[] = history.map(h => ({
            eventId: h.eventId,
            type: h.type,
            instanceId: h.instanceId,
            action: h.action,
            timestamp: h.timestamp.toISOString(),
            replacementDocumentId: h.replacementDocumentId,
            replacementFilename: h.replacementFilename,
            display: h.display,
            metadata: h.metadata
        }));
        
        const currentCount = currentUsages.length;
        
        const activeInstanceIds = new Set(currentUsages.map(u => u.instanceId));
        const distinctHistoricalInstanceIds = new Set(history.map(h => h.instanceId));
        
        let historicalCount = 0;
        for (const inst of distinctHistoricalInstanceIds) {
            if (!activeInstanceIds.has(inst)) {
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
            sizeBytes: (doc.sizeBytes || BigInt(0)).toString(),
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
