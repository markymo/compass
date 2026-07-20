import { DocumentUsageProvider } from '../DocumentUsageProvider';
import { DocumentUsage } from '../types';
import { CCPartyDocumentService } from '@/lib/documents/party/CCPartyDocumentService';
import prisma from '@/lib/prisma';

export class PartyDocumentUsageProvider implements DocumentUsageProvider {
    async getActiveUsages(clientLEId: string, documentIds: string[]): Promise<DocumentUsage[]> {
        const activeHistories = await CCPartyDocumentService.getActiveAttachmentsForDocuments(clientLEId, documentIds);

        const usages: DocumentUsage[] = [];

        // We could batch fetch parties, but for simplicity we can fetch them individually or in a single query
        const partyIds = Array.from(new Set(activeHistories.map(h => h.partyId)));
        
        const parties = await prisma.cCParty.findMany({
            where: { id: { in: partyIds } },
            select: { id: true, data: true }
        });
        
        const partyMap = new Map<string, any>(parties.map((p: { id: string, data: any }) => [p.id, p]));

        for (const history of activeHistories) {
            const party = partyMap.get(history.partyId);
            
            let partyName = 'Unknown Party';
            let partyTitle = 'Organisation';
            if (party && party.data && typeof party.data === 'object') {
                const pData = party.data;
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

            usages.push({
                documentId: history.currentDocumentId!,
                type: 'PARTY_DOCUMENT',
                instanceId: history.instanceId,
                attachedAt: history.events[0].assertedAt,
                isActive: true,
                display: {
                    title: partyTitle,
                    subtitle: partyName
                },
                metadata: {
                    partyId: history.partyId
                }
            });
        }

        return usages;
    }
}
