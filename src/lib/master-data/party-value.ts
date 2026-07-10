/**
 * party-value.ts
 *
 * Canonical TypeScript interfaces for the PARTY appDataType.
 *
 * ## Phase 1A — Embedded storage
 * The value is stored as structured JSON in FieldClaim.valueJson.
 * No Party table is created in this phase.
 * Multiplicity comes from multiple FieldClaim rows (collectionId + instanceId).
 *
 * ## Future — Knowledge Graph promotion
 * PARTY is designed to be promotable to a full curated Party table without schema
 * changes to this interface.
 */

// ── Core value object ──────────────────────────────────────────────────────────

export interface PartyRefValue {
    ccPartyId: string;
}

export function isPartyRefValue(value: any): value is PartyRefValue {
    return value && typeof value === 'object' && typeof value.ccPartyId === 'string';
}



export interface PartyValue {
    /**
     * Discriminant. Required.
     * PERSON   → a natural person
     * CONTACT  → a named internal group or general entity
     */
    contactType: 'PERSON' | 'CONTACT';

    partyType?: 'INDIVIDUAL' | 'ORGANISATION' | 'UNKNOWN' | null;
    partySubType?: 'PERSON' | 'CONTACT' | 'COMPANY' | 'TRUST' | 'FUND' | 'PARTNERSHIP' | 'GOVERNMENT_BODY' | 'TEAM' | 'DISTRIBUTION_LIST' | 'OTHER' | null;
    organisationName?: string | null;
    displayName?: string | null;

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
    phones: PartyPhone[];

    // ── Individual attributes ────────────────────────────────────────────────────
    /** ISO 3166-1 alpha-2 nationality codes or plain strings from source. */
    nationality: string[];
    countryOfResidence: string | null;

    /**
     * Officer correspondence/service address from registry payload.
     * Not automatically resolved to a CCAddress graph node.
     */
    correspondenceAddress?: import('./address-value').AddressValue | null;

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
     * Each role has its own isActiveRole — independent of isActiveParty.
     */
    roles: PartyRole[];

    // ── Source identifiers ────────────────────────────────────────────────────────
    /** External system identifiers for this party record. */
    sourceIdentifiers: PartyIdentifier[];

    // ── Status ────────────────────────────────────────────────────────────────────
    /**
     * Whether the party is active in the system.
     * INDEPENDENT of role.isActiveRole.
     *
     * A resigned director (role.isActiveRole = false) may still be an active contact
     * (isActiveParty = true).
     *
     * Automated sources ALWAYS set this to null — they cannot know person-level status.
     * Only USER_INPUT can set true/false.
     */
    isActiveParty: boolean | null;
    /** Legacy compatibility field, mapped to isActiveParty at runtime. */
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

export interface PartyPhone {
    type:   'LANDLINE' | 'MOBILE' | 'OTHER';
    number: string;
}

export interface PartyRole {
    /** Free-text role title from source (e.g. "director", "secretary", "llp-member"). */
    roleTitle: string | null;

    /** Canonical role type from source (e.g. "director", "psc"). */
    roleType: string | null;

    /**
     * The company at which this role is held.
     * Supports Coparity GUID, CH number, LEI, or any registry identifier.
     */
    company: {
        onProCompanyId: string | null;   // internal ClientLE id
        externalId:        string | null;   // e.g. CH company number, LEI
        externalIdScheme:  string | null;   // e.g. "COMPANIES_HOUSE", "GLEIF"
        name:              string | null;
    };

    /**
     * Whether THIS ROLE is currently active.
     * INDEPENDENT of PartyValue.isActiveParty.
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

export interface PartyIdentifier {
    /** Scheme name (e.g. "COMPANIES_HOUSE_PERSON_NUMBER", "GLEIF_PERSON_ID"). */
    scheme: string;
    /** Identifier value within the scheme. */
    value:  string;
}

// ── Type guard ─────────────────────────────────────────────────────────────────

/**
 * Returns true if `value` looks like a PartyValue.
 * Uses structural detection on the contactType discriminant.
 */
export function isPartyValue(value: any): value is PartyValue {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    
    // Check strict signature first
    const VALID_TYPES = new Set(['PERSON', 'CONTACT']);
    let matches = false;
    if ('contactType' in value && VALID_TYPES.has(value.contactType)) {
        matches = true;
    } else if ('forenames' in value || 'surname' in value || 'roles' in value || 'firstName' in value || 'lastName' in value || 'organisationName' in value || 'displayName' in value || 'partyType' in value) {
        // Automatically inject the missing discriminant so the editor works
        if (!('contactType' in value)) value.contactType = 'PERSON';
        matches = true;
    }

    if (matches) {
        // Normalize status properties in-place
        const active = value.isActiveParty !== undefined && value.isActiveParty !== null
            ? value.isActiveParty 
            : (value.isActivePersonOrContact !== undefined && value.isActivePersonOrContact !== null ? value.isActivePersonOrContact : null);
        value.isActiveParty = active;
        value.isActivePersonOrContact = active;

        // Backward compatibility mappings
        if (!value.partyType) {
            if (value.contactType === 'PERSON') {
                value.partyType = 'INDIVIDUAL';
                value.partySubType = 'PERSON';
            } else if (value.contactType === 'CONTACT') {
                value.partyType = 'INDIVIDUAL';
                value.partySubType = 'CONTACT';
            }
        }
        return true;
    }

    return false;
}

// ── Display helpers ────────────────────────────────────────────────────────────

export function isFieldPermittedByMask(fieldPath: string, displayMask?: string[]): boolean {
    if (!Array.isArray(displayMask) || displayMask.length === 0) return true;

    const normalise = (p: string) => p.replace(/\[(\w+)\]/g, '.$1');
    const normFieldPath = normalise(fieldPath);

    return displayMask.some(mask => {
        const normMask = normalise(mask);
        if (normMask === normFieldPath) return true;
        if (normFieldPath.startsWith(normMask + '.')) return true;
        if (normMask.startsWith(normFieldPath + '.')) return true;
        // Also support generic array masks e.g. mask 'roles.roleTitle' matches 'roles.0.roleTitle'
        // But do NOT treat 'roles.0.roleTitle' as a wildcard mask.
        const isGenericMask = !/\.\d+\./.test(normMask) && !/\.\d+$/.test(normMask);
        if (isGenericMask) {
            const arrayWildcardPath = normFieldPath.replace(/\.\d+\./g, '.').replace(/\.\d+$/, '');
            if (normMask === arrayWildcardPath) return true;
            if (arrayWildcardPath.startsWith(normMask + '.')) return true;
            if (normMask.startsWith(arrayWildcardPath + '.')) return true;
        }
        return false;
    });
}

/**
 * Returns a human-readable one-line summary for compact display.
 * Falls back gracefully through forenames+surname → contactType.
 * Honors displayMask to ensure sensitive data is not leaked into summaries.
 */
export function getPartySummary(v: PartyValue, displayMask?: string[]): string {
    const isMasked = (path: string) => !isFieldPermittedByMask(path, displayMask);

    const isOrg = v.partyType === 'ORGANISATION';
    const isUnknown = v.partyType === 'UNKNOWN';

    let name = '';
    const permittedOrgName = !isMasked('organisationName') ? (v.organisationName || (v as any).companyName || (v as any).name) : null;
    const permittedDisplayName = !isMasked('displayName') ? v.displayName : null;
    const permittedForenames = !isMasked('forenames') ? (v.forenames || (v as any).firstName) : null;
    const permittedSurname = !isMasked('surname') ? (v.surname || (v as any).lastName) : null;
    const permittedTitle = !isMasked('title') ? v.title : null;

    const personName = [permittedTitle, permittedForenames, permittedSurname].filter(Boolean).join(' ');

    if (isOrg) {
        name = permittedDisplayName || permittedOrgName || personName || '';
    } else if (isUnknown) {
        name = permittedDisplayName || permittedOrgName || personName || '';
    } else {
        name = personName || permittedDisplayName || permittedOrgName || '';
    }

    let roleLabel: string | null = null;
    if (!isMasked('roles')) {
        const rolesList = v.roles || [];
        const activeRole = rolesList.find(r => r.isActiveRole !== false);
        const role = activeRole ?? (rolesList.length > 0 ? rolesList[0] : null);
        
        if (role) {
            const roleIndex = rolesList.indexOf(role);
            if (!isMasked(`roles[${roleIndex}].roleTitle`)) {
                roleLabel = role.roleTitle;
            }
        }
    }

    const summary = roleLabel ? `${name} (${roleLabel})` : name;
    return summary.trim() !== '' ? summary.trim() : '';
}

/**
 * Returns true if the PartyValue has a usable identity (name or external identifier).
 */
export function isValidPartyValue(value: any): boolean {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

    // Normalise/resolve actual partyType for validation check
    const actualPartyType = value.partyType ?? (value.contactType === 'PERSON' ? 'INDIVIDUAL' : (value.contactType === 'CONTACT' ? 'INDIVIDUAL' : null));

    const hasForenames = typeof value.forenames === 'string' && value.forenames.trim().length > 0;
    const hasSurname = typeof value.surname === 'string' && value.surname.trim().length > 0;
    const hasFullName = typeof (value as any).fullName === 'string' && (value as any).fullName.trim().length > 0;
    const hasName = typeof (value as any).name === 'string' && (value as any).name.trim().length > 0;
    const hasTitle = typeof value.title === 'string' && value.title.trim().length > 0;
    const hasIndividualName = hasForenames || hasSurname || hasFullName || hasName || hasTitle;

    const hasOrgName = typeof value.organisationName === 'string' && value.organisationName.trim().length > 0;
    const hasDisplayName = typeof value.displayName === 'string' && value.displayName.trim().length > 0;
    const hasOrganisationName = hasOrgName || hasDisplayName;

    const hasIdentifier = Array.isArray(value.sourceIdentifiers) && value.sourceIdentifiers.length > 0;

    if (hasIdentifier) return true;

    if (actualPartyType === 'ORGANISATION') {
        return hasOrganisationName;
    } else if (actualPartyType === 'INDIVIDUAL') {
        return hasIndividualName;
    } else if (actualPartyType === 'UNKNOWN') {
        return hasIndividualName || hasOrganisationName;
    } else {
        // Fallback for legacy/unspecified
        return !!(hasIndividualName || hasOrganisationName);
    }
}

/**
 * Returns true if the value represents an active director.
 * Apply this predicate to filter out resigned, inactive, secretary or anonymous/invalid directors.
 */
export function isRenderableActiveDirectorParty(value: any): boolean {
    // If this is a PARTY_REF (lazy canonicalisation pointer), we trust the explicit link.
    if (value && typeof value === 'object' && typeof value.ccPartyId === 'string' && value.ccPartyId.trim() !== '') {
        return true;
    }

    if (!isValidPartyValue(value)) return false;

    const roles = Array.isArray(value.roles) ? value.roles : [];
    const hasActiveDirector = roles.some((r: any) => {
        const isDirector = String(r.roleType || r.roleTitle || '').toLowerCase().includes('director');
        const isActive = r.isActiveRole !== false;
        const noResignedDate = !r.resignedOn && !r.ceasedOn;
        return isDirector && isActive && noResignedDate;
    });

    return hasActiveDirector;
}

