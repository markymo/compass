import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { ensureApiAuthorization } from '@/lib/auth/api-auth';
import { Action } from '@/lib/auth/permissions';
import { DocumentService } from '@/lib/documents/DocumentService';
import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';
import { ALLOWED_PRIVATE_DOCUMENT_TYPES } from '@/lib/documents/file-config';

export async function POST(request: Request): Promise<NextResponse> {
    const body = (await request.json()) as HandleUploadBody;

    const token = process.env.PRIVATE_BLOB_READ_WRITE_TOKEN;
    if (!token) {
        return NextResponse.json(
            { error: "CRITICAL: PRIVATE_BLOB_READ_WRITE_TOKEN is missing." },
            { status: 500 }
        );
    }

    try {
        const jsonResponse = await handleUpload({
            token,
            body,
            request,
            onBeforeGenerateToken: async (pathname: string, clientPayload: string | null) => {
                const payload = clientPayload ? JSON.parse(clientPayload) : {};
                const clientLEId = payload.clientLEId;
                const intentId = payload.intentId;

                if (!clientLEId) {
                    throw new Error("Missing clientLEId");
                }
                
                if (!intentId || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(intentId)) {
                    throw new Error("Missing or invalid intentId");
                }

                // 1. Authenticate and authorize LE_EDIT_MASTER_DATA
                const { userId } = await ensureApiAuthorization(Action.LE_EDIT_MASTER_DATA, { clientLEId });

                // 2. Generate the immutable UUID pathname server-side
                const uuid = randomUUID();
                const storagePathname = `private-documents/${clientLEId}/${uuid}`;
                
                // 3. (Token is already validated and passed at the top level)

                // Verify the intent doesn't already exist to prevent replay
                const existingIntent = await prisma.privateDocumentUploadIntent.findUnique({
                    where: { id: intentId }
                });
                if (existingIntent) {
                    throw new Error("Intent ID already exists");
                }

                // 4. Create the PENDING intent
                const intent = await prisma.privateDocumentUploadIntent.create({
                    data: {
                        id: intentId,
                        clientLEId,
                        initiatedById: userId,
                        storagePathname,
                        originalFilename: pathname,
                        declaredMimeType: payload.mimeType || null,
                        status: 'PENDING'
                    }
                });

                // 5. Issue upload token for the private Blob store
                // We use the flattened allowed MIME types plus '' for CSV fallback
                const allowedContentTypes = Object.values(ALLOWED_PRIVATE_DOCUMENT_TYPES)
                    .flatMap(t => t.mimeTypes)
                    .filter(m => m !== ''); // Vercel Blob doesn't accept empty string in allowedContentTypes array, but will just not restrict if we don't pass it? Wait.
                // Vercel Blob allowedContentTypes doesn't accept ''. Let's just pass the valid ones.
                
                return {
                    token,
                    // If CSV empty mime type is an issue, Vercel Blob might reject. The config enforces it on the server token side.
                    allowedContentTypes: [
                        'application/pdf', 
                        'image/jpeg', 
                        'image/png', 
                        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
                        'application/msword',
                        'application/vnd.ms-excel',
                        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                        'application/vnd.ms-powerpoint',
                        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                        'text/csv',
                        'application/csv',
                        'text/plain'
                    ],
                    // We trust this state in onUploadCompleted
                    tokenPayload: JSON.stringify({ 
                        intentId: intent.id,
                        trustedPathname: storagePathname
                    }),
                    // Force the generated server-side pathname
                    pathname: storagePathname,
                    addRandomSuffix: false, // We use UUID for uniqueness
                    access: 'private',      // Enforce private blob
                    maximumSizeInBytes: 20 * 1024 * 1024, // 20MB Phase 3 limit
                };
            },
            onUploadCompleted: async ({ blob, tokenPayload }) => {
                let intentId = '';
                try {
                    const payload = JSON.parse(tokenPayload || "{}");
                    intentId = payload.intentId;
                    const trustedPathname = payload.trustedPathname;

                    if (!intentId || !trustedPathname) {
                        throw new Error("Invalid token payload state");
                    }

                    // 6. Trust Verification: Assert that the blob was actually uploaded to the approved path
                    if (blob.pathname !== trustedPathname) {
                        console.error(`[upload-completed] Tampering detected! Expected pathname ${trustedPathname} but got ${blob.pathname}`);
                        throw new Error("Blob pathname mismatch");
                    }

                    // 7. Verify and persist the upload natively server-side
                    const intent = await prisma.privateDocumentUploadIntent.findUnique({
                        where: { id: intentId }
                    });

                    if (!intent) {
                        throw new Error("Upload intent not found");
                    }

                    if (intent.status === 'COMPLETED') {
                        return; // Idempotent retry
                    }
                    
                    if (intent.status === 'FAILED') {
                        return; // Terminal state
                    }

                    // DocumentService handles the transaction and intent completion atomically
                    await DocumentService.verifyAndPersistPrivateUpload({
                        storagePathname: blob.pathname,
                        originalFilename: intent.originalFilename,
                        clientLEId: intent.clientLEId,
                        uploadedById: intent.initiatedById,
                        intentId
                    });

                } catch (e) {
                    console.error('[upload-completed] Failed to process upload:', e);
                    if (intentId) {
                        try {
                            await prisma.privateDocumentUploadIntent.updateMany({
                                where: { id: intentId, status: 'PENDING' },
                                data: {
                                    status: 'FAILED',
                                    failureReason: 'System error during completion',
                                    completedAt: new Date()
                                }
                            });
                        } catch (updateErr) {
                            console.error('Failed to mark intent as failed', updateErr);
                        }
                    }
                    throw e; // Vercel Blob catches this and returns 400 to client
                }
            },
        });

        return NextResponse.json(jsonResponse);
    } catch (error) {
        return NextResponse.json(
            { error: (error as Error).message },
            { status: 400 },
        );
    }
}
