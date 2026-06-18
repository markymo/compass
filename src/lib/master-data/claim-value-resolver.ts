import { isPartyValue } from "./party-value";

export type ClaimValueKind = 
    | "EMBEDDED_PARTY"
    | "PARTY_REF"
    | "ADDRESS"
    | "ADDRESS_REF"
    | "PERSON_REF"
    | "ORG_REF"
    | "DOCUMENT_REF"
    | "TEXT"
    | "NUMBER"
    | "DATE"
    | "UNKNOWN_JSON";

/**
 * Infers the value kind of a FieldClaim payload by analyzing its shape.
 * This ensures that a claim is rendered correctly even if it differs from
 * the field's primary appDataType.
 */
export function inferClaimValueKind(claim: {
    valueJson?: any;
    valueText?: string | null;
    valueNumber?: number | null;
    valueDate?: Date | null;
    valueLeId?: string | null;
    valuePersonId?: string | null;
    valueAddressId?: string | null;
    valueDocId?: string | null;
}): ClaimValueKind {
    // 1. PARTY_REF: Must be a non-empty string in `ccPartyId`.
    if (
        claim.valueJson &&
        typeof claim.valueJson === "object" &&
        typeof claim.valueJson.ccPartyId === "string" &&
        claim.valueJson.ccPartyId.trim() !== ""
    ) {
        return "PARTY_REF";
    }

    // 1.5. ADDRESS_REF: Must be a non-empty string in `ccAddressId`.
    if (
        claim.valueJson &&
        typeof claim.valueJson === "object" &&
        typeof claim.valueJson.ccAddressId === "string" &&
        claim.valueJson.ccAddressId.trim() !== ""
    ) {
        return "ADDRESS_REF";
    }

    // 2. EMBEDDED_PARTY: Contains party-specific fields (e.g. contactType, partyType, forenames, etc).
    // isPartyValue performs structural validation for these properties.
    if (claim.valueJson && typeof claim.valueJson === "object" && isPartyValue(claim.valueJson)) {
        return "EMBEDDED_PARTY";
    }

    // 3. ADDRESS: Contains address structure (e.g. addressLines)
    if (claim.valueJson && typeof claim.valueJson === "object" && "addressLines" in claim.valueJson) {
        return "ADDRESS";
    }

    // 4. OTHER JSON
    if (claim.valueJson && typeof claim.valueJson === "object") {
        return "UNKNOWN_JSON";
    }

    // 5. REFERENCES
    if (claim.valuePersonId) return "PERSON_REF";
    if (claim.valueLeId) return "ORG_REF";
    if (claim.valueAddressId) return "ADDRESS_REF";
    if (claim.valueDocId) return "DOCUMENT_REF";

    // 6. SCALARS
    if (claim.valueDate !== null && claim.valueDate !== undefined) return "DATE";
    if (claim.valueNumber !== null && claim.valueNumber !== undefined) return "NUMBER";
    if (claim.valueText !== null && claim.valueText !== undefined) return "TEXT";

    // Fallback if absolutely nothing is found
    return "TEXT";
}
