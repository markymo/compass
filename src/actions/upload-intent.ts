'use server';

import prisma from '@/lib/prisma';
import { getIdentity } from '@/lib/auth';
import { ResolvedAttachment } from '@/lib/master-data/field-display-model';

export type UploadIntentStatusResponse =
    | { status: 'pending' }
    | { status: 'completed'; attachment: ResolvedAttachment }
    | { status: 'failed'; message: string };

export async function getUploadIntentStatus(intentId: string): Promise<UploadIntentStatusResponse> {
    const identity = await getIdentity();
    if (!identity) {
        throw new Error('Unauthenticated');
    }

    const intent = await prisma.privateDocumentUploadIntent.findUnique({
        where: { id: intentId },
        include: {
            document: {
                include: {
                    uploadedBy: true
                }
            }
        }
    });

    if (!intent) {
        // From the perspective of the polling client, if it doesn't exist, it's failed or pending.
        // Returning pending allows the client to timeout naturally.
        return { status: 'pending' };
    }

    // Authorization: User must have LE_VIEW_MASTER_DATA for this LE
    // (We also enforce that the user was the initiator for this specific intent, for extra security during the upload flow)
    if (intent.initiatedById !== identity.userId) {
        throw new Error('Unauthorized: Intent does not belong to the current user');
    }
    if (intent.status === 'COMPLETED' && intent.document) {
        const doc = intent.document;
        const attachment: ResolvedAttachment = {
            instanceId: '', // Instance ID will be generated when the FieldClaim is created
            documentId: doc.id,
            displayName: doc.name || 'Untitled Document',
            mimeType: doc.mimeType,
            sizeBytes: doc.sizeBytes?.toString() || null,
            lifecycleCreatedAt: new Date().toISOString(), // Will be properly set by the field claim
            currentDocumentCreatedAt: doc.createdAt.toISOString(),
            uploadedBy: doc.uploadedBy ? { displayName: doc.uploadedBy.name } : undefined
        };
        return { status: 'completed', attachment };
    }

    if (intent.status === 'FAILED') {
        return { status: 'failed', message: intent.failureReason || 'Upload verification failed on the server.' };
    }

    return { status: 'pending' };
}
