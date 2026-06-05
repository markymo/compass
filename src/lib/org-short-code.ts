/**
 * Short Code Generator — vowel elision approach
 *
 * Algorithm:
 *  1. Normalize (NFD, uppercase, alphanum only)
 *  2. Strip common noise words (Bank, Group, Ltd, etc.)
 *  3. Join remaining words → single string
 *  4. If ≤ 4 chars: pad with '0' to reach 5 (acronyms like ANZ, MUFG)
 *  5. Otherwise: drop interior vowels (keep first char always)
 *     - If result ≥ 5: take first 5
 *     - If result < 5: append trailing vowels from original until 5, then '0' pad
 *
 * Always returns exactly 5 characters: [A-Z0-9].
 * Includes a basic profanity check — if the code matches a known bad word,
 * the last character is replaced with '9'.
 */

const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);
const TARGET = 5;

const NOISE = new Set([
    'LIMITED', 'LTD', 'PLC', 'INC', 'LLC', 'CORP', 'CORPORATION',
    'GROUP', 'HOLDINGS', 'HOLDING', 'SERVICES', 'GLOBAL', 'INTERNATIONAL',
    'BANK', 'FINANCE', 'FINANCIAL', 'CAPITAL', 'PARTNERS', 'VENTURES',
    'FUND', 'TRUST', 'MANAGEMENT', 'ASSET', 'ASSETS', 'INVESTMENTS',
    'OF', 'THE', 'AND', 'FOR', 'DE', 'DEL', 'DU', 'LA', 'LE',
    'SYSTEM', 'SYSTEMS',
]);

// Basic blocklist — exact 5-char matches that should never appear
const PROFANITY = new Set([
    'BITCH', 'CUNTS', 'DICKS', 'FUCKS', 'PRICK', 'PUSSY', 'SHITS',
    'WANKS', 'PENIS', 'ARSED', 'COCKS', 'TWATS',
]);

// 4-letter substrings that must not appear anywhere in the code
const PROFANITY_SUB = ['FUCK', 'SHIT', 'CUNT', 'COCK', 'DICK', 'ARSE', 'WANK'];

function normalize(name: string): string {
    return name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')   // strip diacritics
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function elide(str: string): string {
    if (!str) return '';
    // Keep first char, drop interior vowels
    return str[0] + str.slice(1).replace(/[AEIOU]/g, '');
}

function isProfane(code: string): boolean {
    if (PROFANITY.has(code)) return true;
    return PROFANITY_SUB.some(w => code.includes(w));
}

function sanitize(code: string): string {
    return isProfane(code) ? code.slice(0, 4) + '9' : code;
}

export function generateShortCode(name: string): string {
    // Special case: CoParity always → COPAR
    if (name.toLowerCase().includes('coparity')) return 'COPAR';

    // Bracketed all-caps acronyms: (MUFG) → MUFG0, (CIBC) → CIBC0
    const bracketMatch = name.trim().match(/^\(([A-Z0-9]+)\)$/);
    if (bracketMatch) {
        return sanitize(bracketMatch[1].padEnd(TARGET, '0').slice(0, TARGET));
    }

    const upper = normalize(name);
    const allWords = upper.split(/\s+/).filter(Boolean);
    const meaningful = allWords.filter(w => !NOISE.has(w));
    const base = meaningful.length > 0 ? meaningful : allWords;
    // If stripping noise collapsed the name to a single 1-char token, use the full word list
    const effectiveBase = (base.length === 1 && base[0].length === 1) ? allWords : base;
    const joined = effectiveBase.join(''); // e.g. "BARCLAYS", "NATWEST", "ZZOOMM"

    // Very short joined string (acronyms) → just pad with zeros
    if (joined.length <= TARGET - 1) {
        return sanitize(joined.padEnd(TARGET, '0'));
    }

    // Apply vowel elision in-place
    const elided = elide(joined);

    if (elided.length >= TARGET) {
        return sanitize(elided.slice(0, TARGET));
    }

    // Elided is short — add trailing vowels from the original joined string
    const originalVowels = [...joined.slice(1)].filter(c => VOWELS.has(c));
    const needed = TARGET - elided.length;
    const filler = originalVowels.slice(-needed).join('');
    const result = (elided + filler).padEnd(TARGET, '0').slice(0, TARGET);

    return sanitize(result);
}

/**
 * Given a desired code and a set of already-used codes, returns a unique variant.
 * Tries several strategies before falling back to numeric suffix.
 */
export function makeUnique(desired: string, used: Set<string>): string {
    if (!used.has(desired)) return desired;

    // Strategy 1: replace last char with digits 1-9
    for (let i = 1; i <= 9; i++) {
        const c = desired.slice(0, 4) + i;
        if (!used.has(c)) return c;
    }

    // Strategy 2: replace last 2 chars with 10-99
    for (let i = 10; i <= 99; i++) {
        const c = desired.slice(0, 3) + i;
        if (!used.has(c)) return c;
    }

    throw new Error(`Cannot find unique code for base "${desired}"`);
}
