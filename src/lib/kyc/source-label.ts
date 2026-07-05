/**
 * source-label.ts
 *
 * Client-safe helpers for resolving human-readable source display labels.
 * 
 * NOTE: This is now a wrapper around getSourceDisplayName to ensure a Single Source
 * of Truth across the application. The raNameLookup parameter is deprecated
 * as RA names are mapped statically in source-display.ts.
 */

import { getSourceDisplayName } from '@/lib/source-display';

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * @deprecated Use static mappings in source-display.ts instead.
 */
export type RaNameLookup = Record<string, string>;

// ── Display helper ────────────────────────────────────────────────────────────

/**
 * Resolves a human-readable source label for a HydratedValue.
 * 
 * DEPRECATED APPROACH: Previously used a dynamic raNameLookup.
 * NEW APPROACH: Wraps getSourceDisplayName to guarantee consistency with the rest of the app.
 *
 * @param source          The internal source type string from HydratedValue.source
 * @param sourceReference The raw RA code from HydratedValue.sourceReference (optional)
 * @param raNameLookup    @deprecated No longer used.
 */
export function resolveSourceLabel(
    source: string | null | undefined,
    sourceReference?: string | null,
    raNameLookup?: RaNameLookup
): string {
    if (!source) return 'Master Record';
    
    // Explicit overrides to maintain exact legacy output for some cases during migration,
    // though getSourceDisplayName handles most of these naturally.
    if (source === 'MASTER_RECORD') return 'Master Record';
    if (source === 'USER_INPUT') return 'User Input';

    // Call the canonical Single Source of Truth
    return getSourceDisplayName(source, sourceReference);
}
