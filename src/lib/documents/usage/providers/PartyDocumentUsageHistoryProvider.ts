import { DocumentUsageHistoryProvider } from '../DocumentUsageHistoryProvider';
import { DocumentUsageHistoryEvent } from '../types';
import { CCPartyDocumentService } from '@/lib/documents/party/CCPartyDocumentService';
import { PartyDocumentLifecycleResolver } from '@/lib/documents/party/PartyDocumentLifecycleResolver';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export class PartyDocumentUsageHistoryProvider implements DocumentUsageHistoryProvider {
    async getHistoricalEvents(clientLEId: string, documentId: string): Promise<DocumentUsageHistoryEvent[]> {
        const histories = await CCPartyDocumentService.getAttachmentHistoryForDocument(clientLEId, documentId);
        if (histories.length === 0) return [];

        const partyIds = Array.from(new Set(histories.map(h => h.partyId)));
        const parties = await prisma.cCParty.findMany({
            where: { id: { in: partyIds } }
        });

        const partyMap = new Map<string, { id: string, data: Prisma.JsonValue }>(
            parties.map((p: { id: string, data: Prisma.JsonValue }) => [p.id, p] as const)
        );

        const events: DocumentUsageHistoryEvent[] = [];

        for (const history of histories) {
            const party = partyMap.get(history.partyId);
            if (!party) continue;

            let partyTitle = 'Organisation';
            let partyName = 'Unknown Party';
            
            if (party.data && typeof party.data === 'object' && !Array.isArray(party.data)) {
                const pData = party.data as any;
                const contactType = pData.contactType;
                const pType = pData.partyType || (contactType === 'PERSON' ? 'INDIVIDUAL' : 'ORGANISATION');

                if (pType === 'INDIVIDUAL') partyTitle = 'Individual';
                else if (pType === 'TEAM') partyTitle = 'Team';
                else if (pType === 'ORGANISATION') partyTitle = 'Organisation';

                if (pType === 'INDIVIDUAL') {
                    const first = pData.firstName || pData.forenames || '';
                    const last = pData.lastName || pData.surname || '';
                    partyName = `${first} ${last}`.trim() || partyName;
                } else {
                    partyName = pData.legalName || pData.organisationName || pData.name || pData.companyName || partyName;
                }
            }

            let isActive = false;

            for (const claim of history.events) {
                const isTomb = claim.operation === 'REMOVE';

                if (claim.documentId === documentId && !isTomb) {
                    if (!isActive) {
                        isActive = true;
                        events.push({
                            eventId: claim.id,
                            documentId,
                            type: 'PARTY_DOCUMENT',
                            instanceId: history.instanceId,
                            action: 'ATTACHED',
                            timestamp: claim.assertedAt,
                            display: { title: partyTitle, subtitle: partyName },
                            metadata: { partyId: history.partyId }
                        });
                    }
                } else if (isActive) {
                    isActive = false;
                    events.push({
                        eventId: claim.id,
                        documentId,
                        type: 'PARTY_DOCUMENT',
                        instanceId: history.instanceId,
                        action: isTomb ? 'REMOVED' : 'REPLACED',
                        timestamp: claim.assertedAt,
                        replacementDocumentId: isTomb ? undefined : (claim.documentId || undefined),
                        replacementFilename: isTomb ? undefined : ((claim as any).document?.name || undefined),
                        display: { title: partyTitle, subtitle: partyName },
                        metadata: { partyId: history.partyId }
                    });
                }
            }
        }

        return events;
    }
}
