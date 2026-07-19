import prisma from "@/lib/prisma";
import { get, put, del } from "@vercel/blob";
import * as crypto from "crypto";
import { Prisma, Document } from "@prisma/client";

const getToken = () => {
    const token = process.env.PRIVATE_BLOB_READ_WRITE_TOKEN;
    if (!token) {
        throw new Error("CRITICAL: PRIVATE_BLOB_READ_WRITE_TOKEN is missing. Cannot perform private store operation.");
    }
    return token;
};

export class DocumentService {
    /**
     * Helper to verify integrity of an existing document against the trusted context.
     */
    private static verifyExistingIntegrity(existingDoc: any, params: any) {
        const { clientLEId, ownerOrgId, uploadedById, storagePathname } = params;
        if (
            (existingDoc.clientLEId || null) !== (clientLEId || null) ||
            (existingDoc.ownerOrgId || null) !== (ownerOrgId || null) ||
            existingDoc.uploadedById !== uploadedById ||
            existingDoc.storageProvider !== "VERCEL_BLOB" ||
            existingDoc.storagePathname !== storagePathname
        ) {
            console.error(`[DocumentService] CRITICAL INTEGRITY CONFLICT: Existing document ${existingDoc.id} for path ${storagePathname} does not match trusted context.`, { expected: params, found: existingDoc });
            throw new Error("Critical integrity conflict detected for existing blob identity.");
        }
    }

    /**
     * The single authoritative implementation for creating immutable Document records.
     */
    static async createImmutableDocument(params: {
        storagePathname: string;
        originalFilename: string;
        clientLEId?: string;
        ownerOrgId?: string;
        uploadedById: string;
        sizeBytes: bigint;
        mimeType: string;
        checksum: string;
        intentId?: string;
    }): Promise<Document> {
        const { storagePathname, originalFilename, clientLEId, ownerOrgId, uploadedById, sizeBytes, mimeType, checksum, intentId } = params;

        if (!clientLEId && !ownerOrgId) {
            throw new Error("A Document must belong to either a clientLEId or an ownerOrgId.");
        }

        try {
            return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
                const doc = await tx.document.create({
                    data: {
                        name: originalFilename,
                        clientLEId,
                        ownerOrgId,
                        uploadedById,
                        isDeleted: false,
                        
                        storageProvider: "VERCEL_BLOB",
                        storagePathname,
                        sizeBytes,
                        mimeType,
                        checksum,
                    }
                });

                if (intentId) {
                    await tx.privateDocumentUploadIntent.update({
                        where: { id: intentId },
                        data: {
                            status: 'COMPLETED',
                            documentId: doc.id,
                            completedAt: new Date()
                        }
                    });
                }

                return doc;
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                console.log(`[DocumentService] Race condition: Another handler successfully persisted ${storagePathname}.`);
                const winner = await prisma.document.findUnique({ where: { storagePathname } });
                if (winner) {
                    DocumentService.verifyExistingIntegrity(winner, params);
                    return winner;
                }
            }
            throw error;
        }
    }

    /**
     * Verifies a completed client upload, calculates exact size and checksum from the stream,
     * and persists the immutable Document record.
     */
    static async verifyAndPersistPrivateUpload(params: {
        storagePathname: string;
        originalFilename: string;
        clientLEId?: string;
        ownerOrgId?: string;
        uploadedById: string;
        intentId?: string;
    }) {
        const { storagePathname, intentId, clientLEId, ownerOrgId, uploadedById } = params;

        if (intentId) {
            const intent = await prisma.privateDocumentUploadIntent.findUnique({ where: { id: intentId } });
            if (!intent) throw new Error("Upload intent not found");
            if (intent.status === 'FAILED') throw new Error("Intent is not in PENDING state");
            if (intent.storagePathname !== storagePathname) throw new Error("Pathname mismatch");
            if (intent.clientLEId !== clientLEId) throw new Error("Client context mismatch");
            if (intent.initiatedById !== uploadedById) throw new Error("Uploader mismatch");
        }

        const existingDoc = await prisma.document.findUnique({ where: { storagePathname } });
        if (existingDoc) {
            console.log(`[DocumentService] Callback delivered again for already persisted document: ${storagePathname}`);
            DocumentService.verifyExistingIntegrity(existingDoc, params);
            return existingDoc;
        }

        try {
            const result = await get(storagePathname, { token: getToken(), access: 'private' });
            if (!result || !result.stream) throw new Error("Failed to retrieve uploaded blob stream from Vercel.");

            let sizeBytes = BigInt(0);
            const hash = crypto.createHash("sha256");

            const reader = result.stream.getReader();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                if (value) {
                    sizeBytes += BigInt(value.length);
                    hash.update(value);
                }
            }
            
            const checksum = hash.digest("hex");
            const mimeType = result.blob.contentType || "application/octet-stream";

            return await DocumentService.createImmutableDocument({
                ...params,
                sizeBytes,
                mimeType,
                checksum,
            });

        } catch (error) {
            console.error("[DocumentService] Failed to persist private upload. Attempting compensating cleanup.", error);
            try {
                await del(storagePathname, { token: getToken() });
            } catch (cleanupError) {
                console.error("[DocumentService] CRITICAL: Compensating cleanup failed for orphaned blob:", storagePathname, cleanupError);
            }
            throw new Error(`Upload verification failed: ${(error as Error).message}`);
        }
    }

    /**
     * Uploads a document securely from a server-side process, bypassing the intent/webhook flow
     * but maintaining the same immutable persistence invariants.
     */
    static async uploadServerSideDocument(params: {
        file: File | Blob | Buffer;
        filename: string;
        mimeType: string;
        uploadedById: string;
        clientLEId?: string;
        ownerOrgId?: string;
        pathPrefix: string;
    }) {
        const { file, filename, mimeType, uploadedById, clientLEId, ownerOrgId, pathPrefix } = params;
        
        let buffer: Buffer;
        if (Buffer.isBuffer(file)) {
            buffer = file;
        } else if ('arrayBuffer' in file) {
            buffer = Buffer.from(await file.arrayBuffer());
        } else {
            throw new Error("Unsupported file type");
        }

        const sizeBytes = BigInt(buffer.length);
        const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
        
        const timestamp = Date.now();
        const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
        const pathname = `${pathPrefix}/${timestamp}-${safeName}`;

        const blob = await put(pathname, buffer, {
            access: 'private',
            token: getToken(),
            contentType: mimeType,
        });

        try {
            return await DocumentService.createImmutableDocument({
                storagePathname: blob.pathname,
                originalFilename: filename,
                clientLEId,
                ownerOrgId,
                uploadedById,
                sizeBytes,
                mimeType,
                checksum
            });
        } catch (error) {
            console.error("[DocumentService] Failed to persist server-side document. Cleaning up blob.");
            await del(blob.pathname, { token: getToken() });
            throw error;
        }
    }

    /**
     * Centralized method to securely read a document's buffer.
     */
    static async getBuffer(documentId: string, context?: { clientLEId?: string; ownerOrgId?: string }) {
        const doc = await prisma.document.findUnique({ where: { id: documentId } });
        if (!doc) throw new Error("Document not found");
        if (!doc.storagePathname) throw new Error("Document missing storagePathname");

        if (context) {
            if (context.clientLEId && doc.clientLEId !== context.clientLEId) {
                throw new Error("Unauthorized: clientLEId mismatch");
            }
            if (context.ownerOrgId && doc.ownerOrgId !== context.ownerOrgId) {
                throw new Error("Unauthorized: ownerOrgId mismatch");
            }
        }

        const res = await get(doc.storagePathname, { token: getToken(), access: 'private' });
        if (!res || !res.stream) throw new Error("Failed to fetch stream");

        const reader = res.stream.getReader();
        const chunks = [];
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
        }
        const buffer = Buffer.concat(chunks);
        
        return { buffer, mimeType: doc.mimeType || "application/octet-stream" };
    }

    static async markPrivateUploadFailed(intentId: string, failureReason: string) {
        await prisma.privateDocumentUploadIntent.update({
            where: { id: intentId },
            data: { status: 'FAILED', failureReason }
        });
    }
}
