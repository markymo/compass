/**
 * StakeholderSchema.ts
 * 
 * Zod schema for Stakeholder data validation.
 * Includes conditional validation based on stakeholderType.
 */

import { z } from 'zod';

export const StakeholderDataSchema = z.object({
    stakeholderType: z.enum(['INDIVIDUAL', 'CORPORATE']),
    role: z.enum(['DIRECTOR', 'UBO', 'CONTROLLER']),

    // Individual fields
    fullName: z.string().optional(),
    dateOfBirth: z.string().datetime().optional(),
    placeOfBirth: z.string().optional(),
    nationalities: z.array(z.string().length(2)).optional(), // ISO 3166-1 alpha-2
    idDocumentId: z.string().uuid().optional(),

    // Corporate fields
    legalName: z.string().optional(),
    leiCode: z.string().length(20).optional(),
    registrationAuthorityGleifId: z.string().optional(),
    registrationAuthority: z.string().optional(),
    registeredNumber: z.string().optional(),
}).refine(
    (data) => {
        // If INDIVIDUAL, should have individual fields
        if (data.stakeholderType === 'INDIVIDUAL') {
            return data.fullName !== undefined || data.dateOfBirth !== undefined;
        }
        // If CORPORATE, should have corporate fields
        if (data.stakeholderType === 'CORPORATE') {
            return data.legalName !== undefined || data.leiCode !== undefined;
        }
        return true;
    },
    {
        message: 'Stakeholder must have appropriate fields for its type',
    }
);

export type StakeholderData = z.infer<typeof StakeholderDataSchema>;
