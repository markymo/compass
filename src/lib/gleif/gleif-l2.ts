/**
 * GLEIF Level 2 (L2) relationship fetcher.
 *
 * Fetches direct-parent, ultimate-parent, and direct-children count
 * for a given LEI. All calls are Promise.allSettled — any 404,
 * reporting-exception, or network error returns null/0 for that field
 * and NEVER propagates to the caller.
 */

import { resolveElfCode, ElfResolution } from "./elf-codes";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GleifL2Entity {
    lei: string;
    legalName: string;
    jurisdiction: string;
    legalFormId: string | null;
    registrationStatus: string;
    entityStatus: string;
    registeredAt: string | null;  // RA code e.g. "RA000585"
    registeredAs: string | null;  // Local registration number
}

export interface GleifL2Data {
    directParent: GleifL2Entity | null;
    ultimateParent: GleifL2Entity | null;
    fundManager: GleifL2Entity | null;
    umbrellaFund: GleifL2Entity | null;
    directParentException: string | null;
    ultimateParentException: string | null;
    directChildrenCount: number | null;
    ultimateChildrenCount: number | null;
    directChildren: GleifL2Entity[];
    ultimateChildren: GleifL2Entity[];
    fetchedAt: string;
}

export interface GleifElfData {
    id: string;
    name: string | null;
    jurisdictionCode?: string;
    fetchedAt: string;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

const GLEIF_API = "https://api.gleif.org/api/v1";
const GLEIF_HEADERS = { Accept: "application/vnd.api+json" };

/** Extract a compact entity summary from a full GLEIF lei-record data object. */
function extractCompact(record: any): GleifL2Entity | null {
    if (!record?.attributes) return null;
    const attr = record.attributes;
    const entity = attr.entity;
    const reg = attr.registration;
    if (!entity || !reg) return null;

    return {
        lei: attr.lei ?? record.id,
        legalName: entity.legalName?.name ?? "",
        jurisdiction: entity.jurisdiction ?? "",
        legalFormId: entity.legalForm?.id ?? null,
        registrationStatus: reg.status ?? "",
        entityStatus: entity.status ?? "",
        registeredAt: entity.registeredAt?.id ?? null,
        registeredAs: entity.registeredAs ?? null,
    };
}

/**
 * Try to fetch a relationship endpoint. Returns:
 *   - { entity } if a valid LEI record is returned
 *   - { exception } if GLEIF returns a reporting-exception
 *   - null if 404 / network error
 */
async function fetchRelationship(
    lei: string,
    relationship: "direct-parent" | "ultimate-parent" | "fund-manager" | "umbrella-fund"
): Promise<{ entity: GleifL2Entity | null; exception: string | null }> {
    try {
        const res = await fetch(`${GLEIF_API}/lei-records/${lei}/${relationship}`, {
            headers: GLEIF_HEADERS,
            next: { revalidate: 60 },
        });

        // 404 → no relationship declared
        if (res.status === 404) return { entity: null, exception: null };

        if (!res.ok) return { entity: null, exception: null };

        const json = await res.json();

        // Some entities declare a reporting exception instead of a parent record
        // In that case the response is wrapped differently; check for the exception endpoint link
        if (!json.data) {
            // Could be a reporting exception response  
            return { entity: null, exception: null };
        }

        const entity = extractCompact(json.data);
        return { entity, exception: null };

    } catch {
        return { entity: null, exception: null };
    }
}

/** Try to fetch the reporting exception reason for a relationship. */
async function fetchException(
    lei: string,
    relationship: "direct-parent" | "ultimate-parent"
): Promise<string | null> {
    try {
        const res = await fetch(
            `${GLEIF_API}/lei-records/${lei}/${relationship}-reporting-exception`,
            { headers: GLEIF_HEADERS, next: { revalidate: 60 } }
        );
        if (!res.ok) return null;
        const json = await res.json();
        // Reason is typically at data.attributes.exceptionReason or similar
        return json.data?.attributes?.exceptionReason ?? null;
    } catch {
        return null;
    }
}

/** Fetch the page-total and a limited list of children. */
async function fetchChildrenList(
    lei: string,
    relationship: "direct-children" | "ultimate-children"
): Promise<{ count: number | null; entities: GleifL2Entity[] }> {
    try {
        const res = await fetch(
            `${GLEIF_API}/lei-records/${lei}/${relationship}?page[size]=50`,
            { headers: GLEIF_HEADERS, next: { revalidate: 60 } }
        );
        if (!res.ok) return { count: null, entities: [] };
        
        const json = await res.json();
        const count = json.meta?.pagination?.total ?? null;
        
        const entities: GleifL2Entity[] = [];
        if (Array.isArray(json.data)) {
            for (const record of json.data) {
                const entity = extractCompact(record);
                if (entity) entities.push(entity);
            }
        }
        
        return { count, entities };
    } catch {
        return { count: null, entities: [] };
    }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch and normalise all L2 relationship data for a given LEI.
 * All failures are silenced — this NEVER throws.
 */
export async function fetchGleifL2(lei: string): Promise<GleifL2Data> {
    const fetchedAt = new Date().toISOString();

    console.log(`[GLEIF] Fetching Level 2 relationships for LEI: ${lei}`);

    // Fire all L2 requests in parallel — any failure silenced by allSettled
    const [dpResult, upResult, dcResult, ucResult, fmResult, ufResult] = await Promise.allSettled([
        fetchRelationship(lei, "direct-parent"),
        fetchRelationship(lei, "ultimate-parent"),
        fetchChildrenList(lei, "direct-children"),
        fetchChildrenList(lei, "ultimate-children"),
        fetchRelationship(lei, "fund-manager"),
        fetchRelationship(lei, "umbrella-fund"),
    ]);

    const dp = dpResult.status === "fulfilled" ? dpResult.value : { entity: null, exception: null };
    const up = upResult.status === "fulfilled" ? upResult.value : { entity: null, exception: null };
    const dc = dcResult.status === "fulfilled" ? dcResult.value : { count: null, entities: [] };
    const uc = ucResult.status === "fulfilled" ? ucResult.value : { count: null, entities: [] };
    const fm = fmResult.status === "fulfilled" ? fmResult.value : { entity: null, exception: null };
    const uf = ufResult.status === "fulfilled" ? ufResult.value : { entity: null, exception: null };

    console.log(`[GLEIF] L2 relationships fetched for LEI: ${lei} (DP: ${dp.entity ? 'yes' : 'no'}, UP: ${up.entity ? 'yes' : 'no'}, FM: ${fm.entity ? 'yes' : 'no'}, UF: ${uf.entity ? 'yes' : 'no'})`);

    // If direct parent returned no entity, check for reporting exception
    let directParentException: string | null = dp.exception;
    let ultimateParentException: string | null = up.exception;

    if (!dp.entity && !dp.exception) {
        const [exDp, exUp] = await Promise.allSettled([
            fetchException(lei, "direct-parent"),
            fetchException(lei, "ultimate-parent"),
        ]);
        directParentException = exDp.status === "fulfilled" ? exDp.value : null;
        ultimateParentException = exUp.status === "fulfilled" ? exUp.value : null;
    }

    return {
        directParent: dp.entity,
        ultimateParent: up.entity,
        fundManager: fm.entity,
        umbrellaFund: uf.entity,
        directParentException,
        ultimateParentException,
        directChildrenCount: dc.count,
        ultimateChildrenCount: uc.count,
        directChildren: dc.entities,
        ultimateChildren: uc.entities,
        fetchedAt,
    };
}

/**
 * Resolve the ELF legal form from a GLEIF attributes object.
 * Reads attributes.entity.legalForm.id and resolves via static map.
 * Never throws.
 */
export function resolveGleifElf(gleifAttributes: any): GleifElfData {
    const elfId: string | null = gleifAttributes?.entity?.legalForm?.id ?? null;
    const resolution: ElfResolution = resolveElfCode(elfId);
    return {
        id: resolution.id,
        name: resolution.name,
        jurisdictionCode: resolution.jurisdictionCode,
        fetchedAt: new Date().toISOString(),
    };
}
