/**
 * AuthorizedTraderSchema.ts
 * 
 * Zod schema for AuthorizedTrader data validation.
 */

import { z } from 'zod';

export const AuthorizedTraderDataSchema = z.object({
    fullName: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
    mobile: z.string().optional(),
    products: z.array(z.string()).optional(),
    authorityDocumentId: z.string().uuid().optional(), // Field 100: document OR attestation
    authorityAttestationText: z.string().optional(),
}).refine(
    (data) => {
        // Field 100: Must have EITHER document OR attestation
        return data.authorityDocumentId !== undefined || data.authorityAttestationText !== undefined;
    },
    {
        message: 'Must provide either authorityDocumentId or authorityAttestationText (Field 100)',
    }
);

export type AuthorizedTraderData = z.infer<typeof AuthorizedTraderDataSchema>;
