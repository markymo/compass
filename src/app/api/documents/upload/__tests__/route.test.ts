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

describe('Upload Route Token Configuration', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.resetAllMocks();
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    const createMockRequest = () => {
        return new Request('http://localhost/api/documents/upload', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                type: 'blob.generate-client-token',
                payload: {
                    pathname: 'test.pdf',
                    clientPayload: JSON.stringify({ clientLEId: 'le-1', intentId: 'intent-1' })
                }
            })
        });
    };

    it('fails closed with a 500 status when PRIVATE_BLOB_READ_WRITE_TOKEN is missing', async () => {
        delete process.env.PRIVATE_BLOB_READ_WRITE_TOKEN;
        
        // Even if the legacy BLOB_READ_WRITE_TOKEN is present, it must fail because 
        // the explicit PRIVATE token is missing.
        process.env.BLOB_READ_WRITE_TOKEN = 'legacy_token';

        const request = createMockRequest();
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('CRITICAL: PRIVATE_BLOB_READ_WRITE_TOKEN is missing.');
        expect(handleUpload).not.toHaveBeenCalled();
    });

    it('passes PRIVATE_BLOB_READ_WRITE_TOKEN explicitly to handleUpload as top-level token property', async () => {
        process.env.PRIVATE_BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_test_token';
        
        // Ensure legacy token is not present
        delete process.env.BLOB_READ_WRITE_TOKEN;

        // Mock handleUpload to just return success without invoking callbacks
        vi.mocked(handleUpload).mockResolvedValueOnce({
            type: 'blob.generate-client-token',
            clientToken: 'test-client-token'
        });

        const request = createMockRequest();
        const response = await POST(request);
        
        expect(response.status).toBe(200);

        // Verify that handleUpload was called exactly once
        expect(handleUpload).toHaveBeenCalledTimes(1);

        // Extract the arguments passed to handleUpload
        const callArgs = vi.mocked(handleUpload).mock.calls[0][0];

        // The critical assertion: 'token' must be explicitly passed at the top level
        expect(callArgs.token).toBe('vercel_blob_rw_test_token');
        expect(callArgs.request).toBe(request);
        expect(callArgs.body).toBeDefined();
        expect(callArgs.onBeforeGenerateToken).toBeDefined();
    });
});
