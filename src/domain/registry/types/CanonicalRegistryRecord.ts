import { SourceType } from "@prisma/client";

/**
 * Standard internal representation of a national registry record.
 * All registry connectors must normalize their raw output into this format.
 */
export interface CanonicalRegistryRecord {
    sourceType: SourceType;
    registryKey: string;
    registryAuthorityId: string;
    jurisdiction?: string;
    sourceRecordId: string; // The primary ID in that registry (e.g. Company Number)
    fetchedAt: Date;

    // Core entity facts
    entityName: string;
    entityStatus?: string;
    incorporationDate?: Date | string;
    dissolutionDate?: Date | string;
    legalForm?: string;

    // Address
    registeredAddress?: {
        lines: string[];
        city?: string;
        region?: string;
        postalCode?: string;
        country: string;
    };

    // Identifiers (e.g. VAT, Tax ID, local reg number)
    identifiers: Array<{
        type: string;
        value: string;
    }>;

    // Sub-objects (extensible)
    officers?: any[];
    pscs?: any[];
    sicCodes?: Array<{ code: string; description?: string }>;
    filings?: any[];

    // Metadata
    rawSourcePayload?: any;
}
