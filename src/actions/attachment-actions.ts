'use server';

import { getIdentity } from '@/lib/auth';
import { getActorContext } from '@/lib/auth/actor-context';
import { can, Action } from '@/lib/auth/permissions';
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
    if (!le) throw new Error('ClientLE not found');
    return { clientLEId, subjectLeId: le.legalEntityId ?? null };
}

export async function addFieldAttachment(
    params: AttachmentActionParams & { attachmentDocumentId: string }
) {
    const identity = await getIdentity();
    if (!identity?.userId) throw new Error('Unauthenticated');

    const actor = await getActorContext(identity.userId);
    const hasAccess = await can(actor, Action.LE_EDIT_MASTER_DATA, { clientLEId: params.clientLEId }, prisma);
    if (!hasAccess) throw new Error('Unauthorized');

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
    if (!identity?.userId) throw new Error('Unauthenticated');

    const actor = await getActorContext(identity.userId);
    const hasAccess = await can(actor, Action.LE_EDIT_MASTER_DATA, { clientLEId: params.clientLEId }, prisma);
    if (!hasAccess) throw new Error('Unauthorized');

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
    if (!identity?.userId) throw new Error('Unauthenticated');

    const actor = await getActorContext(identity.userId);
    const hasAccess = await can(actor, Action.LE_EDIT_MASTER_DATA, { clientLEId: params.clientLEId }, prisma);
    if (!hasAccess) throw new Error('Unauthorized');

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
