import { DocumentUsageProvider } from '../DocumentUsageProvider';
import { DocumentUsage } from '../types';
import { AttachmentService } from '@/lib/kyc/AttachmentService';
import { getMasterFieldDefinition } from '@/services/masterData/definitionService';

export class FieldAttachmentUsageProvider implements DocumentUsageProvider {
    async getActiveUsages(clientLEId: string, documentIds: string[]): Promise<DocumentUsage[]> {
        const activeHistories = await AttachmentService.getActiveAttachmentsForDocuments(clientLEId, documentIds);

        const usages: DocumentUsage[] = [];

        for (const history of activeHistories) {
            let label = `Field ${history.fieldNo}`;
            try {
                const def = await getMasterFieldDefinition(history.fieldNo);
                if (def && def.fieldName) {
                    label = def.fieldName;
                }
            } catch (e) {
                // Ignore and use default label
            }

            usages.push({
                documentId: history.currentDocumentId!,
                type: 'FIELD_ATTACHMENT',
                instanceId: history.instanceId,
                attachedAt: history.events[0].assertedAt,
                isActive: true,
                display: {
                    title: `Field ${history.fieldNo}`,
                    subtitle: label
                },
                metadata: {
                    fieldNo: history.fieldNo
                }
            });
        }

        return usages;
    }
}
