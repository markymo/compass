/**
 * DocumentRegistrySchema.ts
 * 
 * Zod schema for validating document registry entries.
 */

import { z } from 'zod';

export const DocumentRegistrySchema = z.object({
    legalEntityId: z.string().uuid(),
    ownerType: z.enum(['LEGAL_ENTITY', 'STAKEHOLDER', 'AUTHORIZED_TRADER']),
    ownerId: z.string().uuid(),
    fieldNo: z.number().int().positive(),
    filePath: z.string().min(1),
    fileName: z.string().min(1),
    mimeType: z.string().min(1),
    uploadedBy: z.string().uuid(),
});

export type DocumentRegistryInput = z.infer<typeof DocumentRegistrySchema>;
