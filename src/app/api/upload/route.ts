import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { getIdentity } from "@/lib/auth";

export async function POST(request: Request): Promise<NextResponse> {
    const body = (await request.json()) as HandleUploadBody;

    try {
        const jsonResponse = await handleUpload({
            body,
            request,
            onBeforeGenerateToken: async (pathname: string, clientPayload: string | null) => {
                const identity = await getIdentity();
                if (!identity?.userId) {
                    throw new Error('Unauthorized');
                }
                const { userId } = identity;

                // Ideally, check if user has access to the clientLE referenced in clientPayload
                // For now, we trust authenticated users

                return {
                    allowedContentTypes: ['application/pdf', 'image/jpeg', 'image/png'],
                    tokenPayload: JSON.stringify({
                        userId,
                        clientPayload
                    }),
                };
            },
            onUploadCompleted: async ({ blob, tokenPayload }) => {
                // This is called when upload happens successfully
                // We can log it or do background processing here
                console.log('Upload completed:', blob, tokenPayload);
            },
        });

        return NextResponse.json(jsonResponse);
    } catch (error) {
        return NextResponse.json(
            { error: (error as Error).message },
            { status: 400 }, // The webhook will retry 5 times automatically if the status code is 500
        );
    }
}
