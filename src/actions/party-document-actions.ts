'use server';

import { CCPartyDocumentService } from '@/lib/documents/party/CCPartyDocumentService';
import { ensureApiAuthorization } from '@/lib/auth/api-auth';
import { Action } from '@/lib/auth/permissions';
import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';

export async function attachPartyDocument(params: {
    clientLEId: string;
    partyId: string;
    documentId: string;
    idempotencyKey?: string;
}) {
    const { userId } = await ensureApiAuthorization(Action.LE_EDIT_MASTER_DATA, { clientLEId: params.clientLEId });

    // Validate the party belongs to the clientLE
    const party = await prisma.cCParty.findUnique({ where: { id: params.partyId } });
    if (!party || party.clientLEId !== params.clientLEId) {
        throw new Error('Party not found or access denied');
    }

    const result = await CCPartyDocumentService.attachDocument({
        partyId: params.partyId,
        documentId: params.documentId,
        idempotencyKey: params.idempotencyKey,
        assertedById: userId,
    });

    revalidatePath(`/client/${params.clientLEId}/parties/${params.partyId}`);
    return result;
}

export async function replacePartyDocument(params: {
    clientLEId: string;
    partyId: string;
    instanceId: string;
    documentId: string;
    idempotencyKey?: string;
}) {
    const { userId } = await ensureApiAuthorization(Action.LE_EDIT_MASTER_DATA, { clientLEId: params.clientLEId });

    const party = await prisma.cCParty.findUnique({ where: { id: params.partyId } });
    if (!party || party.clientLEId !== params.clientLEId) {
        throw new Error('Party not found or access denied');
    }

    const result = await CCPartyDocumentService.replaceDocument({
        partyId: params.partyId,
        instanceId: params.instanceId,
        documentId: params.documentId,
        idempotencyKey: params.idempotencyKey,
        assertedById: userId,
    });

    revalidatePath(`/client/${params.clientLEId}/parties/${params.partyId}`);
    return result;
}

export async function removePartyDocument(params: {
    clientLEId: string;
    partyId: string;
    instanceId: string;
    idempotencyKey?: string;
}) {
    const { userId } = await ensureApiAuthorization(Action.LE_EDIT_MASTER_DATA, { clientLEId: params.clientLEId });

    const party = await prisma.cCParty.findUnique({ where: { id: params.partyId } });
    if (!party || party.clientLEId !== params.clientLEId) {
        throw new Error('Party not found or access denied');
    }

    const result = await CCPartyDocumentService.removeDocument({
        partyId: params.partyId,
        instanceId: params.instanceId,
        idempotencyKey: params.idempotencyKey,
        assertedById: userId,
    });

    revalidatePath(`/client/${params.clientLEId}/parties/${params.partyId}`);
    return result;
}

export async function listPartyDocuments(params: {
    clientLEId: string;
    partyId: string;
}) {
    await ensureApiAuthorization(Action.LE_VIEW_MASTER_DATA, { clientLEId: params.clientLEId });

    const party = await prisma.cCParty.findUnique({ where: { id: params.partyId } });
    if (!party || party.clientLEId !== params.clientLEId) {
        throw new Error('Party not found or access denied');
    }

    const histories = await CCPartyDocumentService.resolvePartyDocuments(params.partyId);
    
    // In order to show originalFilename and uploadedAt, we need to join with Document.
    // The service returns currentDocumentId for active documents.
    const activeDocIds = histories.map(h => h.currentDocumentId).filter(Boolean) as string[];
    
    const docs = await prisma.document.findMany({
        where: { id: { in: activeDocIds } }
    });

    const docMap = new Map<string, any>(docs.map((d: any) => [d.id, d]));

    // Construct the view model
    return histories.map(h => {
        const doc = docMap.get(h.currentDocumentId!);
        return {
            instanceId: h.instanceId,
            documentId: doc!.id,
            originalFilename: doc!.name,
            sizeBytes: doc!.sizeBytes,
            createdAt: doc!.createdAt,
            // also get the upload date from the CCPartyDocument attach event
            // h.events[0] is the latest event (which could be ATTACH or REPLACE)
            attachedAt: h.events[0].assertedAt,
        };
    });
}
