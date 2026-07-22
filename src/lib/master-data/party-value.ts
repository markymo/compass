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
import { getAddressSummary } from './address-value';
import type { CCPartyData } from './party-v2/CCPartyData';

export interface PartyRefValue {
    ccPartyId: string;
}

export function isPartyRefValue(value: any): value is PartyRefValue {
    return value && typeof value === 'object' && typeof value.ccPartyId === 'string';
}

/**
 * Extracts canonical ccPartyId references from scalar, repeated, and structured/grouped field values.
 * Uses explicit structural checks rather than arbitrary deep JSON scanning.
 */
export function extractCanonicalPartyIds(value: any): string[] {
    const ids = new Set<string>();
    
    if (!value) return [];
    
    // 1. Scalar Party reference
    if (isPartyRefValue(value) && value.ccPartyId) {
        ids.add(value.ccPartyId);
    } 
    // Fallback if the object itself is a resolved CCParty wrapping its ID
    else if (typeof value === 'object' && typeof value.ccPartyId === 'string' && value.ccPartyId) {
        ids.add(value.ccPartyId);
    }
    
    // 2. Repeated values (Collection fields)
    if (Array.isArray(value)) {
        for (const item of value) {
            // Arrays might contain scalars or composite objects
            extractCanonicalPartyIds(item).forEach(id => ids.add(id));
        }
    }
    // 3. Composite / Grouped rows (e.g. structured collection row where a member is a party)
    else if (typeof value === 'object' && value !== null && !isPartyValue(value)) {
        // Only inspect immediate top-level members of the structured row
        for (const key of Object.keys(value)) {
            const member = value[key];
            if (isPartyRefValue(member) && member.ccPartyId) {
                ids.add(member.ccPartyId);
            } else if (Array.isArray(member)) {
                for (const item of member) {
                    if (isPartyRefValue(item) && item.ccPartyId) {
                        ids.add(item.ccPartyId);
                    }
                }
            }
        }
    }
    
    return Array.from(ids);
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
    } else if ('forenames' in value || 'surname' in value || 'roles' in value || 'firstName' in value || 'lastName' in value || 'organisationName' in value || 'displayName' in value || 'partyType' in value || 'metadata_type' in value || 'name' in value) {
        // Automatically inject the missing discriminant so the editor works
        if (!('contactType' in value)) {
            if (value.metadata_type === 'LEGAL_ENTITY' || value.organisationName || value.companyName || value.legalName || ('name' in value && !('firstName' in value))) {
                value.contactType = 'CONTACT';
                value.partyType = 'ORGANISATION';
            } else {
                value.contactType = 'PERSON';
            }
        }
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

import { isFieldPermittedByCatalogue } from './party-display-catalogue';

export function isFieldPermittedByMask(fieldPath: string, displayMask?: string[], allowedPartyTypes?: any[]): boolean {
    return isFieldPermittedByCatalogue(fieldPath, displayMask, allowedPartyTypes);
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
    const permittedOrgName = !isMasked('organisationName') || !isMasked('legalName') ? (v.organisationName || (v as any).companyName || (v as any).name || (v as any).legalName) : null;
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
 * Returns the purely canonical name representation for a party, ignoring roles.
 * Suitable for searching and plain identity labels.
 */
export function getPartyName(v: PartyValue | CCPartyData): string {
    if (!v) return '';

    // V2 Schema Support
    if (v && typeof v === 'object' && 'schemaVersion' in v && (v as CCPartyData).schemaVersion === 2) {
        if (v.partyType === 'ORGANISATION') return (v as any).legalName || '';
        if (v.partyType === 'TEAM') return (v as any).teamName || '';
        if (v.partyType === 'INDIVIDUAL') {
            const ind = v as any;
            return [ind.title, ind.forenames, ind.surname].filter(Boolean).join(' ');
        }
    }

    // V1 / Legacy Support
    const pv = v as PartyValue;
    if (pv.partyType === 'ORGANISATION' || pv.contactType === 'CONTACT') {
        return pv.displayName || pv.organisationName || (pv as any).companyName || (pv as any).legalName || (pv as any).name || '';
    }

    return [pv.title, pv.forenames, pv.surname].filter(Boolean).join(' ') || (pv as any).name || '';
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

// ── Display Projection ──────────────────────────────────────────────────────────

export interface PartyDisplayProjection {
    primaryText: string;
    secondaryParts: string[];
    addressText: string;
}

/**
 * Returns a full presentation-neutral projection of the Party value, preserving 
 * canonical /master UI formatting (name, role, DOB, email, address) while 
 * strictly honoring the displayMask. 
 */
export function getPartyDisplayProjection(value: any, displayMask?: string[], fallbackPartyLabel?: string): PartyDisplayProjection {
    let poc = value;
    if (value && typeof value === 'object' && value.ccPartyId) {
        poc = value.ccParty?.data || value._resolvedData?.ccParty?.data;
    }
    
    if (!isPartyValue(poc)) {
        return { primaryText: fallbackPartyLabel || "", secondaryParts: [], addressText: "" };
    }

    const showField = (key: string) => isFieldPermittedByMask(key, displayMask);

    let primaryText = "";
    if (showField('displayName') && poc.displayName) {
        primaryText = poc.displayName;
    } else if ((showField('organisationName') || showField('legalName')) && (poc.organisationName || (poc as any).legalName)) {
        primaryText = poc.organisationName || (poc as any).legalName;
    } else {
        const titleParts = [];
        if (showField('title') && poc.title) titleParts.push(poc.title);
        if (showField('forenames') && poc.forenames) titleParts.push(poc.forenames);
        if (showField('surname') && poc.surname) titleParts.push(poc.surname);
        primaryText = titleParts.join(' ');
    }
    
    if (!primaryText && fallbackPartyLabel) {
        primaryText = fallbackPartyLabel;
    }

    const secondaryParts: string[] = [];
    if (showField('roles') && Array.isArray(poc.roles) && poc.roles.length > 0) {
        const r = poc.roles[0];
        let roleStr = r.roleTitle || r.roleType || "";
        const dates = [];
        if (r.appointedOn) dates.push(`Appointed ${r.appointedOn}`);
        if (r.resignedOn) dates.push(`Resigned ${r.resignedOn}`);
        if (dates.length > 0) roleStr += ` (${dates.join(' · ')})`;
        if (roleStr) secondaryParts.push(roleStr);
    }
    
    if (showField('dateOfBirth') && poc.dateOfBirth) {
        const dobStr = formatPartialDob(poc.dateOfBirth, displayMask);
        if (dobStr) secondaryParts.push(`DOB: ${dobStr}`);
    }
    
    if (showField('email') && poc.email) {
        secondaryParts.push(poc.email);
    }

    let addressText = "";
    if (showField('correspondenceAddress') && poc.correspondenceAddress) {
        const summary = getAddressSummary(poc.correspondenceAddress);
        if (summary) addressText = summary;
    }

    return {
        primaryText: primaryText.trim(),
        secondaryParts,
        addressText
    };
}

export function formatPartialDob(
    dob: { year: number | null; month: number | null; day: number | null } | null | undefined,
    displayMask?: string[]
): string | null {
    if (!dob) return null;
    const parts: string[] = [];
    
    if (dob.day && isFieldPermittedByMask('dateOfBirth.day', displayMask)) parts.push(String(dob.day));
    
    if (dob.month && isFieldPermittedByMask('dateOfBirth.month', displayMask)) {
        const date = new Date(2000, dob.month - 1, 1);
        const monthName = date.toLocaleString('default', { month: 'long' });
        parts.push(monthName);
    }
    
    if (dob.year && isFieldPermittedByMask('dateOfBirth.year', displayMask)) parts.push(String(dob.year));
    
    return parts.length > 0 ? parts.join(' ') : null;
}

