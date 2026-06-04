/**
 * Generates a short code for an organisation name.
 *
 * Rules:
 *  - "CoParity" → always "COPARI" (6 chars, full name)
 *  - Bracketed codes like "(MUFG)", "(RBC)" → strip brackets, use directly (≤ 6)
 *  - "(Banorte)" style (mixed case in brackets) → treat as word, generate normally
 *  - Single remaining word → first 4 chars (up to 6 if already a short acronym)
 *  - Multi-word → first-letter acronym, padded to ≥ 4 from first word if needed
 *  - Always uppercase, alphanumeric only, max 6 chars
 */
export function generateOrgShortCode(name: string): string {
    // Special case: CoParity is always full-length (6)
    if (name.toLowerCase().includes("coparity")) return "COPARI";

    // Bracketed ALL-CAPS codes like "(MUFG)", "(RBC)", "(CIBC)" → use directly
    const allCapsBracket = name.trim().match(/^\(([A-Z0-9]{2,6})\)$/);
    if (allCapsBracket) return allCapsBracket[1];

    // Normalise: fold accented chars, uppercase, replace hyphens/dots/dashes with space,
    // strip anything that isn't alphanumeric or space
    let upper = name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")   // strip combining diacritics
        .toUpperCase()
        .replace(/[-_.]/g, " ")
        .replace(/[^A-Z0-9\s]/g, "")
        .trim();

    // Remove common noise suffixes and filler words
    const NOISE = new Set([
        "LIMITED", "LTD", "PLC", "INC", "LLC", "CORP", "CORPORATION",
        "GROUP", "HOLDINGS", "HOLDING", "SERVICES", "GLOBAL", "INTERNATIONAL",
        "BANK", "FINANCE", "FINANCIAL", "CAPITAL", "PARTNERS", "VENTURES",
        "OF", "THE", "AND", "FOR", "DE", "DEL", "DU", "LA", "LE",
        "SYSTEM", "TEST",
    ]);

    const words = upper.split(/\s+/).filter(Boolean);
    const meaningful = words.filter(w => !NOISE.has(w));
    // Fall back to full word list if everything stripped
    const base = meaningful.length > 0 ? meaningful : words;

    // Single word that's already a short code (≤ 6 all-caps alphanumeric)
    if (base.length === 1) {
        const w = base[0];
        if (w.length <= 6 && w.length >= 2) return w; // keep as-is if short enough
        if (w.length === 1) return upper.replace(/\s/g, "").slice(0, 4); // single-letter base — use raw, no spaces
        return w.slice(0, 4);                          // take first 4 of long words
    }

    // Multi-word: build acronym from first letters
    const acronym = base.map(w => w[0]).join("");

    if (acronym.length >= 4 && acronym.length <= 6) return acronym;

    if (acronym.length > 6) return acronym.slice(0, 4);

    // Acronym is < 4 letters → pad by pulling extra chars from the first word
    const restLetters = base.slice(1).map(w => w[0]).join(""); // first letters of remaining words
    const charsNeeded = 4 - restLetters.length;
    const fromFirst   = base[0].slice(0, charsNeeded);         // take N chars from first word
    const padded      = fromFirst + restLetters;
    return padded.slice(0, 4);
}
