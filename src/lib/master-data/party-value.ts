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
import { formatDate } from './structured-value-formatters';
import { normaliseCCPartyData as normalisePartyReadModel } from './party-v2/normaliser';
import { getPartyLabel } from './party-v2/label-helper';

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
    
    // 1. Scalar Party reference or canonical Party object
    if (isPartyRefValue(value) && value.ccPartyId) {
        ids.add(value.ccPartyId);
    } 
    else if (typeof value === 'object' && typeof value.ccPartyId === 'string' && value.ccPartyId) {
        ids.add(value.ccPartyId);
    }
    else if (typeof value === 'object' && typeof value.id === 'string' && value.id) {
        ids.add(value.id);
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

    /** Companies House Officer Identity Verification details (if present from source API). */
    identityVerification?: PartyRoleIdentityVerification | null;
}

export interface PartyRoleIdentityVerification {
    appointmentVerificationStartOn?: string | null;
    appointmentVerificationEndOn?: string | null;
    appointmentVerificationStatementDueOn?: string | null;
    identityVerifiedOn?: string | null;
    authorisedCorporateServiceProviderName?: string | null;
    antiMoneyLaunderingSupervisoryBodies?: string[] | null;
    preferredName?: string | null;
}

/**
 * Returns a restrained presentation label for officer identity verification status.
 *
 * Rules (Amendment 2):
 * 1. identityVerifiedOn present -> "Identity verified"
 * 2. appointmentVerificationStartOn present:
 *    - no end date (null/undefined) -> "Identity verified"
 *    - end is "9999-12-31" -> "Identity verified"
 *    - end is in future (>= today) -> "Identity verified"
 *    - end is in past -> expired (do NOT report as verified unless identityVerifiedOn is set)
 * 3. appointmentVerificationStatementDueOn with no active statement -> "Identity verification due [formatted date]"
 * 4. no verification info -> null
 */
export function getIdentityVerificationLabel(iv?: PartyRoleIdentityVerification | null): string | null {
    if (!iv) return null;

    // 1. Explicit identityVerifiedOn
    if (iv.identityVerifiedOn) {
        return 'Identity verified';
    }

    // 2. Active appointment verification period
    const startOn = iv.appointmentVerificationStartOn;
    const endOn = iv.appointmentVerificationEndOn;

    if (startOn) {
        let isCurrent = false;

        if (!endOn || endOn === '9999-12-31') {
            isCurrent = true;
        } else {
            try {
                const endDate = new Date(endOn);
                if (!isNaN(endDate.getTime())) {
                    const now = new Date();
                    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
                    isCurrent = endDate.getTime() >= todayStart;
                }
            } catch {
                isCurrent = false;
            }
        }

        if (isCurrent) {
            return 'Identity verified';
        }
    }

    // 3. Statement due date with no active statement
    if (iv.appointmentVerificationStatementDueOn) {
        const dueFormatted = formatDate(iv.appointmentVerificationStatementDueOn) || iv.appointmentVerificationStatementDueOn;
        return `Identity verification due ${dueFormatted}`;
    }

    return null;
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
    if (pv.partyType === 'TEAM') {
        return (pv as any).teamName || pv.displayName || pv.organisationName || '';
    }
    if (pv.partyType === 'ORGANISATION' || pv.contactType === 'CONTACT') {
        return pv.displayName || pv.organisationName || (pv as any).companyName || (pv as any).legalName || (pv as any).name || (pv as any).teamName || '';
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

const NOC_LABELS: Record<string, string> = {
    'ownership-of-shares-25-to-50-percent': 'Ownership of shares — 25% to 50%',
    'ownership-of-shares-50-to-75-percent': 'Ownership of shares — 50% to 75%',
    'ownership-of-shares-75-to-100-percent': 'Ownership of shares — 75% or more',
    'voting-rights-25-to-50-percent': 'Ownership of voting rights — 25% to 50%',
    'voting-rights-50-to-75-percent': 'Ownership of voting rights — 50% to 75%',
    'voting-rights-75-to-100-percent': 'Ownership of voting rights — 75% or more',
    'right-to-appoint-and-remove-directors': 'Right to appoint or remove directors',
    'right-to-appoint-and-remove-personnel': 'Right to appoint or remove personnel',
    'significant-influence-or-control': 'Significant influence or control',
    'ownership-of-shares-75-to-100-percent-as-trust': 'Ownership of shares — 75% or more (as trust)',
    'ownership-of-shares-75-to-100-percent-as-firm': 'Ownership of shares — 75% or more (as firm)',
    'voting-rights-75-to-100-percent-as-trust': 'Ownership of voting rights — 75% or more (as trust)',
    'voting-rights-75-to-100-percent-as-firm': 'Ownership of voting rights — 75% or more (as firm)',
    'right-to-appoint-and-remove-directors-as-trust': 'Right to appoint or remove directors (as trust)',
    'right-to-appoint-and-remove-directors-as-firm': 'Right to appoint or remove directors (as firm)',
    'significant-influence-or-control-as-trust': 'Significant influence or control (as trust)',
    'significant-influence-or-control-as-firm': 'Significant influence or control (as firm)',
};

export function formatNatureOfControl(noc: string): string {
    if (!noc) return '';
    const clean = noc.trim();
    if (NOC_LABELS[clean]) return NOC_LABELS[clean];

    let label = clean
        .replace(/-as-(trust|firm)/, ' (as $1)')
        .replace(/ownership-of-shares-75-to-100-percent/, 'Ownership of shares — 75% or more')
        .replace(/voting-rights-75-to-100-percent/, 'Ownership of voting rights — 75% or more')
        .replace(/right-to-appoint-and-remove-directors/, 'Right to appoint or remove directors')
        .replace(/-/g, ' ');

    return label.charAt(0).toUpperCase() + label.slice(1);
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

    // 1. Authoritative canonical partyLabel from canonicalDisplayModel (passed via fallbackPartyLabel)
    if (fallbackPartyLabel && fallbackPartyLabel.trim().length > 0) {
        primaryText = fallbackPartyLabel.trim();
    } else {
        // 2. Canonical Party normalization (normalisePartyReadModel → getPartyLabel)
        const norm = normalisePartyReadModel(poc);
        if (norm) {
            const canonicalLabel = getPartyLabel(norm);
            if (canonicalLabel && canonicalLabel !== "Unnamed party" && canonicalLabel !== "Unnamed individual" && canonicalLabel !== "Unnamed organisation" && canonicalLabel !== "Unnamed team") {
                primaryText = canonicalLabel;
            }
        }
        
        // 3. Defensive legacy/raw-property fallbacks if genuinely required for unsupported historic shapes
        if (!primaryText) {
            if (showField('displayName') && poc.displayName) {
                primaryText = poc.displayName;
            } else if ((showField('organisationName') || showField('legalName')) && (poc.organisationName || (poc as any).legalName || (poc as any).companyName || (poc as any).name)) {
                primaryText = poc.organisationName || (poc as any).legalName || (poc as any).companyName || (poc as any).name;
            } else {
                const titleParts = [];
                if (showField('title') && poc.title) titleParts.push(poc.title);
                if (showField('forenames') && poc.forenames) titleParts.push(poc.forenames);
                if (showField('surname') && poc.surname) titleParts.push(poc.surname);
                primaryText = titleParts.join(' ');
            }
        }
    }

    const secondaryParts: string[] = [];
    if (showField('roles') && Array.isArray(poc.roles) && poc.roles.length > 0) {
        const r = poc.roles[0];

        const isPsc = r.roleType === 'PSC' ||
            String(r.roleTitle || '').toLowerCase().includes('person-with-significant-control') ||
            String(r.roleTitle || '').toLowerCase().includes('person with significant control') ||
            (Array.isArray(r.natureOfControl) && r.natureOfControl.length > 0);

        const appointedLabel = isPsc ? 'Notified' : 'Appointed';
        const resignedLabel  = isPsc ? 'Ceased'   : 'Resigned';

        let roleStr = r.roleTitle || r.roleType || "";
        const dates = [];
        if (r.appointedOn) dates.push(`${appointedLabel} ${r.appointedOn}`);
        if (r.resignedOn) dates.push(`${resignedLabel} ${r.resignedOn}`);
        if (dates.length > 0) roleStr += ` (${dates.join(' · ')})`;
        if (roleStr) secondaryParts.push(roleStr);

        const showNoc = showField('roles[0].natureOfControl') || showField('role.natureOfControl') || showField('natureOfControl') || showField('roles');
        if (showNoc && Array.isArray(r.natureOfControl) && r.natureOfControl.length > 0) {
            for (const noc of r.natureOfControl) {
                const formattedNoc = formatNatureOfControl(noc);
                if (formattedNoc && !secondaryParts.includes(formattedNoc)) {
                    secondaryParts.push(formattedNoc);
                }
            }
        }

        const ivLabel = getIdentityVerificationLabel(r.identityVerification);
        if (ivLabel) secondaryParts.push(ivLabel);
    }

    // Organisation secondary parts (only when displayMask is explicitly provided)
    if (displayMask && displayMask.length > 0) {
        const incorporatedIn = (poc as any).incorporatedIn || (poc as any).jurisdiction || (poc as any).countryOfResidence;
        if ((showField('incorporatedIn') || showField('jurisdiction')) && incorporatedIn) {
            secondaryParts.push(`Inc: ${incorporatedIn}`);
        }

        const regNo = (poc as any).registrationNumber || (poc as any).registeredAs;
        if ((showField('registrationNumber') || showField('registeredAs')) && regNo) {
            secondaryParts.push(`Reg: ${regNo}`);
        }

        // Derive LEI from sourceIdentifiers array
        const sourceIds: Array<{ scheme: string; value: string }> = Array.isArray((poc as any).sourceIdentifiers) ? (poc as any).sourceIdentifiers : [];
        const leiId = sourceIds.find((s: any) => s && (s.scheme === 'LEI' || s.scheme === 'GLEIF_LEI'))?.value || (poc as any).lei;
        if ((showField('lei') || showField('sourceIdentifiers')) && leiId) {
            secondaryParts.push(`LEI: ${leiId}`);
        }

        const legalForm = (poc as any).legalForm || (poc as any).legalFormId;
        if ((showField('legalForm') || showField('legalFormId')) && legalForm) {
            secondaryParts.push(`Form: ${legalForm}`);
        }
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

/**
 * Server-side Party Field Disclosure Projection
 *
 * Constructs a Projected Party representation from a canonical Party object based on displayMask.
 * Preserves minimum canonical Party label as an invariant outside the mask.
 * Redacts/strips unpermitted PII (DOB, home address, email, phone, roles, sourceIdentifiers, etc.)
 * so unpermitted properties are not serialized to read-only clients.
 */
export function buildPartyFieldProjection(party: any, displayMask?: string[], fallbackPartyLabel?: string): any {
    if (!party || typeof party !== 'object') return party;

    // Handle partyRef wrappers
    if (party.ccPartyId) {
        const rawResolved = party.ccParty?.data || party._resolvedData?.ccParty?.data;
        if (rawResolved) {
            const projectedData = buildPartyFieldProjection(rawResolved, displayMask, fallbackPartyLabel);
            const norm = normalisePartyReadModel(rawResolved);
            const label = fallbackPartyLabel || (norm ? getPartyLabel(norm) : `ID:${party.ccPartyId.slice(0, 8)}…`);
            return {
                ...party,
                _resolvedData: {
                    ...(party._resolvedData || {}),
                    ccParty: {
                        ...(party._resolvedData?.ccParty || {}),
                        data: projectedData
                    }
                },
                ccParty: {
                    ...(party.ccParty || {}),
                    data: projectedData
                },
                summary: getPartySummary(projectedData, displayMask),
                partyLabel: label
            };
        }
        return party;
    }

    if (!isPartyValue(party)) return party;

    const norm = normalisePartyReadModel(party);
    const canonicalLabel = fallbackPartyLabel || (norm ? getPartyLabel(norm) : null) || getPartyName(party) || getPartySummary(party);

    const showField = (key: string) => isFieldPermittedByCatalogue(key, displayMask);

    const projected: any = {
        contactType: party.contactType || (party.partyType === 'ORGANISATION' ? 'CONTACT' : 'PERSON'),
        partyType: party.partyType || null,
        partySubType: party.partySubType || null,
        displayName: canonicalLabel,
    };

    if (party.schemaVersion) projected.schemaVersion = party.schemaVersion;
    if (party.id) projected.id = party.id;
    if (party.ccPartyId) projected.ccPartyId = party.ccPartyId;

    // Title / Forenames / Surname / OrganisationName / TeamName
    if (showField('title') && party.title) projected.title = party.title;
    else projected.title = null;

    if (showField('forenames') && party.forenames) projected.forenames = party.forenames;
    else projected.forenames = null;

    if (showField('surname') && party.surname) projected.surname = party.surname;
    else projected.surname = null;

    if ((showField('organisationName') || showField('legalName')) && (party.organisationName || party.legalName)) {
        projected.organisationName = party.organisationName || party.legalName;
        projected.legalName = party.legalName || party.organisationName;
    }

    if (showField('teamName') && party.teamName) projected.teamName = party.teamName;

    // Contact
    if (showField('email') && party.email) projected.email = party.email;
    else projected.email = null;

    if (showField('phones') && Array.isArray(party.phones)) projected.phones = party.phones;
    else projected.phones = [];

    // Individual attributes
    if (showField('nationality') && Array.isArray(party.nationality)) projected.nationality = party.nationality;
    else projected.nationality = [];

    if (showField('countryOfResidence') && party.countryOfResidence) projected.countryOfResidence = party.countryOfResidence;
    else projected.countryOfResidence = null;

    if (showField('placeOfBirth') && party.placeOfBirth) projected.placeOfBirth = party.placeOfBirth;
    else projected.placeOfBirth = null;

    if (showField('correspondenceAddress') && party.correspondenceAddress) projected.correspondenceAddress = party.correspondenceAddress;
    else projected.correspondenceAddress = null;

    if (showField('dateOfBirth') && party.dateOfBirth) {
        const dob: any = {};
        if (showField('dateOfBirth.year') && party.dateOfBirth.year) dob.year = party.dateOfBirth.year;
        if (showField('dateOfBirth.month') && party.dateOfBirth.month) dob.month = party.dateOfBirth.month;
        if (showField('dateOfBirth.day') && party.dateOfBirth.day) dob.day = party.dateOfBirth.day;
        projected.dateOfBirth = Object.keys(dob).length > 0 ? dob : null;
    } else {
        projected.dateOfBirth = null;
    }

    // Organisation details
    if (showField('incorporatedIn') && (party.incorporatedIn || party.jurisdiction)) {
        projected.incorporatedIn = party.incorporatedIn || party.jurisdiction;
    }
    if (showField('registrationNumber') && (party.registrationNumber || party.registeredAs)) {
        projected.registrationNumber = party.registrationNumber || party.registeredAs;
    }
    if (showField('legalForm') && (party.legalForm || party.legalFormId)) {
        projected.legalForm = party.legalForm || party.legalFormId;
    }
    if (showField('lei') && party.lei) {
        projected.lei = party.lei;
    }

    // Roles
    if (showField('roles') && Array.isArray(party.roles)) {
        projected.roles = party.roles.map((r: any, idx: number) => {
            const roleProj: any = { company: r.company || null };
            if (showField(`roles[${idx}].roleTitle`) || showField('role.roleTitle')) roleProj.roleTitle = r.roleTitle || null;
            if (showField(`roles[${idx}].roleType`) || showField('role.roleType')) roleProj.roleType = r.roleType || null;
            if (showField(`roles[${idx}].appointedOn`) || showField('role.appointedOn')) roleProj.appointedOn = r.appointedOn || null;
            if (showField(`roles[${idx}].resignedOn`) || showField('role.resignedOn')) roleProj.resignedOn = r.resignedOn || null;
            if (showField(`roles[${idx}].isActiveRole`) || showField('role.isActiveRole')) roleProj.isActiveRole = r.isActiveRole ?? null;
            if (showField(`roles[${idx}].natureOfControl`) || showField('role.natureOfControl')) roleProj.natureOfControl = r.natureOfControl || [];
            if (r.identityVerification) roleProj.identityVerification = r.identityVerification;
            return roleProj;
        });
    } else {
        projected.roles = [];
    }

    // Source Identifiers
    if (showField('sourceIdentifiers') && Array.isArray(party.sourceIdentifiers)) {
        projected.sourceIdentifiers = party.sourceIdentifiers;
    } else {
        projected.sourceIdentifiers = [];
    }

    // Status
    projected.isActiveParty = party.isActiveParty ?? party.isActivePersonOrContact ?? null;
    projected.isActivePersonOrContact = projected.isActiveParty;

    return projected;
}

