/**
 * field-type-resolver.ts
 *
 * User-facing expected data type resolver for OnPro fields.
 * Derives concise, human-readable data type descriptions (e.g. "Text", "Date",
 * "Person", "Organisation collection", "Team collection", "Single choice", etc.)
 * from authoritative field schema metadata.
 */

export interface ExpectedDataTypeInput {
    dataType?: string;
    appDataType?: string;
    isRepeating?: boolean;
    isMultiValue?: boolean;
    options?: Array<any>;
    codeSystem?: string;
    profileConfig?: {
        allowedPartyTypes?: ('INDIVIDUAL' | 'TEAM' | 'ORGANISATION')[];
        allowedPartySubTypes?: string[];
        [key: string]: any;
    };
    fieldNo?: number;
}

/**
 * Returns a concise, human-readable expected data type label for a field definition.
 * 
 * Examples:
 * - Text / Text list
 * - Number / Number list
 * - Date / Date list
 * - Yes / No / Yes / No list
 * - Single choice / Multiple choice
 * - Address / Address collection
 * - Person / Person collection
 * - Organisation / Organisation collection
 * - Team / Team collection
 * - Person or organisation / Person or organisation collection
 * - Person, organisation or team / Person, organisation or team collection
 * - Structured group / Structured collection
 */
export function getExpectedDataTypeLabel(field: ExpectedDataTypeInput | null | undefined): string {
    if (!field) return 'Text';

    const isMulti = Boolean(field.isRepeating || field.isMultiValue);
    const rawType = (field.appDataType || field.dataType || 'TEXT').toUpperCase();
    const allowedPartyTypes = field.profileConfig?.allowedPartyTypes;

    // 1. Party fields (PARTY, PARTY_REF, PERSON_REF, ORG_REF, PERSON_OR_CONTACT, etc.)
    if (['PARTY', 'PARTY_REF', 'PERSON_REF', 'ORG_REF', 'PERSON_OR_CONTACT'].includes(rawType)) {
        if (rawType === 'PERSON_REF') {
            return isMulti ? 'Person collection' : 'Person';
        }
        if (rawType === 'ORG_REF') {
            return isMulti ? 'Organisation collection' : 'Organisation';
        }

        // Evaluate allowedPartyTypes array if present and non-empty
        if (allowedPartyTypes && allowedPartyTypes.length > 0) {
            const hasInd = allowedPartyTypes.includes('INDIVIDUAL');
            const hasOrg = allowedPartyTypes.includes('ORGANISATION');
            const hasTeam = allowedPartyTypes.includes('TEAM');

            // All 3 allowed
            if (hasInd && hasOrg && hasTeam) {
                return isMulti ? 'Person, organisation or team collection' : 'Person, organisation or team';
            }
            // 2-type combinations
            if (hasInd && hasOrg) {
                return isMulti ? 'Person or organisation collection' : 'Person or organisation';
            }
            if (hasInd && hasTeam) {
                return isMulti ? 'Person or team collection' : 'Person or team';
            }
            if (hasOrg && hasTeam) {
                return isMulti ? 'Organisation or team collection' : 'Organisation or team';
            }
            // 1-type combinations
            if (hasInd) {
                return isMulti ? 'Person collection' : 'Person';
            }
            if (hasOrg) {
                return isMulti ? 'Organisation collection' : 'Organisation';
            }
            if (hasTeam) {
                return isMulti ? 'Team collection' : 'Team';
            }
        }

        // Unrestricted fallback (when allowedPartyTypes is omitted/undefined or empty, all 3 party types are permitted)
        return isMulti ? 'Person, organisation or team collection' : 'Person, organisation or team';
    }

    // 2. Address fields
    if (['ADDRESS', 'ADDRESS_REF'].includes(rawType)) {
        return isMulti ? 'Address collection' : 'Address';
    }

    // 3. Document reference
    if (['DOCUMENT_REF', 'DOCUMENT'].includes(rawType)) {
        return isMulti ? 'Document collection' : 'Document';
    }

    // 4. Boolean (Yes / No)
    if (['BOOLEAN', 'BOOL'].includes(rawType)) {
        return isMulti ? 'Yes / No list' : 'Yes / No';
    }

    // 5. Date / DateTime
    if (['DATE', 'DATETIME'].includes(rawType)) {
        return isMulti ? 'Date list' : 'Date';
    }

    // 6. Number
    if (['NUMBER', 'INTEGER', 'FLOAT', 'INT'].includes(rawType)) {
        return isMulti ? 'Number list' : 'Number';
    }

    // 7. Structured / Composite / JSON
    if (['STRUCTURED_COLLECTION', 'COMPOSITE', 'JSONB', 'JSON'].includes(rawType)) {
        return isMulti ? 'Structured collection' : 'Structured group';
    }

    // 8. Controlled vocabulary / Choice selection
    if (field.codeSystem || (field.options && field.options.length > 0) || rawType === 'ENUM' || rawType === 'SELECT') {
        return isMulti ? 'Multiple choice' : 'Single choice';
    }

    // 9. Plain text fallback
    return isMulti ? 'Text list' : 'Text';
}
