import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { ensureApiAuthorization } from '@/lib/auth/api-auth';
import { Action } from '@/lib/auth/permissions';
import { DocumentService } from '@/lib/documents/DocumentService';
import { randomUUID } from 'crypto';

export async function POST(request: Request): Promise<NextResponse> {
    const body = (await request.json()) as HandleUploadBody;

    try {
        const jsonResponse = await handleUpload({
            body,
            request,
            onBeforeGenerateToken: async (pathname: string, clientPayload: string | null) => {
                const payload = clientPayload ? JSON.parse(clientPayload) : {};
                const clientLEId = payload.clientLEId;

                if (!clientLEId) {
                    throw new Error("Missing clientLEId");
                }

                // 1. Authenticate and authorize LE_EDIT_MASTER_DATA
                const { userId } = await ensureApiAuthorization(Action.LE_EDIT_MASTER_DATA, { clientLEId });

                // 2. Generate the immutable UUID pathname server-side
                const uuid = randomUUID();
                const storagePathname = `private-documents/${clientLEId}/${uuid}`;
                
                // 3. Ensure token is configured
                const token = process.env.PRIVATE_BLOB_READ_WRITE_TOKEN;
                if (!token) {
                    throw new Error("CRITICAL: PRIVATE_BLOB_READ_WRITE_TOKEN is missing.");
                }

                // 4. Issue upload token for the private Blob store
                return {
                    token,
                    allowedContentTypes: [
                        'application/pdf', 
                        'image/jpeg', 
                        'image/png', 
                        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
                        'text/plain'
                    ],
                    // We trust this state in onUploadCompleted
                    tokenPayload: JSON.stringify({ 
                        userId, 
                        clientLEId, 
                        originalFilename: pathname,
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
                try {
                    const payload = JSON.parse(tokenPayload || "{}");
                    const { userId, clientLEId, originalFilename, trustedPathname } = payload;

                    if (!userId || !clientLEId || !trustedPathname) {
                        throw new Error("Invalid token payload state");
                    }

                    // 5. Trust Verification: Assert that the blob was actually uploaded to the approved path
                    if (blob.pathname !== trustedPathname) {
                        console.error(`[upload-completed] Tampering detected! Expected pathname ${trustedPathname} but got ${blob.pathname}`);
                        throw new Error("Blob pathname mismatch");
                    }

                    // 6. Verify and persist the upload natively server-side
                    await DocumentService.verifyAndPersistPrivateUpload({
                        storagePathname: blob.pathname,
                        originalFilename: originalFilename || blob.pathname,
                        clientLEId,
                        uploadedById: userId,
                    });

                } catch (e) {
                    console.error('[upload-completed] Failed to process upload:', e);
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
