import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { getIdentity } from "@/lib/auth";
import { recordActivity, LEActivityType } from "@/lib/le-activity";

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

                return {
                    allowedContentTypes: ['application/pdf', 'image/jpeg', 'image/png', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
                    tokenPayload: JSON.stringify({ userId, clientPayload }),
                };
            },
            onUploadCompleted: async ({ blob, tokenPayload }) => {
                try {
                    const payload = JSON.parse(tokenPayload || "{}");
                    const { userId } = payload;
                    const clientData = payload.clientPayload ? JSON.parse(payload.clientPayload) : {};
                    const leId = clientData?.leId;

                    if (leId && userId) {
                        recordActivity(leId, userId, LEActivityType.DOC_UPLOADED, {
                            docName: blob.pathname.split("/").pop() ?? blob.pathname,
                            blobUrl: blob.url,
                        });
                    }
                    console.log('Upload completed:', blob.pathname);
                } catch (e) {
                    console.error('Upload activity log failed:', e);
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
