import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FieldAttachmentUsageProvider } from '../FieldAttachmentUsageProvider';
import { AttachmentService } from '@/lib/kyc/AttachmentService';
import { getMasterFieldDefinition } from '@/services/masterData/definitionService';

vi.mock('@/lib/kyc/AttachmentService');
vi.mock('@/services/masterData/definitionService');

describe('FieldAttachmentUsageProvider', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('maps active attachments to DocumentUsage structure', async () => {
        const provider = new FieldAttachmentUsageProvider();
        const mockDate = new Date('2026-07-17T12:00:00Z');

        (AttachmentService.getActiveAttachmentsForDocuments as any).mockResolvedValue([
            {
                instanceId: 'inst-1',
                fieldNo: 20,
                currentDocumentId: 'doc-1',
                isRemoved: false,
                events: [{ assertedAt: mockDate }]
            }
        ]);

        (getMasterFieldDefinition as any).mockResolvedValue({
            fieldName: 'Certificate of Incorporation'
        });

        const usages = await provider.getActiveUsages('client-1', ['doc-1']);

        expect(usages).toHaveLength(1);
        expect(usages[0]).toEqual({
            documentId: 'doc-1',
            type: 'FIELD_ATTACHMENT',
            instanceId: 'inst-1',
            attachedAt: mockDate,
            isActive: true,
            display: {
                title: 'Field 20',
                subtitle: 'Certificate of Incorporation'
            },
            metadata: {
                fieldNo: 20
            }
        });
    });

    it('handles missing field definition gracefully', async () => {
        const provider = new FieldAttachmentUsageProvider();

        (AttachmentService.getActiveAttachmentsForDocuments as any).mockResolvedValue([
            {
                instanceId: 'inst-1',
                fieldNo: 99,
                currentDocumentId: 'doc-1',
                isRemoved: false,
                events: [{ assertedAt: new Date() }]
            }
        ]);

        (getMasterFieldDefinition as any).mockRejectedValue(new Error('Not found'));

        const usages = await provider.getActiveUsages('client-1', ['doc-1']);

        expect(usages[0].display.subtitle).toBe('Field 99');
    });
});
