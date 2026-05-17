/**
 * semantic-hints.ts
 *
 * Static dictionary of human-readable meanings for raw source field paths.
 * This is a UI-layer helper only — no DB, no schema change.
 *
 * Structure: { [sourceType]: { [sourcePath]: displayHint } }
 *
 * Priority resolution in the UI:
 *   1. SourceFieldMapping.notes (if non-empty) — admin-curated on the mapping row
 *   2. This dictionary (sourced from API docs + domain knowledge)
 *   3. Heuristic prettifier (path → "Entity Legal Address City")
 */

export const GLEIF_PATH_HINTS: Record<string, string> = {
    // Top-level
    "lei": "Legal Entity Identifier (LEI)",

    // Entity — Identity
    "entity.legalName.name": "Official registered legal name",
    "entity.legalName.language": "Language code of the legal name",
    "entity.otherNames": "Other known or trade names",
    "entity.otherNames[0].name": "First alternate / trade name",
    "entity.otherNames[0].type": "Type of alternate name (e.g. TRADING_OR_OPERATING_NAME)",
    "entity.previousNames": "Array of historical previous legal names",
    "entity.previousNames[0].name": "Most recent previous legal name",
    "entity.previousNames[0].effectiveTo": "Date the previous name ceased to be used",

    // Entity — Registration
    "entity.registeredAs": "Registration number at the native company registry (e.g. company number)",
    "entity.registeredAt.id": "GLEIF Registration Authority Code (e.g. RA000585 = UK Companies House)",
    "entity.jurisdiction": "ISO 2-letter country jurisdiction code (e.g. GB, FR, DE)",
    "entity.category": "GLEIF entity category (GENERAL, BRANCH, FUND, SOLE_PROPRIETOR)",
    "entity.status": "GLEIF entity operational status (ACTIVE, INACTIVE, NULL)",
    "entity.creationDate": "Date the legal entity was incorporated or registered",
    "entity.expirationDate": "Date the entity ceased to exist (if applicable)",
    "entity.expirationReason": "Reason for entity expiration (DISSOLVED, MERGED, etc.)",
    "entity.successorEntity.lei": "LEI of the successor entity after merger/acquisition",

    // Entity — Legal Address
    "entity.legalAddress.addressLines": "Registered legal address lines (array)",
    "entity.legalAddress.addressLines[0]": "First line of the registered legal address",
    "entity.legalAddress.addressLines[1]": "Second line of the registered legal address",
    "entity.legalAddress.city": "City of the registered legal address",
    "entity.legalAddress.region": "Region/county of the registered legal address (ISO format)",
    "entity.legalAddress.country": "ISO 2-letter country of the registered legal address",
    "entity.legalAddress.postalCode": "Postal/ZIP code of the registered legal address",
    "entity.legalAddress.addressNumber": "Address number (if separately stored)",
    "entity.legalAddress.addressNumberWithinBuilding": "Suite or unit number",

    // Entity — HQ Address
    "entity.headquartersAddress.addressLines": "Headquarters address lines (array)",
    "entity.headquartersAddress.addressLines[0]": "First line of the headquarters address",
    "entity.headquartersAddress.city": "City of the headquarters address",
    "entity.headquartersAddress.region": "Region of the headquarters address",
    "entity.headquartersAddress.country": "ISO 2-letter country of the headquarters address",
    "entity.headquartersAddress.postalCode": "Postal/ZIP code of the headquarters address",

    // Entity — Legal Form
    "entity.legalForm.id": "ISO legal form code (e.g. H0PO = UK Private Limited Company)",
    "entity.legalForm.other": "Free-text description when legal form is not in the ISO standard",

    // Registration — LEI Record Lifecycle
    "registration.initialRegistrationDate": "Date the LEI was first registered with GLEIF",
    "registration.lastUpdateDate": "Date the LEI record was last updated",
    "registration.status": "LEI record status (ISSUED, LAPSED, PENDING_TRANSFER, etc.)",
    "registration.nextRenewalDate": "Date by which the LEI must be renewed to remain ISSUED",
    "registration.managingLOU": "LEI of the Local Operating Unit (LOU) managing this record",
    "registration.corroborationLevel": "Level of validation applied by the LOU",
    "registration.validatedAt.id": "Registration Authority that validated the entity data",
    "registration.validatedAs": "Identifier used to validate the entity at the RA",

    // Extension — BIS
    "extension.bis.corroborationLevel": "BIS corroboration level for entity data",
};

export const CH_PATH_HINTS: Record<string, string> = {
    // Baseline extract paths (canonical super-schema format used in CoParity)
    "entityName": "Registered company name at Companies House",
    "entityStatus": "Company status (active, dissolved, in-administration, etc.)",
    "incorporationDate": "Date of incorporation at Companies House",
    "legalForm": "Legal form description (e.g. Private Limited Company)",
    "registeredAddress.lines[0]": "First line of the registered office address",
    "registeredAddress.lines[1]": "Second line of the registered office address",
    "registeredAddress.city": "City of the registered office address",
    "registeredAddress.postalCode": "Postal code of the registered office address",
    "registeredAddress.country": "Country of the registered office address",
    "identifiers[0].value": "Primary identifier value (company registration number)",
    "identifiers[0].type": "Type of identifier (COMPANY_NUMBER)",
    "sicCodes[0].code": "Primary SIC activity code",
    "sicCodes[0].description": "Description of the primary SIC activity",

    // Raw CH API paths (company profile)
    "company_name": "Registered company name",
    "company_number": "Companies House registration number",
    "company_status": "Company status (active, dissolved, etc.)",
    "date_of_creation": "Date of incorporation",
    "type": "Company type (ltd, plc, llp, etc.)",
    "registered_office_address.address_line_1": "First line of registered office address",
    "registered_office_address.address_line_2": "Second line of registered office address",
    "registered_office_address.locality": "Town/city of registered office address",
    "registered_office_address.postal_code": "Postal code of registered office address",
    "registered_office_address.country": "Country of registered office address",
    "sic_codes[0]": "Primary SIC activity code",
};

export const RA_PATH_HINTS: Record<string, string> = {
    ...CH_PATH_HINTS,
    // Generic REGISTRATION_AUTHORITY canonical paths
    "entityName": "Registered legal entity name",
    "entityStatus": "Entity status at the registry",
    "incorporationDate": "Date of incorporation",
    "registeredAddress.lines[0]": "First line of registered address",
    "registeredAddress.city": "City of registered address",
    "registeredAddress.postalCode": "Postal code of registered address",
    "registeredAddress.country": "Country of registered address",
};

/**
 * Returns a human-readable hint for a source path, or null if not found.
 * Falls back to a heuristic prettifier.
 */
export function getPathHint(sourceType: string, sourcePath: string): string | null {
    const map =
        sourceType === "GLEIF" ? GLEIF_PATH_HINTS :
        sourceType === "REGISTRATION_AUTHORITY" || sourceType === "COMPANIES_HOUSE" ? RA_PATH_HINTS :
        null;

    if (!map) return heuristicPrettify(sourcePath);
    return map[sourcePath] ?? heuristicPrettify(sourcePath);
}

/**
 * Last-resort heuristic: turns a dot-path into a readable phrase.
 * e.g. "entity.legalAddress.city" → "Entity Legal Address City"
 * e.g. "registration.nextRenewalDate" → "Registration Next Renewal Date"
 */
export function heuristicPrettify(path: string): string {
    return path
        .replace(/\[.*?\]/g, "") // strip array indices
        .split(".")
        .map(part =>
            part
                .replace(/([A-Z])/g, " $1") // camelCase → spaces
                .replace(/^./, c => c.toUpperCase())
                .trim()
        )
        .join(" › ");
}
