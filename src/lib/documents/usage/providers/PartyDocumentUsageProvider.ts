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
            select: { id: true, partyType: true, data: true }
        });
        
        const partyMap = new Map<string, any>(parties.map((p: { id: string, partyType: string, data: any }) => [p.id, p]));

        for (const history of activeHistories) {
            const party = partyMap.get(history.partyId);
            
            let partyName = 'Unknown Party';
            let partyTitle = 'Organisation';
            if (party) {
                if (party.partyType === 'INDIVIDUAL') partyTitle = 'Individual';
                else if (party.partyType === 'TEAM') partyTitle = 'Team';
                else if (party.partyType === 'ORGANISATION') partyTitle = 'Organisation';
                
                if (party.data && typeof party.data === 'object') {
                    
                    if (party.partyType === 'INDIVIDUAL') {
                        partyName = `${(party.data as { name?: string, firstName?: string, lastName?: string }).firstName || ''} ${(party.data as { name?: string, firstName?: string, lastName?: string }).lastName || ''}`.trim() || partyName;
                    } else {
                        partyName = (party.data as { name?: string, firstName?: string, lastName?: string }).name || partyName;
                    }
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
