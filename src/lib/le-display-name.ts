/**
 * getLEDisplayName
 * ─────────────────
 * Returns the authoritative display name for a Legal Entity:
 *   1. GLEIF official legal name (verified, from the GLEIF API response)
 *   2. Fallback: the user-supplied nickname stored in ClientLE.name
 *
 * This logic is the single source of truth so it is consistent across
 * the dashboard, client page, LE header, breadcrumbs etc.
 */
export function getLEDisplayName(le: { name: string; gleifData?: any }): string {
    return le.gleifData?.attributes?.entity?.legalName?.name || le.name;
}
