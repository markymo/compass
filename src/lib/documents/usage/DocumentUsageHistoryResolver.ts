import { DocumentUsageHistoryProvider } from './DocumentUsageHistoryProvider';
import { FieldAttachmentUsageHistoryProvider } from './providers/FieldAttachmentUsageHistoryProvider';
import { PartyDocumentUsageHistoryProvider } from './providers/PartyDocumentUsageHistoryProvider';
import { DocumentUsageHistoryEvent } from './types';

export class DocumentUsageHistoryResolver {
    private static getProviders(): DocumentUsageHistoryProvider[] {
        return [
            new FieldAttachmentUsageHistoryProvider(),
            new PartyDocumentUsageHistoryProvider()
        ];
    }

    /**
     * Resolves the aggregated chronological usage history for a set of documents.
     * Returns a map of documentId -> DocumentUsageHistoryEvent[].
     * Events are sorted newest first.
     */
    static async resolveHistory(clientLEId: string, documentIds: string[]): Promise<Map<string, DocumentUsageHistoryEvent[]>> {
        const providers = this.getProviders();
        const historyMap = new Map<string, DocumentUsageHistoryEvent[]>();

        for (const docId of documentIds) {
            historyMap.set(docId, []);
        }

        // Fetch histories concurrently from all providers
        const results = await Promise.all(
            providers.map(async provider => {
                const docEvents = await Promise.all(
                    documentIds.map(docId => provider.getHistoricalEvents(clientLEId, docId))
                );
                return { provider, docEvents };
            })
        );

        for (const { docEvents } of results) {
            for (let i = 0; i < documentIds.length; i++) {
                const docId = documentIds[i];
                const events = docEvents[i];
                historyMap.get(docId)!.push(...events);
            }
        }

        // Sort each document's events newest first
        for (const events of historyMap.values()) {
            events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        }

        return historyMap;
    }
}
