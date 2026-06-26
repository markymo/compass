/**
 * transforms.ts
 *
 * Transform handlers for the table-driven normalizer.
 * Each transform has explicit input/output contracts.
 * Failures degrade confidence, never throw.
 */

import { SicCodeMapper } from '@/domain/registry/utils/SicCodeMapper';
import { isValidPartyValue } from '@/lib/master-data/party-value';
import { COUNTRY_CODES, COUNTRY_NAMES, resolveCountry } from '@/lib/master-data/countries';

export type TransformResult = {
    value: any;
    confidencePenalty: number; // 0 = no penalty, 0.5 = halved, etc. Applied as: confidence * (1 - penalty)
    /**
     * When `value` is an array (produced by TO_PARTY_LIST), `rowKeys[i]` is the
     * stable instanceId hint for the i-th item. Absent when value is not an array.
     */
    rowKeys?: string[];
};

type TransformType =
    | 'DIRECT'
    | 'DATE_TO_ISO'
    | 'DATETIME_TO_ISO'
    | 'COUNTRY_TO_NAME'
    | 'COUNTRY_TO_ISO2'
    | 'ENUM_MAP'
    | 'FIRST_ARRAY_ITEM'
    | 'JOIN_ARRAY'
    | 'TO_ADDRESS_OBJECT'
    | 'TO_ADDRESS_VALUE'
    | 'TO_PARTY_OBJECT'
    | 'TO_PARTY_LIST'
    | 'TO_NAME_HISTORY_LIST'
    | 'TO_CODE_LIST'
    | 'TO_COMPANIES_HOUSE_ACTIVE_DIRECTOR_PARTY_VALUE_LIST'
    /**
     * Converts a GLEIF Registration Authority code (e.g. "RA000192") to the
     * human-readable name stored in the registry_authorities table.
     *
     * The lookup is injected by the caller (GleifNormalizer) via
     * transformConfig.raNameLookup — a plain Record<string, string> loaded
     * once per enrichment run.  applyTransform never touches the DB.
     *
     * Input shapes supported:
     *   - bare string:  "RA000192"
     *   - object:       { id: "RA000192", other: null }
     *
     * On unknown code: returns the raw code with a 0.1 confidence penalty.
     */
    | 'RA_CODE_TO_NAME'
    /**
     * Converts a single source object into a PersonOrContactValue (PERSON_OR_CONTACT
     * appDataType). Stored in FieldClaim.valueJson. No graph node is created.
     *
     * transformConfig: ToPersonOrContactValueConfig — field path mappings.
     * Confidence penalty 0.05 applied when fullNamePath triggers the name parser.
     */
    | 'TO_PARTY_VALUE'
    | 'TO_PARTY_VALUE_LIST'
    | 'TO_PERSON_OR_CONTACT_VALUE' // Legacy compatibility alias
    | 'TO_PERSON_OR_CONTACT_LIST'; // Legacy compatibility alias

/**
 * Builds a deterministic row key for a PERSON_OR_CONTACT claim.
 * Stable within a single Legal Entity context (claims are already scoped to subjectLeId).
 *
 * Format: poc_{appointedOn}_{normalisedSurname}_{firstInitial}
 * Falls back to 'poc_unknown_{normalisedSurname}_{firstInitial}' when appointedOn is absent.
 *
 * @internal — exported for testing only
 */
export function buildPersonOrContactRowKey(
    appointedOn: string | null,
    poc: { surname?: string | null; forenames?: string | null }
): string {
    const surname = (poc.surname || 'unknown')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
    const firstInitial = (poc.forenames || '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .charAt(0) || '_';
    const dateStr = appointedOn ? appointedOn.split('T')[0] : 'unknown';
    return `poc_${dateStr}_${surname}_${firstInitial}`;
}


/**
 * Builds a deterministic row key for a director/officer relationship.
 * Stable within a single Legal Entity context (claims are already scoped to subjectLeId).
 *
 * Format: ch_{appointedOn}_{normalisedLastName}_{firstInitial}
 * Falls back to 'ch_unknown_{normalisedLastName}' when appointedOn is absent.
 *
 * @internal — exported for testing only
 */
export function buildDirectorRowKey(
    appointedOn: string | null,
    partyDto: { lastName?: string; firstName?: string; name?: string }
): string {
    const lastName = (partyDto.lastName || partyDto.name || 'unknown')
        .toLowerCase()
        .replace(/[^a-z]/g, '');
    const firstInitial = (partyDto.firstName || '')
        .toLowerCase()
        .replace(/[^a-z]/g, '')
        .charAt(0) || '_';
    const date = appointedOn ? appointedOn.replace(/[^0-9\-]/g, '') : 'unknown';
    return `ch_${date}_${lastName}_${firstInitial}`;
}

/**
 * Builds a deterministic row key for a name-history entry.
 *
 * Format: name_{normalisedName}_{effectiveFrom|unknown}
 *
 * Requirements:
 *   - Deterministic: same name + date always yields the same key.
 *   - Safe for re-enrichment: writing the same payload twice produces the
 *     same instanceId, so the claim is upserted, not duplicated.
 *   - Handles missing dates: uses 'unknown' as the date segment.
 *   - Does not use timestamps or random values.
 *
 * @internal — exported for testing only
 */
export function buildNameHistoryRowKey(
    name: string,
    effectiveFrom: string | null | undefined
): string {
    const normalisedName = (name || 'unknown')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')  // collapse special chars to underscores
        .replace(/_+/g, '_')          // collapse consecutive underscores
        .replace(/^_|_$/g, '');       // trim leading/trailing underscores
    const dateSegment = effectiveFrom
        ? String(effectiveFrom).replace(/[^0-9\-]/g, '')
        : 'unknown';
    return `name_${normalisedName}_${dateSegment}`;
}


/**
 * Apply a transform to a resolved value.
 * Never throws — returns degraded result on failure.
 */
export function applyTransform(
    value: any,
    transformType: TransformType,
    transformConfig?: any
): TransformResult {
    if (value == null) {
        return { value: null, confidencePenalty: 0 };
    }

    switch (transformType) {
        case 'DIRECT': {
            // Smart extraction to intuitively handle objects mapped to flat fields
            const extractPrimitive = (val: any): any => {
                if (val == null) return null;
                // If it's already a primitive, just stringify it
                if (typeof val !== 'object') return String(val);
                if (val instanceof Date) return val.toISOString();
                
                // If it's an object, look for common keys that usually hold the string value
                if (val.name !== undefined) return String(val.name);
                if (val.value !== undefined) return String(val.value);
                if (val.text !== undefined) return String(val.text);
                if (val.label !== undefined) return String(val.label);
                
                // If we can't find a common key, return the raw object and let the DB layer handle it (e.g. for JSONB fields)
                return val;
            };

            if (Array.isArray(value)) {
                // Preserve the array structure, but clean up the internal items
                const processed = value.map(extractPrimitive).filter(v => v !== null);
                return { value: processed, confidencePenalty: 0 };
            }
            
            return { value: extractPrimitive(value), confidencePenalty: 0 };
        }

        case 'DATE_TO_ISO': {
            try {
                const d = new Date(value);
                if (isNaN(d.getTime())) {
                    return { value: String(value), confidencePenalty: 0.5 };
                }
                return { value: d.toISOString().split('T')[0], confidencePenalty: 0 }; // YYYY-MM-DD
            } catch {
                return { value: String(value), confidencePenalty: 0.5 };
            }
        }

        case 'DATETIME_TO_ISO': {
            try {
                const d = new Date(value);
                if (isNaN(d.getTime())) {
                    return { value: String(value), confidencePenalty: 0.5 };
                }
                return { value: d.toISOString(), confidencePenalty: 0 };
            } catch {
                return { value: String(value), confidencePenalty: 0.5 };
            }
        }

        case 'COUNTRY_TO_NAME': {
            const code = String(value).trim();
            const resolved = resolveCountry(code);
            if (resolved) {
                return { value: resolved.name, confidencePenalty: 0 };
            }
            return { value: String(value), confidencePenalty: 0.2 }; // Pass original, slight penalty
        }

        case 'COUNTRY_TO_ISO2': {
            const input = String(value).trim();
            const resolved = resolveCountry(input);
            if (resolved) {
                return { value: resolved.code, confidencePenalty: 0 };
            }
            return { value: String(value), confidencePenalty: 0.2 };
        }

        case 'ENUM_MAP': {
            const map = transformConfig?.map;
            if (!map || typeof map !== 'object') {
                return { value: String(value), confidencePenalty: 0.3 };
            }
            const mapped = map[String(value)];
            if (mapped !== undefined) {
                return { value: String(mapped), confidencePenalty: 0 };
            }
            return { value: String(value), confidencePenalty: 0.3 }; // Not in map
        }

        case 'FIRST_ARRAY_ITEM': {
            if (!Array.isArray(value)) {
                return { value: null, confidencePenalty: 0 };
            }
            if (value.length === 0) {
                return { value: null, confidencePenalty: 0 };
            }
            return { value: String(value[0]), confidencePenalty: 0 };
        }

        case 'JOIN_ARRAY': {
            if (!Array.isArray(value)) {
                return { value: null, confidencePenalty: 0 };
            }
            const separator = transformConfig?.separator ?? ', ';
            return { value: value.join(separator), confidencePenalty: 0 };
        }

        case 'TO_ADDRESS_OBJECT': {
            if (typeof value !== 'object' || value === null) {
                return { value: null, confidencePenalty: 1 };
            }
            // Maps common fields from GLEIF/RA structures
            const addressDto = {
                line1: value.address_line_1 || value.addressLines?.[0] || value.premises || '',
                line2: value.address_line_2 || value.addressLines?.[1] || '',
                city: value.locality || value.city || '',
                region: value.region || '',
                postalCode: value.postal_code || value.postalCode || '',
                country: value.country || ''
            };
            // Clean up empty lines if any
            if (!addressDto.line1 && value.premises && value.address_line_1) {
                addressDto.line1 = `${value.premises} ${value.address_line_1}`.trim();
            }
            return { value: addressDto, confidencePenalty: 0 };
        }

        case 'TO_ADDRESS_VALUE': {
            if (typeof value !== 'object' || value === null) {
                return { value: null, confidencePenalty: 1 };
            }

            const paths = transformConfig || {};
            
            const resolve = (path: string | undefined): string | null => {
                if (!path) return null;
                
                const parts = path.split('.');
                let current = value;
                for (const part of parts) {
                    if (current == null || typeof current !== 'object') return null;
                    current = current[part];
                }
                
                if (Array.isArray(current)) {
                    return null; 
                }
                return current != null ? String(current) : null;
            };

            const linesPaths: string[] = Array.isArray(paths.addressLines) ? paths.addressLines : [];
            const addressLines: string[] = [];
            
            for (const p of linesPaths) {
                const parts = p.split('.');
                let current = value;
                for (const part of parts) {
                    if (current == null || typeof current !== 'object') break;
                    current = current[part];
                }
                if (Array.isArray(current)) {
                    addressLines.push(...current.map(String));
                } else if (current != null) {
                    addressLines.push(String(current));
                }
            }

            const addressValue: any = {
                addressLines,
                locality: resolve(paths.locality),
                region: resolve(paths.region),
                postalCode: resolve(paths.postalCode),
            };

            const rawCountryValue = resolve(paths.countryPath) || resolve(paths.countryCode);
            if (rawCountryValue) {
                const resolved = resolveCountry(rawCountryValue);
                if (resolved) {
                    addressValue.countryCode = resolved.code;
                    addressValue.countryName = resolved.name;
                    // Preserve rawCountry if the source provided something different from the code/name
                    if (rawCountryValue !== resolved.code && rawCountryValue !== resolved.name) {
                        addressValue.rawCountry = rawCountryValue;
                    } else {
                        // User specifically requested: If a source says "GB", store rawCountry="GB"
                        addressValue.rawCountry = rawCountryValue;
                    }
                } else {
                    addressValue.countryCode = null;
                    addressValue.countryName = null;
                    addressValue.rawCountry = rawCountryValue;
                }
            } else {
                addressValue.countryCode = null;
                addressValue.countryName = null;
                addressValue.rawCountry = null;
            }
            
            return { value: addressValue, confidencePenalty: 0 };
        }

        case 'TO_PARTY_OBJECT': {
            if (typeof value !== 'object' || value === null) {
                return { value: null, confidencePenalty: 1 };
            }

            const isCorporate = 
                value.kind?.includes('corporate') || 
                value.officer_role?.includes('corporate') ||
                value.identification?.identification_type?.includes('company') ||
                value.identification?.legal_form?.includes('Company');

            let extractedAddress = null;
            if (value.address) {
                extractedAddress = applyTransform(value.address, 'TO_ADDRESS_OBJECT').value;
            }

            if (isCorporate) {
                const leDto = {
                    metadata_type: 'LEGAL_ENTITY',
                    name: value.name || '',
                    registrationNumber: value.identification?.registration_number || value.company_number || '',
                    legalForm: value.identification?.legal_form || '',
                    address: extractedAddress
                };
                return { value: leDto, confidencePenalty: 0 };
            } else {
                // Human Person
                let firstName = '';
                let lastName = value.name || '';
                
                // Very basic split for "LASTNAME, Firstname" commonly used in Companies House
                if (lastName.includes(',')) {
                    const parts = lastName.split(',');
                    lastName = parts[0].trim();
                     // Capitalize properly
                    lastName = lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase();
                    firstName = parts.slice(1).join(',').trim();
                } else if (lastName.includes(' ')) {
                     const parts = lastName.split(' ');
                     lastName = parts.pop() || '';
                     firstName = parts.join(' ');
                }

                let dob = undefined;
                if (value.date_of_birth?.year && value.date_of_birth?.month) {
                    dob = new Date(value.date_of_birth.year, value.date_of_birth.month - 1, 1).toISOString();
                }

                const personDto = {
                    metadata_type: 'PERSON',
                    firstName,
                    lastName,
                    primaryNationality: value.nationality || '',
                    dateOfBirth: dob,
                    // Preserve raw source fields — stored on Person node, not as FieldClaims.
                    // officerRole is free-text from CH (e.g. "director", "secretary", "llp-member").
                    // May later migrate to edge attribute; kept here for MVP data preservation.
                    officerRole: value.officer_role || undefined,
                    occupation:  value.occupation  || undefined,
                    address: extractedAddress
                };
                return { value: personDto, confidencePenalty: 0 };
            }
        }

        case 'TO_PARTY_LIST': {
            if (!Array.isArray(value)) {
                return { value: null, confidencePenalty: 1 };
            }

            // ──────────────────────────────────────────────────────────────────
            // IMPORTANT: Do NOT filter out resigned/former officers here.
            //
            // A resignation is a temporal fact (effectiveTo), not a deletion.
            // The evaluation layer (KycStateService / COLLECTION_FIELD_CONFIG)
            // decides which relationships are "current" for a given field view.
            //
            // Tombstones are reserved for incorrect/invalid assertions only.
            // ──────────────────────────────────────────────────────────────────

            const rowKeys: string[] = [];
            const list = value
                .map((item: any, _idx: number) => {
                    const res = applyTransform(item, 'TO_PARTY_OBJECT');
                    if (res.value == null) {
                        rowKeys.push('');
                        return null;
                    }

                    // Temporal metadata from the registry payload
                    const appointedOn: string | null = item.appointed_on ?? null;
                    const resignedOn:  string | null = item.resigned_on  ?? null;

                    // Stable row key: deterministic within the LE context.
                    // Format: ch_{appointedOn}_{normalisedLastName}_{normalisedFirstInitial}
                    // The claim is already scoped to subjectLeId so company number
                    // is not required for uniqueness here.
                    const rowKey = buildDirectorRowKey(appointedOn, res.value);
                    rowKeys.push(rowKey);

                    return {
                        ...res.value,
                        // Preserve temporal facts for the write path
                        appointedOn,
                        resignedOn,
                        // Bubble up the row key so KycWriteService can use it
                        rowKey,
                    };
                })
                .filter((v: any) => v !== null);

            // Return both the enriched list and the parallel rowKeys array.
            // KycWriteService.applyFieldCandidate() reads candidate.rowKeys.
            return { value: list, confidencePenalty: 0, rowKeys };
        }

        case 'TO_NAME_HISTORY_LIST': {
            // ── Field 5: Previous Names ───────────────────────────────────────
            // Handles two source shapes:
            //
            // Companies House — previous_company_names[]:
            //   { name, ceased_on, effective_from }
            //
            // GLEIF — entity.otherNames[] or similar:
            //   { name } or just a string
            //
            // Both are normalised to:
            //   { name, effectiveFrom?, effectiveTo?, nameType?, rowKey }
            //
            // Tolerant: missing fields degrade gracefully, never throw.
            // ─────────────────────────────────────────────────────────────────
            if (!Array.isArray(value)) {
                // Single object or string — wrap in array and re-apply
                const wrapped = typeof value === 'string' ? [{ name: value }] : [value];
                return applyTransform(wrapped, 'TO_NAME_HISTORY_LIST', transformConfig);
            }

            const rowKeys: string[] = [];
            const list = value
                .map((item: any) => {
                    // Normalise item to a string name + optional date fields
                    let name: string;
                    let effectiveFrom: string | null = null;
                    let effectiveTo:   string | null = null;
                    let nameType:      string | null = null;

                    if (typeof item === 'string') {
                        name = item.trim();
                    } else if (item && typeof item === 'object') {
                        // CH shape: { name, effective_from, ceased_on }
                        // GLEIF shape: { name, type } or { name }
                        name = String(item.name || item.value || '').trim();
                        // Companies House
                        effectiveFrom = item.effective_from ?? item.effectiveFrom ?? null;
                        effectiveTo   = item.ceased_on     ?? item.effectiveTo    ?? null;
                        nameType      = item.type          ?? item.nameType       ?? null;
                    } else {
                        return null; // skip nulls / unexpected types
                    }

                    if (!name) return null; // minimum valid row: name required

                    const rowKey = buildNameHistoryRowKey(name, effectiveFrom);
                    rowKeys.push(rowKey);

                    return {
                        name,
                        effectiveFrom: effectiveFrom || undefined,
                        effectiveTo:   effectiveTo   || undefined,
                        nameType:      nameType       || undefined,
                        rowKey,
                    };
                })
                .filter((v: any) => v !== null);

            return { value: list, confidencePenalty: 0, rowKeys };
        }

        case 'TO_CODE_LIST': {
            // ── Field 20: Industry classification (SIC codes) ─────────────────
            // Handles two source shapes:
            //
            //   Raw CH payload — sic_codes[]:  ["35110", "70100"]
            //   Pre-enriched canonical —       [{ code, description }]
            //
            // Both are normalised to:
            //   { code: string, label: string | null }
            //
            // transformConfig: { codeSystem?: "SIC_2007_UK" | ... }
            //   Defaults to "SIC_2007_UK".  Future registries (NAF_FR, WZ_DE)
            //   set a different codeSystem; add a dispatch branch below when needed.
            //
            // Failures degrade gracefully:
            //   - Unknown codes  → label: null  (code always preserved)
            //   - Non-array input → null with full confidence penalty
            // ─────────────────────────────────────────────────────────────────
            if (!Array.isArray(value)) {
                return { value: null, confidencePenalty: 1 };
            }

            const codeSystem: string = transformConfig?.codeSystem ?? 'SIC_2007_UK';
            const rowKeys: string[] = [];

            const list = value
                .map((item: any) => {
                    let code: string;

                    if (typeof item === 'string') {
                        code = item.trim();
                    } else if (item && typeof item === 'object') {
                        // Already-enriched shape: { code, description } or { code, label }
                        code = String(item.code ?? item.value ?? '').trim();
                    } else {
                        return null; // skip nulls / unexpected types
                    }

                    if (!code) return null;

                    // Label lookup — codeSystem-dispatched.
                    // Only SIC_2007_UK is supported today; extend here when adding
                    // a second code system (e.g. NAF_FR).
                    let label: string | null;
                    if (codeSystem === 'SIC_2007_UK') {
                        label = SicCodeMapper.getDescription(code) ?? null;
                    } else {
                        // Future: dispatch to other mapper(s)
                        label = null;
                    }

                    // Stable rowKey: deterministic across re-enrichment runs.
                    // Format: sic_{code}  (e.g. sic_35110)
                    rowKeys.push(`sic_${code}`);

                    return { code, label };
                })
                .filter((v: any) => v !== null);

            return { value: list, confidencePenalty: 0, rowKeys };
        }

        case 'RA_CODE_TO_NAME': {
            // Extract the bare RA code from either a string or { id, other } object
            let code: string;
            if (typeof value === 'object' && value !== null) {
                code = String(value.id ?? value.code ?? '').trim();
            } else {
                code = String(value).trim();
            }

            if (!code) {
                return { value: null, confidencePenalty: 0 };
            }

            // Look up the name from the pre-loaded map injected by the caller.
            // transformConfig.raNameLookup is a Record<string, string> (raId → name).
            const lookup: Record<string, string> | undefined = transformConfig?.raNameLookup;
            const name = lookup?.[code];

            if (name) {
                return { value: name, confidencePenalty: 0 };
            }

            // Unknown code — pass through the raw code with a small confidence penalty.
            // This ensures the field is populated even if registry_authorities is stale,
            // and makes the gap visible to operators via the confidence score.
            return { value: code, confidencePenalty: 0.1 };
        }

        case 'TO_PARTY_VALUE':
        case 'TO_PERSON_OR_CONTACT_VALUE': {
            // ── Single PARTY object ──────────────────────────────────────────────
            // Converts one source object → PartyValue (PARTY appDataType).
            // Stored in FieldClaim.valueJson. No graph node or edge is created.
            //
            // Uses an inline dot-path resolver (matching TO_ADDRESS_VALUE pattern)
            // so this file stays self-contained with no new imports.
            // ─────────────────────────────────────────────────────────────────────
            if (value == null || typeof value !== 'object' || Array.isArray(value)) {
                return { value: null, confidencePenalty: 1 };
            }

            const cfg = transformConfig || {};
            let confidencePenalty = 0;

            // Inline dot-path resolver — mirrors TO_ADDRESS_VALUE pattern
            const resolveP = (path: string | undefined, src: any = value): any => {
                if (!path) return null;
                const parts = path.split('.');
                let cur = src;
                for (const part of parts) {
                    if (cur == null || typeof cur !== 'object') return null;
                    cur = cur[part];
                }
                return cur ?? null;
            };

            // ── Contact type ──────────────────────────────────────────────────
            let contactType: 'PERSON' | 'CONTACT' = cfg.defaultContactType || 'PERSON';
            if (cfg.contactTypePath) {
                const raw = resolveP(cfg.contactTypePath);
                if (raw && cfg.contactTypeMap && cfg.contactTypeMap[raw]) {
                    contactType = cfg.contactTypeMap[raw];
                }
            }

            // ── Name parsing ──────────────────────────────────────────────────
            let forenames: string | null = null;
            let surname:   string | null = null;
            let title: string | null = null;

            if (cfg.titlePath) {
                const raw = resolveP(cfg.titlePath);
                title = raw ? String(raw).trim() || null : null;
            }

            if (cfg.fullNamePath) {
                // Comma-split parser — handles CH format "SMITH, John Robert"
                const raw = resolveP(cfg.fullNamePath);
                const rawStr = raw ? String(raw).trim() : '';
                if (rawStr) {
                    if (rawStr.includes(',')) {
                        const commaIdx = rawStr.indexOf(',');
                        const rawSurname   = rawStr.slice(0, commaIdx).trim();
                        const rawForenames = rawStr.slice(commaIdx + 1).trim();
                        // Title-case the surname (CH sends it in ALL CAPS)
                        surname   = rawSurname.charAt(0).toUpperCase() +
                                    rawSurname.slice(1).toLowerCase();
                        forenames = rawForenames || null;
                    } else if (rawStr.includes(' ')) {
                        // No comma — last token = surname, rest = forenames
                        const tokens = rawStr.split(/\s+/);
                        surname   = tokens.pop() || null;
                        forenames = tokens.join(' ') || null;
                    } else {
                        // Single token — treat as surname
                        surname   = rawStr;
                        forenames = null;
                    }
                    confidencePenalty = Math.max(confidencePenalty, 0.05); // heuristic parse
                }
            } else {
                // Pre-split name paths
                if (cfg.forenamesPath) {
                    const raw = resolveP(cfg.forenamesPath);
                    forenames = raw ? String(raw).trim() || null : null;
                }
                if (cfg.surnamePath) {
                    const raw = resolveP(cfg.surnamePath);
                    surname = raw ? String(raw).trim() || null : null;
                }
            }

            // Legacy fallback: If mapping used displayNamePath (e.g. for a team/contact),
            // we map it into forenames if forenames is not already set.
            if (cfg.displayNamePath) {
                const raw = resolveP(cfg.displayNamePath);
                if (raw) forenames = String(raw).trim() || forenames;
            }

            // ── Contact ───────────────────────────────────────────────────────
            let email: string | null = null;
            if (cfg.emailPath) {
                const raw = resolveP(cfg.emailPath);
                email = raw ? String(raw).trim() || null : null;
            }

            // Phones — populated via static config or future extension
            const phones: { type: 'LANDLINE' | 'MOBILE' | 'OTHER'; number: string }[] = [];

            // ── Nationality ───────────────────────────────────────────────────
            let nationality: string[] = [];
            if (cfg.nationalityPath) {
                const raw = resolveP(cfg.nationalityPath);
                if (Array.isArray(raw)) {
                    nationality = raw.map((n: any) => String(n).trim()).filter(Boolean);
                } else if (raw) {
                    nationality = [String(raw).trim()].filter(Boolean);
                }
            }

            let countryOfResidence: string | null = null;
            if (cfg.countryOfResidencePath) {
                const raw = resolveP(cfg.countryOfResidencePath);
                countryOfResidence = raw ? String(raw).trim() || null : null;
            }

            // ── Date of Birth — partial (day: null, NEVER defaulted to 1) ─────
            let dateOfBirth: { year: number | null; month: number | null; day: number | null } | null = null;
            const dobYear  = cfg.dobYearPath  ? resolveP(cfg.dobYearPath)  : null;
            const dobMonth = cfg.dobMonthPath ? resolveP(cfg.dobMonthPath) : null;
            const dobDay   = cfg.dobDayPath   ? resolveP(cfg.dobDayPath)   : null;
            if (dobYear != null || dobMonth != null) {
                dateOfBirth = {
                    year:  dobYear  != null ? Number(dobYear)  : null,
                    month: dobMonth != null ? Number(dobMonth) : null,
                    day:   dobDay   != null ? Number(dobDay)   : null,   // null, never 1
                };
            }

            let placeOfBirth: string | null = null;
            if (cfg.placeOfBirthPath) {
                const raw = resolveP(cfg.placeOfBirthPath);
                placeOfBirth = raw ? String(raw).trim() || null : null;
            }

            // ── Role ─────────────────────────────────────────────────────────
            const roles: any[] = [];
            const roleTitleRaw = cfg.roleTitlePath ? resolveP(cfg.roleTitlePath) : null;
            const roleTypeRaw  = cfg.roleTypePath  ? resolveP(cfg.roleTypePath)  : null;

            const mapRoleType = (raw: string | null): any => {
                if (!raw) return null;
                // If a map is provided, try to use it; otherwise, return the raw value
                return (cfg.roleTypeMap && cfg.roleTypeMap[raw]) ? cfg.roleTypeMap[raw] : raw;
            };

            const appointedOnRaw = cfg.appointedOnPath ? resolveP(cfg.appointedOnPath) : null;
            const resignedOnRaw  = cfg.resignedOnPath  ? resolveP(cfg.resignedOnPath)  : null;

            // INVARIANT: isActiveRole is derived from role dates only.
            // NEVER copied into isActivePersonOrContact.
            const isActiveRole = (appointedOnRaw !== undefined && appointedOnRaw !== null)
                ? (resignedOnRaw == null)
                : null;

            let natureOfControl: string[] = [];
            if (cfg.natureOfControlPath) {
                const raw = resolveP(cfg.natureOfControlPath);
                if (Array.isArray(raw)) {
                    natureOfControl = raw.map((n: any) => String(n).trim()).filter(Boolean);
                } else if (raw) {
                    natureOfControl = [String(raw).trim()].filter(Boolean);
                }
            }

            if (roleTitleRaw || roleTypeRaw || appointedOnRaw || natureOfControl.length > 0) {
                roles.push({
                    roleTitle: roleTitleRaw ? String(roleTitleRaw).trim() : null,
                    roleType:  mapRoleType(roleTitleRaw ? String(roleTitleRaw) : null) ??
                               mapRoleType(roleTypeRaw  ? String(roleTypeRaw)  : null),
                    company: {
                        coparityCompanyId: null,
                        externalId:        null,
                        externalIdScheme:  null,
                        name:              null,
                    },
                    isActiveRole,
                    appointedOn: appointedOnRaw ? String(appointedOnRaw) : null,
                    resignedOn:  resignedOnRaw  ? String(resignedOnRaw)  : null,
                    natureOfControl,
                });
            }

            // ── Source identifiers ────────────────────────────────────────────
            const sourceIdentifiers: { scheme: string; value: string }[] = [];
            if (Array.isArray(cfg.sourceIdentifiers)) {
                for (const si of cfg.sourceIdentifiers) {
                    const id = resolveP(si.valuePath);
                    if (id != null) {
                        sourceIdentifiers.push({ scheme: si.scheme, value: String(id) });
                    }
                }
            }

            // ── Address ───────────────────────────────────────────────────────
            let correspondenceAddress: any = null;
            if (cfg.correspondenceAddressPath) {
                const rawAddr = resolveP(cfg.correspondenceAddressPath);
                if (rawAddr) {
                    const res = applyTransform(rawAddr, 'TO_ADDRESS_VALUE', cfg.correspondenceAddressConfig);
                    if (res.value) correspondenceAddress = res.value;
                }
            } else if (value.address) {
                // Fallback for raw Companies House officer shape
                const res = applyTransform(value.address, 'TO_ADDRESS_VALUE', {
                    addressLines: ['premises', 'address_line_1', 'address_line_2'],
                    locality: 'locality',
                    region: 'region',
                    postalCode: 'postal_code',
                    countryPath: 'country'
                });
                if (res.value) correspondenceAddress = res.value;
            }

            // ── Assemble PersonOrContactValue ─────────────────────────────────
            // INVARIANT: isActivePersonOrContact is ALWAYS null from automated transforms.
            // It must NEVER be derived from role.isActiveRole or any registry status.
            // Only USER_INPUT may set true/false.
            const poc = {
                contactType,
                title:                   title || null,
                forenames:               forenames || null,
                surname:                 surname || null,
                email,
                phones,
                nationality,
                countryOfResidence,
                dateOfBirth,
                placeOfBirth,
                roles,
                sourceIdentifiers,
                correspondenceAddress,
                isActiveParty:           null,
                isActivePersonOrContact: null,   // INVARIANT — never derived from role status
                visibility:              { scope: 'CLIENT_LE' as const },
            };

            if (!isValidPartyValue(poc)) {
                return { value: null, confidencePenalty: 1 };
            }

            return { value: poc, confidencePenalty };
        }

        case 'TO_PARTY_VALUE_LIST':
        case 'TO_PERSON_OR_CONTACT_LIST': {
            // ── Array fan-out → multiple PARTY claims ────────────────────────────
            // Mirrors TO_PARTY_LIST / applyFieldCandidate contract exactly.
            //
            // CONTRACT:
            //   Returns { value: PartyValue[], rowKeys: string[] }
            //   The array IS the top-level value — NEVER embedded inside valueJson.
            //   Each item becomes a SEPARATE FieldClaim via applyFieldCandidate fan-out.
            //   No changes to RegistryMappingEngine or applyFieldCandidate() needed.
            // ─────────────────────────────────────────────────────────────────────
            if (!Array.isArray(value)) {
                return { value: null, confidencePenalty: 1 };
            }

            const cfg2 = transformConfig || {};

            // Inline resolver for list items
            const resolveFromItem = (path: string | undefined, src: any): any => {
                if (!path) return null;
                const parts = path.split('.');
                let cur = src;
                for (const part of parts) {
                    if (cur == null || typeof cur !== 'object') return null;
                    cur = cur[part];
                }
                return cur ?? null;
            };

            const rowKeys: string[] = [];
            const list = value
                .map((item: any) => {
                    const res = applyTransform(item, 'TO_PARTY_VALUE', transformConfig);
                    if (res.value == null) { rowKeys.push(''); return null; }

                    // Resolve temporal metadata per item for FieldClaim.effectiveFrom/effectiveTo
                    const appointedOn: string | null =
                        (cfg2.appointedOnPath ? resolveFromItem(cfg2.appointedOnPath, item) : null) ??
                        item.appointed_on ?? item.notified_on ?? null;
                    const resignedOn: string | null =
                        (cfg2.resignedOnPath ? resolveFromItem(cfg2.resignedOnPath, item) : null) ??
                        item.resigned_on ?? item.ceased_on ?? null;

                    const rowKey = buildPersonOrContactRowKey(appointedOn, res.value);
                    rowKeys.push(rowKey);

                    // We add rowKey to the item temporarily so KycWriteService can use it,
                    // but we will strip appointedOn and resignedOn from the top level
                    // because they belong in roles[0].
                    return {
                        ...res.value,
                        rowKey,
                    };
                })
                .filter((v: any) => v !== null);

            return { value: list, confidencePenalty: 0, rowKeys };
        }

        case 'TO_COMPANIES_HOUSE_ACTIVE_DIRECTOR_PARTY_VALUE_LIST': {
            // First, get all party values from the standard fan-out
            const res = applyTransform(value, 'TO_PARTY_VALUE_LIST', transformConfig);
            if (!Array.isArray(res.value)) {
                return res;
            }

            // Filter down to only active directors
            const activeList: any[] = [];
            const activeRowKeys: string[] = [];
            
            res.value.forEach((party, idx) => {
                if (party && typeof party === 'object') {
                    const roles = Array.isArray(party.roles) ? party.roles : [];
                    const hasActiveDirector = roles.some((r: any) => {
                        const isDirector = String(r.roleType || r.roleTitle || '').toLowerCase().includes('director');
                        const isActive = r.isActiveRole !== false;
                        const noResignedDate = !r.resignedOn && !r.ceasedOn;
                        return isDirector && isActive && noResignedDate;
                    });

                    if (hasActiveDirector) {
                        activeList.push(party);
                        if (res.rowKeys && res.rowKeys[idx] !== undefined) {
                            activeRowKeys.push(res.rowKeys[idx]);
                        }
                    }
                }
            });

            return { value: activeList, confidencePenalty: res.confidencePenalty, rowKeys: activeRowKeys };
        }

        default:
            return { value: String(value), confidencePenalty: 0 };
    }
}
