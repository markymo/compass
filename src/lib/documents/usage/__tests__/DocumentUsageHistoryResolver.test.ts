import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocumentUsageHistoryResolver } from '../DocumentUsageHistoryResolver';
import { FieldAttachmentUsageHistoryProvider } from '../providers/FieldAttachmentUsageHistoryProvider';
import { PartyDocumentUsageHistoryProvider } from '../providers/PartyDocumentUsageHistoryProvider';
import { DocumentUsageHistoryEvent } from '../types';

vi.mock('../providers/FieldAttachmentUsageHistoryProvider');
vi.mock('../providers/PartyDocumentUsageHistoryProvider');

describe('DocumentUsageHistoryResolver', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const mockDate1 = new Date('2026-07-01T10:00:00Z');
    const mockDate2 = new Date('2026-07-02T10:00:00Z');
    const mockDate3 = new Date('2026-07-03T10:00:00Z');

    it('aggregates and sorts field, party, removed, and replaced history chronologically', async () => {
        const fieldEvents: DocumentUsageHistoryEvent[] = [
            {
                eventId: 'fe-1',
                documentId: 'doc-1',
                type: 'FIELD_ATTACHMENT',
                instanceId: 'f-inst-1',
                action: 'ATTACHED',
                timestamp: mockDate1,
                display: { title: 'Field 1' },
                metadata: { fieldNo: 1 }
            },
            {
                eventId: 'fe-2',
                documentId: 'doc-1',
                type: 'FIELD_ATTACHMENT',
                instanceId: 'f-inst-1',
                action: 'REMOVED',
                timestamp: mockDate3, // Removed later
                display: { title: 'Field 1' },
                metadata: { fieldNo: 1 }
            }
        ];

        const partyEvents: DocumentUsageHistoryEvent[] = [
            {
                eventId: 'pe-1',
                documentId: 'doc-1',
                type: 'PARTY_DOCUMENT',
                instanceId: 'p-inst-1',
                action: 'REPLACED',
                timestamp: mockDate2,
                replacementDocumentId: 'doc-2',
                display: { title: 'Organisation', subtitle: 'ABC Ltd' },
                metadata: { partyId: 'party-1' }
            }
        ];

        vi.mocked(FieldAttachmentUsageHistoryProvider.prototype.getHistoricalEvents).mockResolvedValue(fieldEvents);
        vi.mocked(PartyDocumentUsageHistoryProvider.prototype.getHistoricalEvents).mockResolvedValue(partyEvents);

        const result = await DocumentUsageHistoryResolver.resolveHistory('le-1', ['doc-1']);
        
        expect(result.size).toBe(1);
        const history = result.get('doc-1')!;
        
        expect(history).toHaveLength(3);
        // Newest first sorting
        expect(history[0].action).toBe('REMOVED');
        expect(history[0].timestamp).toEqual(mockDate3);

        expect(history[1].action).toBe('REPLACED');
        expect(history[1].timestamp).toEqual(mockDate2);

        expect(history[2].action).toBe('ATTACHED');
        expect(history[2].timestamp).toEqual(mockDate1);
    });
});
