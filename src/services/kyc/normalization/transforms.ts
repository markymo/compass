/**
 * transforms.ts
 *
 * Transform handlers for the table-driven normalizer.
 * Each transform has explicit input/output contracts.
 * Failures degrade confidence, never throw.
 */

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
};

type TransformType =
    | 'DIRECT'
    | 'DATE_TO_ISO'
    | 'DATETIME_TO_ISO'
    | 'COUNTRY_TO_NAME'
    | 'COUNTRY_TO_ISO2'
    | 'ENUM_MAP'
    | 'FIRST_ARRAY_ITEM'
    | 'JOIN_ARRAY';

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
        case 'DIRECT':
            return { value: String(value), confidencePenalty: 0 };

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

        default:
            return { value: String(value), confidencePenalty: 0 };
    }
}
