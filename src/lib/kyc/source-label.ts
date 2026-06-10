/**
 * source-label.ts
 *
 * Pure helpers for resolving human-readable source display labels from
 * internal HydratedValue provenance fields.
 *
 * No DB calls here. The RA name map must be pre-fetched by the caller
 * (once per page render) and passed in.
 */

import prisma from '@/lib/prisma';

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

// ── RA name pre-fetch ─────────────────────────────────────────────────────────

/**
 * Fetches all active RegistryAuthority rows and returns a plain-object
 * name lookup suitable for passing as a Next.js server → client prop.
 *
 * Call once per page render / resolver invocation.
 * The table is small (~10–50 rows) — no caching required at this stage.
 *
 * Key:   RegistryAuthority.id     e.g. 'RA000585'
 * Value: RegistryAuthority.name   e.g. 'Companies House'
 */
export async function fetchRaNameLookup(): Promise<RaNameLookup> {
    const rows = await (prisma as any).registryAuthority.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
    }) as Array<{ id: string; name: string }>;

    return Object.fromEntries(rows.map(r => [r.id, r.name]));
}
