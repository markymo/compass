export const COUNTRY_CODES: Record<string, string> = {
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
    'XK': 'Kosovo', 'HK': 'Hong Kong', 'MO': 'Macau', 'PS': 'Palestine',
};

// Reverse lookup: Canonical Name -> Code
export const COUNTRY_NAMES: Record<string, string> = {};
for (const [code, name] of Object.entries(COUNTRY_CODES)) {
    COUNTRY_NAMES[name.toUpperCase()] = code;
}

// Synonyms mapped to their canonical ISO code
const SYNONYMS: Record<string, string> = {
    'UK': 'GB',
    'ENGLAND': 'GB',
    'WALES': 'GB',
    'SCOTLAND': 'GB',
    'NORTHERN IRELAND': 'GB',
    'GREAT BRITAIN': 'GB',
    'USA': 'US',
    'UNITED STATES OF AMERICA': 'US',
    'UAE': 'AE',
    // We can add more as needed
};

/**
 * Resolves a country string (code, name, or synonym) to its canonical code and name.
 */
export function resolveCountry(input: string | null | undefined): { code: string; name: string } | null {
    if (!input || typeof input !== 'string') return null;

    const cleanInput = input.trim().toUpperCase();
    if (!cleanInput) return null;

    // 1. Is it a valid 2-letter ISO code?
    if (COUNTRY_CODES[cleanInput]) {
        return {
            code: cleanInput,
            name: COUNTRY_CODES[cleanInput]
        };
    }

    // 2. Is it an exact match for a canonical name?
    if (COUNTRY_NAMES[cleanInput]) {
        return {
            code: COUNTRY_NAMES[cleanInput],
            name: COUNTRY_CODES[COUNTRY_NAMES[cleanInput]]
        };
    }

    // 3. Is it a known synonym?
    if (SYNONYMS[cleanInput]) {
        const code = SYNONYMS[cleanInput];
        return {
            code: code,
            name: COUNTRY_CODES[code]
        };
    }

    return null;
}
