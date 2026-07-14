import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { ensureApiAuthorization } from '@/lib/auth/api-auth';
import { Action } from '@/lib/auth/permissions';
import { DocumentService } from '@/lib/documents/DocumentService';
import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';

/**
 * Resolves the base URL of this deployment so the Vercel Blob SDK can
 * determine the `callbackUrl` for the upload-completed webhook.
 *
 * When VERCEL is not "1" (e.g. custom domain deployments) the SDK's
 * auto-detection falls back to undefined, which causes the browser client
 * to use local-dev proxy mode (blob/?pathname=...) instead of the real
 * Vercel Blob endpoint.  Providing the URL explicitly avoids that.
 */
function resolveDeploymentBaseUrl(request: Request): string {
    // Explicit override wins
    if (process.env.VERCEL_BLOB_CALLBACK_URL) {
        return process.env.VERCEL_BLOB_CALLBACK_URL;
    }
    
    // 1. Prefer the actual host the user is hitting (vital for custom domains like dev.onpro.tech)
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
    const proto = request.headers.get('x-forwarded-proto') || 'https';
    if (host && !host.includes('localhost')) {
        return `${proto}://${host}`;
    }

    // 2. Vercel-injected vars (Specific deployment -> Branch -> Production)
    if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL}`;
    }
    if (process.env.VERCEL_BRANCH_URL) {
        return `https://${process.env.VERCEL_BRANCH_URL}`;
    }
    if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
        return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
    }
    
    // 3. Fall back to deriving from the incoming request url
    const { origin } = new URL(request.url);
    return origin;
}

export async function POST(request: Request): Promise<NextResponse> {
    const body = (await request.json()) as HandleUploadBody;

    const token = process.env.PRIVATE_BLOB_READ_WRITE_TOKEN;
    if (!token) {
        return NextResponse.json(
            { error: "CRITICAL: PRIVATE_BLOB_READ_WRITE_TOKEN is missing." },
            { status: 500 }
        );
    }

    // Determine the callback URL up-front so onBeforeGenerateToken can embed
    // it explicitly — preventing the SDK from falling back to dev-proxy mode.
    const baseUrl = resolveDeploymentBaseUrl(request);
    const callbackUrl = `${baseUrl}/api/documents/upload`;

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

                // 2. Validate the client-provided pathname
                const expectedPrefix = `private-documents/${clientLEId}/${intentId}/`;
                if (!pathname.startsWith(expectedPrefix)) {
                    console.error(`[upload-auth] Pathname mismatch. Expected prefix ${expectedPrefix}, got ${pathname}`);
                    throw new Error("Invalid storage pathname requested by client.");
                }
                
                const storagePathname = pathname;
                const originalFilename = pathname.slice(expectedPrefix.length);

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
                        originalFilename,
                        declaredMimeType: payload.mimeType || null,
                        status: 'PENDING'
                    }
                });

                // 5. Build the token options for the private Blob store.
                return {
                    callbackUrl,  // Explicit URL prevents SDK from falling back to dev-proxy mode
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
                    addRandomSuffix: false, // Client provided full unique path
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
