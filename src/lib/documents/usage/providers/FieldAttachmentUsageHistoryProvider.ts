import { DocumentUsageHistoryProvider } from '../DocumentUsageHistoryProvider';
import { DocumentUsageHistoryEvent } from '../types';
import { AttachmentService } from '@/lib/kyc/AttachmentService';
import { AttachmentLifecycleResolver } from '@/lib/kyc/AttachmentLifecycleResolver';
import { getMasterFieldDefinition } from '@/services/masterData/definitionService';

export class FieldAttachmentUsageHistoryProvider implements DocumentUsageHistoryProvider {
    async getHistoricalEvents(clientLEId: string, documentId: string): Promise<DocumentUsageHistoryEvent[]> {
        const histories = await AttachmentService.getAttachmentHistoryForDocument(clientLEId, documentId);
        
        // Batch field definition lookups
        const fieldNos = Array.from(new Set(histories.map(h => h.fieldNo)));
        const fieldLabels = new Map<number, string>();
        for (const fNo of fieldNos) {
            try {
                const def = await getMasterFieldDefinition(fNo);
                fieldLabels.set(fNo, def.fieldName);
            } catch (e) {
                fieldLabels.set(fNo, `Field ${fNo}`);
            }
        }

        const events: DocumentUsageHistoryEvent[] = [];

        for (const history of histories) {
            const fieldLabel = fieldLabels.get(history.fieldNo) || `Field ${history.fieldNo}`;

            let isActive = false;

            for (const claim of history.events) {
                const isTomb = AttachmentLifecycleResolver.isTombstone(claim);

                if (claim.attachmentDocumentId === documentId && !isTomb) {
                    if (!isActive) {
                        isActive = true;
                        events.push({
                            eventId: claim.id,
                            documentId,
                            type: 'FIELD_ATTACHMENT',
                            instanceId: history.instanceId,
                            action: 'ATTACHED',
                            timestamp: claim.assertedAt,
                            display: { title: fieldLabel, subtitle: 'Field Attachment' },
                            metadata: { fieldNo: history.fieldNo }
                        });
                    }
                } else if (isActive) {
                    isActive = false;
                    events.push({
                        eventId: claim.id,
                        documentId,
                        type: 'FIELD_ATTACHMENT',
                        instanceId: history.instanceId,
                        action: isTomb ? 'REMOVED' : 'REPLACED',
                        timestamp: claim.assertedAt,
                        replacementDocumentId: isTomb ? undefined : (claim.attachmentDocumentId || undefined),
                        replacementFilename: isTomb ? undefined : ((claim as any).attachmentDocument?.name || undefined),
                        display: { title: fieldLabel, subtitle: 'Field Attachment' },
                        metadata: { fieldNo: history.fieldNo }
                    });
                }
            }
        }

        return events;
    }
}
