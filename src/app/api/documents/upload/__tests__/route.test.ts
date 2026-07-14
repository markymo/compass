import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '../route';
import { handleUpload } from '@vercel/blob/client';

// Mock Next.js NextResponse
vi.mock('next/server', () => ({
    NextResponse: {
        json: (body: any, init?: ResponseInit) => {
            return new Response(JSON.stringify(body), {
                status: init?.status || 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }
}));

// Mock Auth
vi.mock('@/lib/auth/api-auth', () => ({
    ensureApiAuthorization: vi.fn().mockResolvedValue({ userId: 'test-user-123' })
}));

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
    default: {
        privateDocumentUploadIntent: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({ id: 'intent-1' })
        }
    }
}));

// Mock the Vercel Blob SDK
vi.mock('@vercel/blob/client', () => ({
    handleUpload: vi.fn(),
}));

describe('Upload Route — PRIVATE_BLOB_READ_WRITE_TOKEN', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.resetAllMocks();
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    const makeRequest = () =>
        new Request('http://localhost/api/documents/upload', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                type: 'blob.generate-client-token',
                payload: {
                    pathname: 'test.pdf',
                    clientPayload: JSON.stringify({ clientLEId: 'le-1', intentId: 'intent-1' })
                }
            })
        });

    it('fails closed with a 500 when PRIVATE_BLOB_READ_WRITE_TOKEN is missing', async () => {
        delete process.env.PRIVATE_BLOB_READ_WRITE_TOKEN;

        // Even when the legacy fallback token is present the route must still fail —
        // proving the SDK fallback to BLOB_READ_WRITE_TOKEN is not relied upon.
        process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_legacy_token';

        const response = await POST(makeRequest());
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('CRITICAL: PRIVATE_BLOB_READ_WRITE_TOKEN is missing.');
        // handleUpload must never be called — the route must fail before reaching the SDK
        expect(handleUpload).not.toHaveBeenCalled();
    });

    it('passes PRIVATE_BLOB_READ_WRITE_TOKEN explicitly as the top-level token to handleUpload', async () => {
        process.env.PRIVATE_BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_private_test_token';
        // Ensure the SDK cannot fall back to the legacy env var
        delete process.env.BLOB_READ_WRITE_TOKEN;

        vi.mocked(handleUpload).mockResolvedValueOnce({
            type: 'blob.generate-client-token',
            clientToken: 'test-client-token'
        });

        const request = makeRequest();
        const response = await POST(request);

        expect(response.status).toBe(200);
        expect(handleUpload).toHaveBeenCalledTimes(1);

        const callArgs = vi.mocked(handleUpload).mock.calls[0][0];

        // Critical: token must be the explicit PRIVATE var, passed at the top level
        expect(callArgs.token).toBe('vercel_blob_rw_private_test_token');
        expect(callArgs.request).toBe(request);
        expect(callArgs.body).toBeDefined();
        expect(callArgs.onBeforeGenerateToken).toBeDefined();
    });

    it('does not rely on the SDK fallback to BLOB_READ_WRITE_TOKEN — token is always explicit', async () => {
        // Set ONLY the legacy env var, NOT the private one.
        // The route must still fail closed, proving it never lets the SDK auto-discover
        // BLOB_READ_WRITE_TOKEN as a fallback.
        delete process.env.PRIVATE_BLOB_READ_WRITE_TOKEN;
        process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_should_never_be_used';

        const response = await POST(makeRequest());

        expect(response.status).toBe(500);
        expect(handleUpload).not.toHaveBeenCalled();
    });
});
