'use server';

import { getIdentity } from '@/lib/auth';
import { getActorContext } from '@/lib/auth/actor-context';
import { can, Action } from '@/lib/auth/permissions';
import { FieldClaimService } from '@/lib/kyc/FieldClaimService';
import { SourceType } from '@prisma/client';
import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { ActionDomainError, handleActionError } from '@/lib/action-error-handler';

export type AttachmentActionParams = {
    clientLEId: string;
    fieldNo: number;
    ownerScopeId?: string;
    idempotencyKey?: string;
};

async function resolveSubject(clientLEId: string) {
    const le = await prisma.clientLE.findUnique({ where: { id: clientLEId } });
    if (!le) throw new ActionDomainError('ClientLE not found');
    return { clientLEId, subjectLeId: le.legalEntityId ?? null };
}

export async function addFieldAttachment(
    params: AttachmentActionParams & { attachmentDocumentId: string }
) {
    try {
        const identity = await getIdentity();
        if (!identity?.userId) throw new ActionDomainError('Unauthenticated');

        const actor = await getActorContext(identity.userId);
        const hasAccess = await can(actor, Action.LE_EDIT_MASTER_DATA, { clientLEId: params.clientLEId }, prisma);
        if (!hasAccess) throw new ActionDomainError('Unauthorized');

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
        return { success: true, claim: result, id: result.id, instanceId: result.instanceId };
    } catch (error: any) {
        return handleActionError(error, {
            operation: "Add field attachment",
            fallbackMessage: "We couldn’t add this attachment.",
            context: { clientLEId: params.clientLEId, fieldNo: params.fieldNo, attachmentDocumentId: params.attachmentDocumentId }
        });
    }
}

export async function replaceFieldAttachment(
    params: AttachmentActionParams & { instanceId: string; attachmentDocumentId: string }
) {
    try {
        const identity = await getIdentity();
        if (!identity?.userId) throw new ActionDomainError('Unauthenticated');

        const actor = await getActorContext(identity.userId);
        const hasAccess = await can(actor, Action.LE_EDIT_MASTER_DATA, { clientLEId: params.clientLEId }, prisma);
        if (!hasAccess) throw new ActionDomainError('Unauthorized');

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
        return { success: true, claim: result, id: result.id, instanceId: result.instanceId };
    } catch (error: any) {
        return handleActionError(error, {
            operation: "Replace field attachment",
            fallbackMessage: "We couldn’t replace this attachment.",
            context: { clientLEId: params.clientLEId, fieldNo: params.fieldNo, instanceId: params.instanceId, attachmentDocumentId: params.attachmentDocumentId }
        });
    }
}

export async function removeFieldAttachment(
    params: AttachmentActionParams & { instanceId: string }
) {
    try {
        const identity = await getIdentity();
        if (!identity?.userId) throw new ActionDomainError('Unauthenticated');

        const actor = await getActorContext(identity.userId);
        const hasAccess = await can(actor, Action.LE_EDIT_MASTER_DATA, { clientLEId: params.clientLEId }, prisma);
        if (!hasAccess) throw new ActionDomainError('Unauthorized');

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
        return { success: true, claim: result, id: result.id, instanceId: result.instanceId };
    } catch (error: any) {
        return handleActionError(error, {
            operation: "Remove field attachment",
            fallbackMessage: "We couldn’t remove this attachment.",
            context: { clientLEId: params.clientLEId, fieldNo: params.fieldNo, instanceId: params.instanceId }
        });
    }
}
