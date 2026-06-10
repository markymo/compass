/**
 * source-label.server.ts
 *
 * Server-only helper for pre-fetching the RA name lookup.
 * Safe to import only from Server Components, Server Actions, and API routes.
 *
 * DO NOT import this file from any "use client" module.
 */

import prisma from '@/lib/prisma';
import type { RaNameLookup } from './source-label';

export type { RaNameLookup } from './source-label';

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

    return Object.fromEntries(rows.map((r: { id: string; name: string }) => [r.id, r.name]));
}
