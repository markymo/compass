import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import { getIdentity } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const identity = await getIdentity();
        if (!identity?.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const leId = formData.get('leId') as string | null;
        const fieldKey = formData.get('fieldKey') as string | null;

        if (!file || !leId || !fieldKey) {
            return NextResponse.json({ error: 'Missing file, leId, or fieldKey' }, { status: 400 });
        }

        // Upload to Vercel Blob using server-side SDK (no client handshake needed)
        const blob = await put(file.name, file, {
            access: 'public',
            addRandomSuffix: true,
        });

        // Save Document record linked to this master field
        const document = await prisma.document.create({
            data: {
                clientLEId: leId,
                name: file.name,
                fileUrl: blob.url,
                fileType: file.name.split('.').pop() || 'unknown',
                kbSize: Math.round(file.size / 1024),
                docType: 'EVIDENCE',
                masterFieldKey: fieldKey,
            }
        });

        revalidatePath(`/app/le/${leId}/master`);
        revalidatePath(`/app/le/${leId}/sources/vault`);

        return NextResponse.json({ success: true, document, url: blob.url });
    } catch (error: any) {
        console.error('[upload-evidence]', error);
        return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
    }
}
