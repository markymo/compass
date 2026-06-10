/**
 * source-label.ts
 *
 * Pure, client-safe helpers for resolving human-readable source display labels
 * from internal HydratedValue provenance fields.
 *
 * NO imports from @/lib/prisma or any server-only module.
 * The RA name map must be pre-fetched server-side (see source-label.server.ts)
 * and passed in as a plain Record<string, string> prop.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Map from RegistryAuthority.id (e.g. 'RA000585') to RegistryAuthority.name
 * (e.g. 'Companies House').
 *
 * Use Record<string, string> (not Map) so it is serialisable across the
 * Next.js server → client component prop boundary without conversion.
 */
export type RaNameLookup = Record<string, string>;

// ── Display helper ────────────────────────────────────────────────────────────

/**
 * Resolves a human-readable source label for a HydratedValue.
 *
 * Resolution order:
 *   1. USER_INPUT                                        → 'User Input'
 *   2. GLEIF / GLEIF_DIRECT                              → 'GLEIF'
 *   3. REGISTRATION_AUTHORITY + sourceReference in map   → e.g. 'Companies House'
 *   4. REGISTRATION_AUTHORITY + unknown / missing ref    → 'Registry'
 *   5. MASTER_RECORD                                     → 'Master Record'
 *   6. Any other non-null string                         → returned as-is (safe passthrough)
 *   7. null / undefined source                           → 'Master Record'
 *
 * @param source          The internal source type string from HydratedValue.source
 * @param sourceReference The raw RA code from HydratedValue.sourceReference (optional)
 * @param raNameLookup    Pre-fetched RA name map (optional — omit in tests that don't need it)
 */
export function resolveSourceLabel(
    source: string | null | undefined,
    sourceReference?: string | null,
    raNameLookup?: RaNameLookup
): string {
    if (!source) return 'Master Record';

    switch (source) {
        case 'USER_INPUT':
            return 'User Input';

        case 'GLEIF':
        case 'GLEIF_DIRECT':
            return 'GLEIF';

        case 'REGISTRATION_AUTHORITY':
            if (sourceReference && raNameLookup && raNameLookup[sourceReference]) {
                return raNameLookup[sourceReference];
            }
            return 'Registry';

        case 'MASTER_RECORD':
            return 'Master Record';

        default:
            // Unknown internal type — return as-is so nothing is silently swallowed.
            return source;
    }
}
