import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { get } from '@vercel/blob';
import { ensureApiAuthorization } from '@/lib/auth/api-auth';
import { Action } from '@/lib/auth/permissions';

const getToken = () => process.env.PRIVATE_BLOB_READ_WRITE_TOKEN;

export async function GET(
    request: Request,
    context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
    try {
        const { id } = await context.params;
        const document = await prisma.document.findUnique({
            where: { id }
        });

        if (!document) {
            return new NextResponse("Document not found", { status: 404 });
        }

        // 1. Authorize owner-side access via clientLEId
        try {
            await ensureApiAuthorization(Action.LE_VIEW_MASTER_DATA, { clientLEId: document.clientLEId });
        } catch (e) {
            return new NextResponse("Forbidden", { status: 403 });
        }

        // 2. Fetch the document stream
        let stream: ReadableStream | null = null;
        let mimeType = document.mimeType || 'application/octet-stream';

        if (document.storageProvider === "VERCEL_BLOB" && document.storagePathname) {
            // Fetch the private blob using server-side Vercel SDK
            const result = await get(document.storagePathname, { token: getToken(), access: 'private' });
            if (result && result.stream) {
                stream = result.stream as unknown as ReadableStream;
            }
        }

        if (!stream) {
            if (document.storageProvider !== "VERCEL_BLOB") {
                return new NextResponse("Document is not a downloadable file", { status: 400 });
            }
            return new NextResponse("Failed to retrieve document stream", { status: 500 });
        }

        // 4. Safely encode filename for Content-Disposition
        const encodedFilename = encodeURIComponent(document.name || 'document').replace(/['()]/g, escape).replace(/\*/g, '%2A');

        // 5. Stream the document to the client
        return new NextResponse(stream, {
            headers: {
                'Content-Type': mimeType,
                'Content-Disposition': `attachment; filename*=UTF-8''${encodedFilename}`,
                'X-Content-Type-Options': 'nosniff',
                'Cache-Control': 'private, no-store',
            }
        });

    } catch (error) {
        console.error("[Download API] Error:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
