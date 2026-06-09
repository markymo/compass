/**
 * transforms.ts
 *
 * Transform handlers for the table-driven normalizer.
 * Each transform has explicit input/output contracts.
 * Failures degrade confidence, never throw.
 */

import { SicCodeMapper } from '@/domain/registry/utils/SicCodeMapper';

// ISO 3166-1 alpha-2 → English name (common subset)
const COUNTRY_CODES: Record<string, string> = {
    'AF': 'Afghanistan', 'AL': 'Albania', 'DZ': 'Algeria', 'AD': 'Andorra', 'AO': 'Angola',
    'AG': 'Antigua and Barbuda', 'AR': 'Argentina', 'AM': 'Armenia', 'AU': 'Australia', 'AT': 'Austria',
    'AZ': 'Azerbaijan', 'BS': 'Bahamas', 'BH': 'Bahrain', 'BD': 'Bangladesh', 'BB': 'Barbados',
    'BY': 'Belarus', 'BE': 'Belgium', 'BZ': 'Belize', 'BJ': 'Benin', 'BT': 'Bhutan',
    'BO': 'Bolivia', 'BA': 'Bosnia and Herzegovina', 'BW': 'Botswana', 'BR': 'Brazil', 'BN': 'Brunei',
    'BG': 'Bulgaria', 'BF': 'Burkina Faso', 'BI': 'Burundi', 'KH': 'Cambodia', 'CM': 'Cameroon',
    'CA': 'Canada', 'CF': 'Central African Republic', 'TD': 'Chad', 'CL': 'Chile', 'CN': 'China',
    'CO': 'Colombia', 'HR': 'Croatia', 'CU': 'Cuba', 'CY': 'Cyprus', 'CZ': 'Czech Republic',
    'DK': 'Denmark', 'DJ': 'Djibouti', 'DO': 'Dominican Republic', 'EC': 'Ecuador', 'EG': 'Egypt',
    'SV': 'El Salvador', 'EE': 'Estonia', 'ET': 'Ethiopia', 'FI': 'Finland', 'FR': 'France',
    'GA': 'Gabon', 'GM': 'Gambia', 'GE': 'Georgia', 'DE': 'Germany', 'GH': 'Ghana',
    'GR': 'Greece', 'GT': 'Guatemala', 'GN': 'Guinea', 'GY': 'Guyana', 'HT': 'Haiti',
    'HN': 'Honduras', 'HU': 'Hungary', 'IS': 'Iceland', 'IN': 'India', 'ID': 'Indonesia',
    'IR': 'Iran', 'IQ': 'Iraq', 'IE': 'Ireland', 'IL': 'Israel', 'IT': 'Italy',
    'JM': 'Jamaica', 'JP': 'Japan', 'JO': 'Jordan', 'KZ': 'Kazakhstan', 'KE': 'Kenya',
    'KW': 'Kuwait', 'KG': 'Kyrgyzstan', 'LA': 'Laos', 'LV': 'Latvia', 'LB': 'Lebanon',
    'LR': 'Liberia', 'LY': 'Libya', 'LI': 'Liechtenstein', 'LT': 'Lithuania', 'LU': 'Luxembourg',
    'MG': 'Madagascar', 'MY': 'Malaysia', 'ML': 'Mali', 'MT': 'Malta', 'MX': 'Mexico',
    'MD': 'Moldova', 'MC': 'Monaco', 'MN': 'Mongolia', 'ME': 'Montenegro', 'MA': 'Morocco',
    'MZ': 'Mozambique', 'MM': 'Myanmar', 'NA': 'Namibia', 'NP': 'Nepal', 'NL': 'Netherlands',
    'NZ': 'New Zealand', 'NI': 'Nicaragua', 'NE': 'Niger', 'NG': 'Nigeria', 'NO': 'Norway',
    'OM': 'Oman', 'PK': 'Pakistan', 'PA': 'Panama', 'PY': 'Paraguay', 'PE': 'Peru',
    'PH': 'Philippines', 'PL': 'Poland', 'PT': 'Portugal', 'QA': 'Qatar', 'RO': 'Romania',
    'RU': 'Russia', 'RW': 'Rwanda', 'SA': 'Saudi Arabia', 'SN': 'Senegal', 'RS': 'Serbia',
    'SG': 'Singapore', 'SK': 'Slovakia', 'SI': 'Slovenia', 'ZA': 'South Africa', 'KR': 'South Korea',
    'ES': 'Spain', 'LK': 'Sri Lanka', 'SD': 'Sudan', 'SE': 'Sweden', 'CH': 'Switzerland',
    'SY': 'Syria', 'TW': 'Taiwan', 'TJ': 'Tajikistan', 'TZ': 'Tanzania', 'TH': 'Thailand',
    'TG': 'Togo', 'TT': 'Trinidad and Tobago', 'TN': 'Tunisia', 'TR': 'Turkey', 'TM': 'Turkmenistan',
    'UG': 'Uganda', 'UA': 'Ukraine', 'AE': 'United Arab Emirates', 'GB': 'United Kingdom', 'US': 'United States',
    'UY': 'Uruguay', 'UZ': 'Uzbekistan', 'VE': 'Venezuela', 'VN': 'Vietnam', 'YE': 'Yemen',
    'ZM': 'Zambia', 'ZW': 'Zimbabwe',
    // Common variants
    'XK': 'Kosovo', 'HK': 'Hong Kong', 'MO': 'Macau', 'PS': 'Palestine',
};

// Reverse lookup: name → code
const COUNTRY_NAMES: Record<string, string> = {};
for (const [code, name] of Object.entries(COUNTRY_CODES)) {
    COUNTRY_NAMES[name.toUpperCase()] = code;
}

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
    | 'TO_PARTY_OBJECT'
    | 'TO_PARTY_LIST'
    | 'TO_NAME_HISTORY_LIST'
    | 'TO_CODE_LIST';


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
            const code = String(value).toUpperCase().trim();
            const name = COUNTRY_CODES[code];
            if (name) {
                return { value: name, confidencePenalty: 0 };
            }
            return { value: String(value), confidencePenalty: 0.2 }; // Pass original, slight penalty
        }

        case 'COUNTRY_TO_ISO2': {
            const input = String(value).toUpperCase().trim();
            // Already a 2-letter code?
            if (COUNTRY_CODES[input]) {
                return { value: input, confidencePenalty: 0 };
            }
            // Try name lookup
            const code = COUNTRY_NAMES[input];
            if (code) {
                return { value: code, confidencePenalty: 0 };
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

        default:
            return { value: String(value), confidencePenalty: 0 };
    }
}
