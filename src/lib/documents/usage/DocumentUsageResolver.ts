import { DocumentUsage } from './types';
import { FieldAttachmentUsageProvider } from './providers/FieldAttachmentUsageProvider';
import { PartyDocumentUsageProvider } from './providers/PartyDocumentUsageProvider';

export class DocumentUsageResolver {
    /**
     * Resolves active usages for a set of documents by querying all registered providers.
     * Returns a map keyed by documentId, where the value is an array of DocumentUsage objects.
     */
    static async resolveActiveUsages(clientLEId: string, documentIds: string[]): Promise<Map<string, DocumentUsage[]>> {
        const usageMap = new Map<string, DocumentUsage[]>();
        
        if (documentIds.length === 0) {
            return usageMap;
        }

        // Initialize empty arrays
        for (const docId of documentIds) {
            usageMap.set(docId, []);
        }

        // Explicitly construct providers to avoid complex plugin registry
        const providers = [
            new FieldAttachmentUsageProvider(),
            new PartyDocumentUsageProvider()
        ];

        // Query all providers in parallel
        const results = await Promise.all(
            providers.map(provider => provider.getActiveUsages(clientLEId, documentIds))
        );

        // Aggregate usages
        for (const providerUsages of results) {
            for (const usage of providerUsages) {
                if (usageMap.has(usage.documentId)) {
                    usageMap.get(usage.documentId)!.push(usage);
                }
            }
        }

        // Sort each document's usages chronologically
        for (const usages of usageMap.values()) {
            usages.sort((a, b) => a.attachedAt.getTime() - b.attachedAt.getTime());
        }

        return usageMap;
    }
}
