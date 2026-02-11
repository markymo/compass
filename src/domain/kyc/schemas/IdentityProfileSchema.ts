/**
 * IdentityProfileSchema.ts
 * 
 * Zod schema for IdentityProfile data validation.
 * Draft-safe: validates shape/types only, not completeness.
 */

import { z } from 'zod';

export const IdentityProfileDataSchema = z.object({
    leiValidationDate: z.string().datetime().optional(),
    leiCode: z.string().length(20).optional(),
    legalName: z.string().optional(),
    regAddressLine1: z.string().optional(),
    regAddressCity: z.string().optional(),
    regAddressRegion: z.string().optional(),
    regAddressCountry: z.string().length(2).optional(), // ISO 3166-1 alpha-2
    regAddressPostcode: z.string().optional(),
    hqAddressLine1: z.string().optional(),
    hqAddressCity: z.string().optional(),
    hqAddressRegion: z.string().optional(),
    hqAddressCountry: z.string().length(2).optional(),
    hqAddressPostcode: z.string().optional(),
    entityStatus: z.string().optional(),
    entityCreationDate: z.string().datetime().optional(),
});

export type IdentityProfileData = z.infer<typeof IdentityProfileDataSchema>;
