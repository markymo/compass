'use server';

import { getIdentity } from '@/lib/auth';
import { FieldClaimService } from '@/lib/kyc/FieldClaimService';
import { SourceType } from '@prisma/client';
import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export type AttachmentActionParams = {
    clientLEId: string;
    fieldNo: number;
    ownerScopeId?: string;
    idempotencyKey?: string;
};

async function resolveSubject(clientLEId: string) {
    const le = await prisma.clientLE.findUnique({ where: { id: clientLEId } });
    if (!le?.legalEntityId) throw new Error('Could not resolve LegalEntity subject');
    return { clientLEId, subjectLeId: le.legalEntityId };
}

export async function addFieldAttachment(
    params: AttachmentActionParams & { attachmentDocumentId: string }
) {
    const identity = await getIdentity();
    if (!identity) throw new Error('Unauthenticated');

    const subject = await resolveSubject(params.clientLEId);

    const result = await FieldClaimService.addAttachment(
        subject,
        params.fieldNo,
        params.attachmentDocumentId,
        params.ownerScopeId || null,
        SourceType.USER_INPUT,
        params.idempotencyKey
    );
    
    revalidatePath(`/app/le/${params.clientLEId}`, 'layout');
    return result;
}

export async function replaceFieldAttachment(
    params: AttachmentActionParams & { instanceId: string; attachmentDocumentId: string }
) {
    const identity = await getIdentity();
    if (!identity) throw new Error('Unauthenticated');

    const subject = await resolveSubject(params.clientLEId);

    const result = await FieldClaimService.replaceAttachment(
        subject,
        params.fieldNo,
        params.instanceId,
        params.attachmentDocumentId,
        params.ownerScopeId || null,
        SourceType.USER_INPUT,
        params.idempotencyKey
    );
    
    revalidatePath(`/app/le/${params.clientLEId}`, 'layout');
    return result;
}

export async function removeFieldAttachment(
    params: AttachmentActionParams & { instanceId: string }
) {
    const identity = await getIdentity();
    if (!identity) throw new Error('Unauthenticated');

    const subject = await resolveSubject(params.clientLEId);

    const result = await FieldClaimService.removeAttachment(
        subject,
        params.fieldNo,
        params.instanceId,
        params.ownerScopeId || null,
        SourceType.USER_INPUT,
        params.idempotencyKey
    );

    revalidatePath(`/app/le/${params.clientLEId}`, 'layout');
    return result;
}
