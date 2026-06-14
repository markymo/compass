/**
 * person-or-contact-value.ts
 *
 * Canonical TypeScript interfaces for the PERSON_OR_CONTACT appDataType.
 *
 * ## Phase 1 — Embedded storage
 * The value is stored as structured JSON in FieldClaim.valueJson.
 * No Person or LegalEntity graph node is created by the enrichment pipeline.
 * Multiplicity comes from multiple FieldClaim rows (collectionId + instanceId),
 * NOT from arrays inside this value object.
 *
 * ## Future — Knowledge Graph promotion
 * PERSON_OR_CONTACT is designed to be promotable to a full KG node without schema
 * changes to this interface. Planned future workflows include:
 *   - Promote embedded record → Person graph node (PERSON_REF)
 *   - Link to an existing Person node by identity matching
 *   - Create director / signatory / UBO edges on the ClientLE graph
 *   - IDNow / verification workflow integration
 * None of these are implemented in Phase 1 and nothing here prevents them.
 */

// ── Core value object ──────────────────────────────────────────────────────────

export interface PersonOrContactValue {
    /**
     * Discriminant. Required.
     * PERSON   → a natural person
     * CONTACT  → a named internal group or general entity
     */
    contactType: 'PERSON' | 'CONTACT';

    // ── Identity ────────────────────────────────────────────────────────────────
    /** Honorific prefix (e.g. "Mr", "Dr", "Mrs"). From source or user input. */
    title:       string | null;
    /** First name and any middle names. */
    forenames:   string | null;
    /** Family name. */
    surname:     string | null;

    // ── Contact ─────────────────────────────────────────────────────────────────
    /** Single primary email address only. */
    email:  string | null;
    /** Phone numbers. May be empty. */
    phones: PersonOrContactPhone[];

    // ── Individual attributes ────────────────────────────────────────────────────
    /** ISO 3166-1 alpha-2 nationality codes or plain strings from source. */
    nationality: string[];
    countryOfResidence: string | null;

    /**
     * Partial date of birth.
     * Companies House provides month + year only (day is omitted for privacy).
     * day is null when the source does not provide it — never defaulted to 1.
     */
    dateOfBirth: {
        year:  number | null;
        month: number | null;   // 1–12
        day:   number | null;   // null when source omits
    } | null;

    placeOfBirth: string | null;

    // ── Roles ────────────────────────────────────────────────────────────────────
    /**
     * Roles held at companies. Always an array; may be empty for TEAM / DISTRIBUTION_LIST.
     * Each role has its own isActiveRole — independent of isActivePersonOrContact.
     */
    roles: PersonOrContactRole[];

    // ── Source identifiers ────────────────────────────────────────────────────────
    /** External system identifiers for this person/contact record. */
    sourceIdentifiers: PersonOrContactIdentifier[];

    // ── Status ────────────────────────────────────────────────────────────────────
    /**
     * Whether the person or contact is active in the system.
     * INDEPENDENT of role.isActiveRole.
     *
     * A resigned director (role.isActiveRole = false) may still be an active contact
     * (isActivePersonOrContact = true).
     *
     * Automated sources ALWAYS set this to null — they cannot know person-level status.
     * Only USER_INPUT can set true/false.
     */
    isActivePersonOrContact: boolean | null;

    // ── Visibility ────────────────────────────────────────────────────────────────
    /**
     * Controls which contexts may see this record.
     * Always CLIENT_LE for automated sources. Stored as business data for future use.
     * ORG / GLOBAL scopes are deferred to v2.
     */
    visibility: {
        scope: 'CLIENT_LE';
    };
}

// ── Sub-types ──────────────────────────────────────────────────────────────────

export interface PersonOrContactPhone {
    type:   'LANDLINE' | 'MOBILE' | 'OTHER';
    number: string;
}

export interface PersonOrContactRole {
    /** Free-text role title from source (e.g. "director", "secretary", "llp-member"). */
    roleTitle: string | null;

    /** Canonical role type from source (e.g. "director", "psc"). */
    roleType: string | null;

    /**
     * The company at which this role is held.
     * Supports Coparity GUID, CH number, LEI, or any registry identifier.
     */
    company: {
        coparityCompanyId: string | null;   // internal ClientLE id
        externalId:        string | null;   // e.g. CH company number, LEI
        externalIdScheme:  string | null;   // e.g. "COMPANIES_HOUSE", "GLEIF"
        name:              string | null;
    };

    /**
     * Whether THIS ROLE is currently active.
     * INDEPENDENT of PersonOrContactValue.isActivePersonOrContact.
     * false → resigned / ceased.
     */
    isActiveRole: boolean | null;
    /** ISO date of appointment / notification. */
    appointedOn: string | null;
    /** ISO date of resignation / cessation. null = still active. */
    resignedOn:  string | null;

    /** PSC natures_of_control from Companies House. Empty for non-PSC roles. */
    natureOfControl: string[];
}

export interface PersonOrContactIdentifier {
    /** Scheme name (e.g. "COMPANIES_HOUSE_PERSON_NUMBER", "GLEIF_PERSON_ID"). */
    scheme: string;
    /** Identifier value within the scheme. */
    value:  string;
}

// ── Type guard ─────────────────────────────────────────────────────────────────

/**
 * Returns true if `value` looks like a PersonOrContactValue.
 * Uses structural detection on the contactType discriminant.
 */
export function isPersonOrContactValue(value: any): value is PersonOrContactValue {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    
    // Check strict signature first
    const VALID_TYPES = new Set(['PERSON', 'CONTACT']);
    if ('contactType' in value && VALID_TYPES.has(value.contactType)) return true;

    // Fallback for legacy JSON rows that were mapped before contactType was added
    // If it has name fields or roles, treat it as a PersonOrContact
    if ('forenames' in value || 'surname' in value || 'roles' in value || 'firstName' in value || 'lastName' in value) {
        // Automatically inject the missing discriminant so the editor works
        if (!('contactType' in value)) value.contactType = 'PERSON';
        return true;
    }

    return false;
}

// ── Display helpers ────────────────────────────────────────────────────────────

/**
 * Returns a human-readable one-line summary for compact display.
 * Falls back gracefully through forenames+surname → contactType.
 */
export function getPersonOrContactSummary(v: PersonOrContactValue): string {
    const name = [v.forenames || (v as any).firstName, v.surname || (v as any).lastName].filter(Boolean).join(' ') || 
        v.contactType || 'Unknown Person';

    const rolesList = v.roles || [];
    const activeRole = rolesList.find(r => r.isActiveRole !== false);
    const roleLabel  = activeRole?.roleTitle ?? (rolesList.length > 0 ? rolesList[0].roleTitle : null);

    return roleLabel ? `${name} (${roleLabel})` : name;
}
