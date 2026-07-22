/**
 * party-display-catalogue.ts
 *
 * Central single source of truth for display mask keys, labels, category groupings,
 * and V2 party-type applicability. Shared between Master Data Manager mask editor
 * and display mask permission evaluation.
 */

import type { V2PartyType } from './party-v2/CCPartyData';

export type CanonicalMaskKey =
    | 'individual.title'
    | 'individual.forenames'
    | 'individual.surname'
    | 'individual.partyType'
    | 'individual.partySubType'
    | 'individual.contactType'
    | 'individual.fullName'
    | 'individual.dateOfBirth.year'
    | 'individual.dateOfBirth.month'
    | 'individual.dateOfBirth.day'
    | 'individual.nationality'
    | 'individual.countryOfResidence'
    | 'individual.placeOfBirth'
    | 'individual.correspondenceAddress'
    | 'organisation.legalName'
    | 'organisation.partyType'
    | 'organisation.partySubType'
    | 'organisation.contactType'
    | 'organisation.correspondenceAddress'
    | 'team.teamName'
    | 'team.partyType'
    | 'team.partySubType'
    | 'team.contactType'
    | 'team.correspondenceAddress'
    | 'contact.email'
    | 'contact.phones'
    | 'role.roleTitle'
    | 'role.roleType'
    | 'role.appointedOn'
    | 'role.resignedOn'
    | 'role.isActiveRole'
    | 'role.natureOfControl';

export type DisplayMaskCategory =
    | 'IDENTITY'
    | 'DATE_OF_BIRTH'
    | 'LOCATION_PERSONAL'
    | 'CONTACT'
    | 'ROLE_CONTEXT'
    | 'ORGANISATION_DETAILS';

export interface DisplayFieldDefinition {
    key: CanonicalMaskKey;
    label: string;
    category: DisplayMaskCategory;
    appliesToPartyTypes: V2PartyType[];
    legacyKeys: string[];
    deEmphasise?: boolean;
}

export const PARTY_DISPLAY_CATALOGUE: DisplayFieldDefinition[] = [
    // --- INDIVIDUAL IDENTITY ---
    { key: 'individual.title', label: 'Title', category: 'IDENTITY', appliesToPartyTypes: ['INDIVIDUAL'], legacyKeys: ['title'] },
    { key: 'individual.forenames', label: 'Forenames', category: 'IDENTITY', appliesToPartyTypes: ['INDIVIDUAL'], legacyKeys: ['forenames'] },
    { key: 'individual.surname', label: 'Surname', category: 'IDENTITY', appliesToPartyTypes: ['INDIVIDUAL'], legacyKeys: ['surname'] },
    { key: 'individual.partyType', label: 'Party Type', category: 'IDENTITY', appliesToPartyTypes: ['INDIVIDUAL'], legacyKeys: ['partyType'] },
    { key: 'individual.partySubType', label: 'Party Subtype', category: 'IDENTITY', appliesToPartyTypes: ['INDIVIDUAL'], legacyKeys: ['partySubType'] },
    { key: 'individual.contactType', label: 'Contact Type', category: 'IDENTITY', appliesToPartyTypes: ['INDIVIDUAL'], legacyKeys: ['contactType'] },
    { key: 'individual.fullName', label: 'Full name (derived)', category: 'IDENTITY', appliesToPartyTypes: ['INDIVIDUAL'], legacyKeys: ['fullName'], deEmphasise: true },

    // --- ORGANISATION IDENTITY & DETAILS ---
    { key: 'organisation.legalName', label: 'Organisation Name', category: 'IDENTITY', appliesToPartyTypes: ['ORGANISATION'], legacyKeys: ['organisationName', 'legalName'] },
    { key: 'organisation.partyType', label: 'Party Type', category: 'IDENTITY', appliesToPartyTypes: ['ORGANISATION'], legacyKeys: ['partyType'] },
    { key: 'organisation.partySubType', label: 'Party Subtype', category: 'IDENTITY', appliesToPartyTypes: ['ORGANISATION'], legacyKeys: ['partySubType'] },
    { key: 'organisation.contactType', label: 'Contact Type', category: 'IDENTITY', appliesToPartyTypes: ['ORGANISATION'], legacyKeys: ['contactType'] },

    // --- TEAM IDENTITY ---
    { key: 'team.teamName', label: 'Team Name', category: 'IDENTITY', appliesToPartyTypes: ['TEAM'], legacyKeys: ['teamName', 'organisationName'] },
    { key: 'team.partyType', label: 'Party Type', category: 'IDENTITY', appliesToPartyTypes: ['TEAM'], legacyKeys: ['partyType'] },
    { key: 'team.partySubType', label: 'Party Subtype', category: 'IDENTITY', appliesToPartyTypes: ['TEAM'], legacyKeys: ['partySubType'] },
    { key: 'team.contactType', label: 'Contact Type', category: 'IDENTITY', appliesToPartyTypes: ['TEAM'], legacyKeys: ['contactType'] },

    // --- DATE OF BIRTH (Individual only) ---
    { key: 'individual.dateOfBirth.year', label: 'Year', category: 'DATE_OF_BIRTH', appliesToPartyTypes: ['INDIVIDUAL'], legacyKeys: ['dateOfBirth.year'] },
    { key: 'individual.dateOfBirth.month', label: 'Month', category: 'DATE_OF_BIRTH', appliesToPartyTypes: ['INDIVIDUAL'], legacyKeys: ['dateOfBirth.month'] },
    { key: 'individual.dateOfBirth.day', label: 'Day', category: 'DATE_OF_BIRTH', appliesToPartyTypes: ['INDIVIDUAL'], legacyKeys: ['dateOfBirth.day'] },

    // --- LOCATION & PERSONAL (Individual) ---
    { key: 'individual.nationality', label: 'Nationality', category: 'LOCATION_PERSONAL', appliesToPartyTypes: ['INDIVIDUAL'], legacyKeys: ['nationality'] },
    { key: 'individual.countryOfResidence', label: 'Country of Residence', category: 'LOCATION_PERSONAL', appliesToPartyTypes: ['INDIVIDUAL'], legacyKeys: ['countryOfResidence'] },
    { key: 'individual.placeOfBirth', label: 'Place of Birth', category: 'LOCATION_PERSONAL', appliesToPartyTypes: ['INDIVIDUAL'], legacyKeys: ['placeOfBirth'] },
    { key: 'individual.correspondenceAddress', label: 'Correspondence Address', category: 'LOCATION_PERSONAL', appliesToPartyTypes: ['INDIVIDUAL'], legacyKeys: ['correspondenceAddress'] },

    // --- ADDRESS (Organisation & Team) ---
    { key: 'organisation.correspondenceAddress', label: 'Correspondence Address', category: 'LOCATION_PERSONAL', appliesToPartyTypes: ['ORGANISATION'], legacyKeys: ['correspondenceAddress'] },
    { key: 'team.correspondenceAddress', label: 'Correspondence Address', category: 'LOCATION_PERSONAL', appliesToPartyTypes: ['TEAM'], legacyKeys: ['correspondenceAddress'] },

    // --- CONTACT (Shared across all) ---
    { key: 'contact.email', label: 'Email', category: 'CONTACT', appliesToPartyTypes: ['INDIVIDUAL', 'ORGANISATION', 'TEAM'], legacyKeys: ['email'] },
    { key: 'contact.phones', label: 'Phones', category: 'CONTACT', appliesToPartyTypes: ['INDIVIDUAL', 'ORGANISATION', 'TEAM'], legacyKeys: ['phones'] },

    // --- ROLE CONTEXT (Individual & Organisation) ---
    { key: 'role.roleTitle', label: 'Role Title', category: 'ROLE_CONTEXT', appliesToPartyTypes: ['INDIVIDUAL', 'ORGANISATION'], legacyKeys: ['roles[0].roleTitle', 'roles.roleTitle'] },
    { key: 'role.roleType', label: 'Role Type', category: 'ROLE_CONTEXT', appliesToPartyTypes: ['INDIVIDUAL', 'ORGANISATION'], legacyKeys: ['roles[0].roleType', 'roles.roleType'] },
    { key: 'role.appointedOn', label: 'Appointed On', category: 'ROLE_CONTEXT', appliesToPartyTypes: ['INDIVIDUAL', 'ORGANISATION'], legacyKeys: ['roles[0].appointedOn', 'roles.appointedOn'] },
    { key: 'role.resignedOn', label: 'Resigned On', category: 'ROLE_CONTEXT', appliesToPartyTypes: ['INDIVIDUAL', 'ORGANISATION'], legacyKeys: ['roles[0].resignedOn', 'roles.resignedOn'] },
    { key: 'role.isActiveRole', label: 'Is Active Role', category: 'ROLE_CONTEXT', appliesToPartyTypes: ['INDIVIDUAL', 'ORGANISATION'], legacyKeys: ['roles[0].isActiveRole', 'roles.isActiveRole'] },
    { key: 'role.natureOfControl', label: 'Nature of Control', category: 'ROLE_CONTEXT', appliesToPartyTypes: ['INDIVIDUAL', 'ORGANISATION'], legacyKeys: ['roles[0].natureOfControl', 'roles.natureOfControl'] },
];

/** Category display metadata */
export const DISPLAY_CATEGORY_CONFIG: Array<{ category: DisplayMaskCategory; label: string }> = [
    { category: 'IDENTITY', label: 'Identity' },
    { category: 'DATE_OF_BIRTH', label: 'Date of Birth' },
    { category: 'LOCATION_PERSONAL', label: 'Location / Personal Details' },
    { category: 'ORGANISATION_DETAILS', label: 'Organisation Details' },
    { category: 'CONTACT', label: 'Contact' },
    { category: 'ROLE_CONTEXT', label: 'Role Context' }
];

/** Map from legacy key / path to canonical keys */
const LEGACY_KEY_TO_CANONICAL = new Map<string, CanonicalMaskKey[]>();

for (const def of PARTY_DISPLAY_CATALOGUE) {
    // Direct mapping of canonical key
    if (!LEGACY_KEY_TO_CANONICAL.has(def.key)) {
        LEGACY_KEY_TO_CANONICAL.set(def.key, [def.key]);
    }
    // Mapping of legacy keys
    for (const legacy of def.legacyKeys) {
        const existing = LEGACY_KEY_TO_CANONICAL.get(legacy) || [];
        if (!existing.includes(def.key)) {
            LEGACY_KEY_TO_CANONICAL.set(legacy, [...existing, def.key]);
        }
    }
}

/** All known canonical and legacy keys for quick validation */
const ALL_KNOWN_KEYS = new Set<string>();
for (const def of PARTY_DISPLAY_CATALOGUE) {
    ALL_KNOWN_KEYS.add(def.key);
    for (const legacy of def.legacyKeys) {
        ALL_KNOWN_KEYS.add(legacy);
    }
}

/**
 * Returns display fields applicable to the specified allowedPartyTypes.
 * If allowedPartyTypes is undefined, defaults to all party types.
 * If allowedPartyTypes is [], returns empty array (no party types permitted).
 */
export function getDisplayFieldsForPartyTypes(allowedPartyTypes?: V2PartyType[]): DisplayFieldDefinition[] {
    if (allowedPartyTypes !== undefined && allowedPartyTypes.length === 0) {
        return [];
    }

    const activeTypes = allowedPartyTypes ?? ['INDIVIDUAL', 'ORGANISATION', 'TEAM'];
    const activeTypeSet = new Set(activeTypes);

    // Deduplicate fields by key while preserving catalogue order
    const seenKeys = new Set<CanonicalMaskKey>();
    const result: DisplayFieldDefinition[] = [];

    for (const item of PARTY_DISPLAY_CATALOGUE) {
        const applies = item.appliesToPartyTypes.some(t => activeTypeSet.has(t));
        if (applies && !seenKeys.has(item.key)) {
            seenKeys.add(item.key);
            result.push(item);
        }
    }

    return result;
}

/**
 * Normalizes an array of field paths (legacy or canonical) into expanded CanonicalMaskKeys,
 * taking into account allowedPartyTypes to disambiguate keys like 'organisationName'.
 */
export function normalizeMaskKeysToCanonical(
    rawKeys: string[],
    allowedPartyTypes?: V2PartyType[]
): { canonicalKeys: Set<CanonicalMaskKey>; hasUnrecognizedKeys: boolean; recognizedCount: number } {
    const canonicalKeys = new Set<CanonicalMaskKey>();
    const activeTypes = allowedPartyTypes && allowedPartyTypes.length > 0 ? new Set(allowedPartyTypes) : null;

    let recognizedCount = 0;
    let hasUnrecognizedKeys = false;

    const normalisePath = (p: string) => p.replace(/\[(\w+)\]/g, '.$1');

    for (const rawKey of rawKeys) {
        const normKey = normalisePath(rawKey);

        // De-index role paths (e.g. roles.0.roleTitle -> roles.roleTitle or roles[0].roleTitle)
        let resolvedKey = normKey;
        if (/^roles\.\d+\./.test(normKey)) {
            resolvedKey = normKey.replace(/^roles\.\d+\./, 'roles.');
        } else if (/^roles\.\d+$/.test(normKey)) {
            resolvedKey = normKey.replace(/^roles\.\d+$/, 'roles');
        }

        // Direct lookup or legacy key lookup
        const matches = LEGACY_KEY_TO_CANONICAL.get(resolvedKey) || LEGACY_KEY_TO_CANONICAL.get(rawKey);

        if (matches && matches.length > 0) {
            recognizedCount++;
            for (const canonicalKey of matches) {
                const def = PARTY_DISPLAY_CATALOGUE.find(d => d.key === canonicalKey);
                if (def) {
                    // Filter match by active party types if specified
                    if (!activeTypes || def.appliesToPartyTypes.some(t => activeTypes.has(t))) {
                        canonicalKeys.add(canonicalKey);
                    }
                } else {
                    canonicalKeys.add(canonicalKey);
                }
            }
        } else {
            hasUnrecognizedKeys = true;
        }
    }

    return { canonicalKeys, hasUnrecognizedKeys, recognizedCount };
}

/**
 * Main permission evaluator for party display mask.
 *
 * Rules:
 * 1. displayMask is absent (undefined/null) or explicitly [] -> ALLOW (unrestricted display, legacy default).
 * 2. displayMask contains zero recognized keys (e.g. ['invalid_junk']) -> DENY ALL.
 * 3. displayMask contains recognized keys -> test fieldPath match against normalized canonical keys.
 */
export function isFieldPermittedByCatalogue(
    fieldPath: string,
    displayMask?: string[],
    allowedPartyTypes?: V2PartyType[]
): boolean {
    if (!displayMask || !Array.isArray(displayMask) || displayMask.length === 0) {
        return true;
    }

    const { canonicalKeys, recognizedCount } = normalizeMaskKeysToCanonical(displayMask, allowedPartyTypes);

    // Rule 2: A non-empty displayMask containing ZERO recognized keys must DENY all fields
    if (recognizedCount === 0) {
        return false;
    }

    // Normalise candidate fieldPath
    const normalise = (p: string) => p.replace(/\[(\w+)\]/g, '.$1');
    let normFieldPath = normalise(fieldPath);

    // De-index candidate role field path (e.g. roles.0.roleTitle -> roles.roleTitle)
    if (/^roles\.\d+\./.test(normFieldPath)) {
        normFieldPath = normFieldPath.replace(/^roles\.\d+\./, 'roles.');
    } else if (/^roles\.\d+$/.test(normFieldPath)) {
        normFieldPath = normFieldPath.replace(/^roles\.\d+$/, 'roles');
    }

    // Direct lookup of candidate field path to its canonical keys
    const candidateCanonicalKeys = LEGACY_KEY_TO_CANONICAL.get(normFieldPath) || LEGACY_KEY_TO_CANONICAL.get(fieldPath) || [];

    // Test direct canonical match first
    for (const candKey of candidateCanonicalKeys) {
        if (canonicalKeys.has(candKey)) {
            return true;
        }
    }

    // Test prefix matching against allowed canonical keys
    for (const maskKey of Array.from(canonicalKeys)) {
        const def = PARTY_DISPLAY_CATALOGUE.find(d => d.key === maskKey);
        if (!def) continue;

        // Check if any legacy keys or canonical key match field path
        const allKeys = [def.key, ...def.legacyKeys];
        for (const k of allKeys) {
            const normK = normalise(k);
            if (normK === normFieldPath) return true;
            if (normFieldPath.startsWith(normK + '.')) return true;
            if (normK.startsWith(normFieldPath + '.')) return true;
        }
    }

    return false;
}
