import { CCPartyDocument, CCPartyDocumentOperation } from '@prisma/client';

export interface PartyDocumentHistory {
    instanceId: string;
    partyId: string;
    currentDocumentId: string | null;
    isRemoved: boolean;
    events: CCPartyDocument[]; // Ordered newest to oldest (assertedAt DESC, id DESC)
}

export class PartyDocumentLifecycleResolver {
    /**
     * Resolves the attachment history and current state for a set of CCPartyDocument records.
     * Groups them by instanceId and determines the authoritative current document.
     */
    static resolveHistories(documents: CCPartyDocument[]): Map<string, PartyDocumentHistory> {
        // Group by instanceId
        const groups = new Map<string, CCPartyDocument[]>();
        for (const doc of documents) {
            const key = doc.instanceId;
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key)!.push(doc);
        }

        const histories = new Map<string, PartyDocumentHistory>();

        for (const [instanceId, groupDocs] of groups.entries()) {
            // Sort documents: assertedAt DESC, then id DESC
            groupDocs.sort((a, b) => {
                const timeDiff = b.assertedAt.getTime() - a.assertedAt.getTime();
                if (timeDiff !== 0) return timeDiff;
                return b.id.localeCompare(a.id);
            });

            // The latest event wins
            const latestDoc = groupDocs[0];
            const isRemoved = latestDoc.operation === CCPartyDocumentOperation.REMOVE;

            histories.set(instanceId, {
                instanceId,
                partyId: latestDoc.partyId,
                currentDocumentId: isRemoved ? null : latestDoc.documentId,
                isRemoved,
                events: groupDocs,
            });
        }

        return histories;
    }
}
