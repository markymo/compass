import prisma from '@/lib/prisma';
import { DocumentRegistrySchema, type DocumentRegistryInput } from '@/domain/kyc/schemas/DocumentRegistrySchema';
import { randomUUID } from 'crypto';

/**
 * Service for managing document lifecycle and registry.
 * Handles S3 uploads (mocked) and DocumentRegistry updates.
 */
export class DocumentService {

    /**
     * Upload a document and register it in the system.
     * 
     * 1. Validates input using Zod schema
     * 2. Uploads to object store (mocked)
     * 3. Creates DocumentRegistry entry
     * 
     * @returns The generated UUID of the document registry entry
     */
    async uploadDocument(input: DocumentRegistryInput): Promise<string> {
        // 1. Validate input
        const validated = DocumentRegistrySchema.parse(input);

        // 2. Upload to S3 (Mock)
        const s3Key = await this.mockS3Upload(validated.fileName, validated.mimeType);

        // 3. Create Registry Entry
        const doc = await prisma.documentRegistry.create({
            data: {
                id: randomUUID(),
                legalEntityId: validated.legalEntityId,
                ownerType: validated.ownerType,
                ownerId: validated.ownerId,
                fieldNo: validated.fieldNo,
                filePath: s3Key, // Store the S3 key/path
                fileName: validated.fileName,
                mimeType: validated.mimeType,
                uploadedBy: validated.uploadedBy,
            },
        });

        return doc.id;
    }

    /**
     * Mock S3 upload - returns a simulated path/key
     */
    private async mockS3Upload(fileName: string, mimeType: string): Promise<string> {
        // In real impl, this would stream to S3 and return the key
        // For now, return a deterministic-ish path
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        return `uploads/${timestamp}/${randomUUID()}-${fileName}`;
    }

    /**
     * List documents for a legal entity
     */
    async listDocuments(legalEntityId: string) {
        return prisma.documentRegistry.findMany({
            where: { legalEntityId },
            orderBy: { uploadedAt: 'desc' },
        });
    }

    /**
     * Get specific document metadata
     */
    async getDocument(id: string) {
        return prisma.documentRegistry.findUnique({
            where: { id },
        });
    }

    /**
     * Get documents for a specific owner (e.g., all docs for a specific Stakeholder)
     */
    async getDocumentsByOwner(ownerId: string, ownerType: 'LEGAL_ENTITY' | 'STAKEHOLDER' | 'AUTHORIZED_TRADER') {
        return prisma.documentRegistry.findMany({
            where: {
                ownerId,
                ownerType
            },
            orderBy: { uploadedAt: 'desc' },
        });
    }
}
