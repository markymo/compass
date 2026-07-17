import prisma from "@/lib/prisma";
import { CCPartyDocument, CCPartyDocumentOperation } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import { PartyDocumentLifecycleResolver, PartyDocumentHistory } from "./PartyDocumentLifecycleResolver";

export type AttachPartyDocumentInput = {
    partyId: string;
    documentId: string;
    idempotencyKey?: string;
    assertedById?: string;
};

export type ReplacePartyDocumentInput = {
    partyId: string;
    instanceId: string;
    documentId: string;
    idempotencyKey?: string;
    assertedById?: string;
};

export type RemovePartyDocumentInput = {
    partyId: string;
    instanceId: string;
    idempotencyKey?: string;
    assertedById?: string;
};

export class CCPartyDocumentService {
    /**
     * Resolves active documents for a given Party.
     */
    static async resolvePartyDocuments(partyId: string): Promise<PartyDocumentHistory[]> {
        const documents = await prisma.cCPartyDocument.findMany({
            where: { partyId },
            orderBy: [{ assertedAt: 'desc' }, { id: 'desc' }],
        });

        const historiesMap = PartyDocumentLifecycleResolver.resolveHistories(documents);
        
        // Return only the active (non-removed) documents
        return Array.from(historiesMap.values()).filter(h => !h.isRemoved);
    }

    /**
     * Attaches a new document to a Party.
     * Generates a new instanceId for the lifecycle.
     */

    /**
     * Resolves active Party attachments for a given list of document IDs within a client LE scope.
     * Delegates to PartyDocumentLifecycleResolver to resolve the append-only history.
     */
    static async getActiveAttachmentsForDocuments(clientLEId: string, documentIds: string[]): Promise<(PartyDocumentHistory & { partyId: string })[]> {
        if (documentIds.length === 0) return [];

        // 1. Find instance IDs that have ever referenced these documents within this clientLE
        const recordsReferencingDocs = await prisma.cCPartyDocument.findMany({
            where: {
                documentId: { in: documentIds },
                party: { clientLEId }
            },
            select: { instanceId: true }
        });

        const instanceIds = Array.from(new Set(recordsReferencingDocs.map((c: { instanceId: string }) => c.instanceId)));
        if (instanceIds.length === 0) return [];

        // 2. Fetch full history for those instances
        const allRecordsForInstances = await prisma.cCPartyDocument.findMany({
            where: {
                instanceId: { in: instanceIds }
            },
            orderBy: [{ assertedAt: 'desc' }, { id: 'desc' }]
        });

        // 3. Delegate to canonical lifecycle resolver
        const historiesMap = PartyDocumentLifecycleResolver.resolveHistories(allRecordsForInstances);
        
        // 4. Return only active ones that currently point to the requested documents
        const active = Array.from(historiesMap.values()).filter(h => 
            !h.isRemoved && 
            h.currentDocumentId && 
            documentIds.includes(h.currentDocumentId)
        );

        // Map the partyId back onto the history object for convenience
        return active.map(h => {
            const firstEvent = h.events[0];
            return {
                ...h,
                partyId: firstEvent.partyId
            };
        });
    }

    static async attachDocument(input: AttachPartyDocumentInput): Promise<CCPartyDocument> {
        await this.validatePartyAndDocumentExists(input.partyId, input.documentId);
        const instanceId = uuidv4();
        
        return await this.appendLifecycleEvent({
            partyId: input.partyId,
            documentId: input.documentId,
            instanceId,
            operation: CCPartyDocumentOperation.ATTACH,
            idempotencyKey: input.idempotencyKey,
            assertedById: input.assertedById,
        });
    }

    /**
     * Replaces an existing party document instance with a new document.
     */
    static async replaceDocument(input: ReplacePartyDocumentInput): Promise<CCPartyDocument> {
        await this.validatePartyAndDocumentExists(input.partyId, input.documentId);
        await this.validateInstance(input.partyId, input.instanceId);

        return await this.appendLifecycleEvent({
            partyId: input.partyId,
            documentId: input.documentId,
            instanceId: input.instanceId,
            operation: CCPartyDocumentOperation.REPLACE,
            idempotencyKey: input.idempotencyKey,
            assertedById: input.assertedById,
        });
    }

    /**
     * Removes an existing party document instance.
     */
    static async removeDocument(input: RemovePartyDocumentInput): Promise<CCPartyDocument> {
        // Find the active document for this instance to carry forward its documentId in the REMOVE event.
        const instance = await this.validateInstance(input.partyId, input.instanceId);

        return await this.appendLifecycleEvent({
            partyId: input.partyId,
            documentId: instance.documentId, // Keep the relation valid even though it's removed
            instanceId: input.instanceId,
            operation: CCPartyDocumentOperation.REMOVE,
            idempotencyKey: input.idempotencyKey,
            assertedById: input.assertedById,
        });
    }

    // ── Private ─────────────────────────────────────────────────────────────

    private static async appendLifecycleEvent(input: {
        partyId: string;
        documentId: string;
        instanceId: string;
        operation: CCPartyDocumentOperation;
        idempotencyKey?: string;
        assertedById?: string;
    }): Promise<CCPartyDocument> {
        // Idempotency check before creation
        if (input.idempotencyKey) {
            const existing = await prisma.cCPartyDocument.findUnique({
                where: { idempotencyKey: input.idempotencyKey }
            });
            if (existing) {
                if (existing.partyId !== input.partyId) throw new Error("Idempotency conflict: partyId mismatch");
                if (existing.documentId !== input.documentId) throw new Error("Idempotency conflict: documentId mismatch");
                if (input.operation !== CCPartyDocumentOperation.ATTACH && existing.instanceId !== input.instanceId) {
                    throw new Error("Idempotency conflict: instanceId mismatch");
                }
                if (existing.operation !== input.operation) throw new Error("Idempotency conflict: operation mismatch");
                return existing;
            }
        }

        try {
            return await prisma.cCPartyDocument.create({
                data: {
                    partyId: input.partyId,
                    documentId: input.documentId,
                    instanceId: input.instanceId,
                    operation: input.operation,
                    idempotencyKey: input.idempotencyKey,
                    assertedById: input.assertedById,
                }
            });
        } catch (error: any) {
            // Handle race condition on idempotency key
            if (input.idempotencyKey && error.code === 'P2002') {
                const existing = await prisma.cCPartyDocument.findUnique({
                    where: { idempotencyKey: input.idempotencyKey }
                });
                if (existing) {
                    return existing;
                }
            }
            throw error;
        }
    }

    private static async validatePartyAndDocumentExists(partyId: string, documentId: string) {
        const party = await prisma.cCParty.findUnique({ where: { id: partyId } });
        if (!party) throw new Error(`Party ${partyId} not found.`);

        const doc = await prisma.document.findUnique({ where: { id: documentId } });
        if (!doc) throw new Error(`Document ${documentId} not found.`);
    }

    private static async validateInstance(partyId: string, instanceId: string): Promise<CCPartyDocument> {
        const docs = await prisma.cCPartyDocument.findMany({
            where: { partyId, instanceId },
            orderBy: [{ assertedAt: 'desc' }, { id: 'desc' }]
        });

        if (docs.length === 0) {
            throw new Error(`Instance ${instanceId} not found for party ${partyId}.`);
        }

        const latest = docs[0];
        if (latest.operation === CCPartyDocumentOperation.REMOVE) {
            throw new Error(`Instance ${instanceId} has already been removed.`);
        }

        return latest;
    }

    /**
     * Resolves complete chronological party document history involving a specific document.
     */
    static async getAttachmentHistoryForDocument(clientLEId: string, documentId: string): Promise<(import('./PartyDocumentLifecycleResolver').PartyDocumentHistory & { partyId: string })[]> {
        const recordsReferencingDoc = await prisma.cCPartyDocument.findMany({
            where: { documentId: documentId, party: { clientLEId } },
            select: { instanceId: true }
        });

        const instanceIds = Array.from(new Set(recordsReferencingDoc.map((c: { instanceId: string }) => c.instanceId)));

        if (instanceIds.length === 0) return [];

        const allRecordsForInstances = await prisma.cCPartyDocument.findMany({
            where: { instanceId: { in: instanceIds }, party: { clientLEId } },
            orderBy: [{ assertedAt: 'asc' }, { id: 'asc' }],
            include: { document: true }
        });

        const histories = PartyDocumentLifecycleResolver.resolveHistories(allRecordsForInstances);
        
        const instancePartyMap = new Map<string, string>();
        for (const record of allRecordsForInstances) {
            if (!instancePartyMap.has(record.instanceId)) {
                instancePartyMap.set(record.instanceId, record.partyId);
            }
        }

        return Array.from(histories.values()).map(h => ({
            ...h,
            partyId: instancePartyMap.get(h.instanceId)!
        }));
    }

}
