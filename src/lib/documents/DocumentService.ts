import prisma from "@/lib/prisma";
import { get, del } from "@vercel/blob";
import * as crypto from "crypto";
import { Prisma } from "@prisma/client";

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
        const { clientLEId, uploadedById, storagePathname } = params;
        if (
            existingDoc.clientLEId !== clientLEId ||
            existingDoc.uploadedById !== uploadedById ||
            existingDoc.storageProvider !== "VERCEL_BLOB" ||
            existingDoc.storagePathname !== storagePathname
        ) {
            console.error(`[DocumentService] CRITICAL INTEGRITY CONFLICT: Existing document ${existingDoc.id} for path ${storagePathname} does not match trusted context.`, { expected: params, found: existingDoc });
            throw new Error("Critical integrity conflict detected for existing blob identity.");
        }
    }

    /**
     * Verifies a completed client upload, calculates exact size and checksum from the stream,
     * and persists the immutable Document record.
     * 
     * Idempotent: Can safely handle duplicate callbacks and concurrent races.
     */
    static async verifyAndPersistPrivateUpload(params: {
        storagePathname: string;
        originalFilename: string;
        clientLEId: string;
        uploadedById: string;
        intentId?: string;
    }) {
        const { storagePathname, originalFilename, clientLEId, uploadedById, intentId } = params;

        if (intentId) {
            const intent = await prisma.privateDocumentUploadIntent.findUnique({ where: { id: intentId } });
            if (!intent) {
                throw new Error("Upload intent not found");
            }
            if (intent.status === 'FAILED') {
                throw new Error("Intent is not in PENDING state (rejected/terminal)");
            }
            if (intent.storagePathname !== storagePathname) {
                throw new Error("Pathname mismatch");
            }
            if (intent.clientLEId !== clientLEId) {
                throw new Error("Client context mismatch");
            }
            if (intent.initiatedById !== uploadedById) {
                throw new Error("Uploader mismatch");
            }
        }

        // 1. Idempotency Check: Already processed?
        const existingDoc = await prisma.document.findUnique({
            where: { storagePathname }
        });
        
        if (existingDoc) {
            console.log(`[DocumentService] Callback delivered again for already persisted document: ${storagePathname}`);
            DocumentService.verifyExistingIntegrity(existingDoc, params);
            return existingDoc;
        }

        try {
            // 2. Retrieve the private blob stream using the specific private token
            const result = await get(storagePathname, { token: getToken(), access: 'private' });
            if (!result || !result.stream) {
                throw new Error("Failed to retrieve uploaded blob stream from Vercel.");
            }

            // 3. Compute exact size and SHA-256 checksum from the chunked stream
            let sizeBytes = BigInt(0);
            const hash = crypto.createHash("sha256");

            // Process stream incrementally without accumulating into a single memory buffer
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

            // 4. Create the immutable Document inside a Prisma transaction
            const document = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
                return await tx.document.create({
                    data: {
                        name: originalFilename,
                        clientLEId,
                        uploadedById,
                        docType: "EVIDENCE",
                        isVerified: false,
                        isDeleted: false,
                        
                        // Phase 3 Immutable Storage Identity
                        storageProvider: "VERCEL_BLOB",
                        storagePathname,
                        sizeBytes,
                        mimeType,
                        checksum,
                        
                        // Legacy fields
                        fileUrl: "",
                        fileType: mimeType,
                    }
                });
            });

            return document;

        } catch (error) {
            // 5. Race Condition Conflict handling
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                console.log(`[DocumentService] Race condition: Another handler successfully persisted ${storagePathname}.`);
                const winner = await prisma.document.findUnique({ where: { storagePathname } });
                if (winner) {
                    DocumentService.verifyExistingIntegrity(winner, params);
                    return winner;
                }
            }

            console.error("[DocumentService] Failed to persist private upload. Attempting compensating cleanup.", error);
            
            // 6. Compensating deletion of the orphaned blob ONLY if we didn't just lose a race
            try {
                await del(storagePathname, { token: getToken() });
            } catch (cleanupError) {
                console.error("[DocumentService] CRITICAL: Compensating cleanup failed for orphaned blob:", storagePathname, cleanupError);
            }

            throw new Error(`Upload verification failed: ${(error as Error).message}`);
        }
    }

    /**
     * Marks an upload intent as failed.
     */
    static async markPrivateUploadFailed(intentId: string, failureReason: string) {
        await prisma.privateDocumentUploadIntent.update({
            where: { id: intentId },
            data: { status: 'FAILED', failureReason }
        });
    }
}
