"use server";

import { isSystemAdmin } from "@/actions/admin";
import {
    DEFAULT_GLEIF_LEI,
    DEFAULT_CH_COMPANY_NO,
    DEFAULT_FR_SIREN,
    WbEntitySearchResult,
} from "@/lib/mapping-workbench/demo-entity-defaults";

// Re-export types so callers can import from one place
export type { WbEntitySearchResult };

// ── GLEIF search ───────────────────────────────────────────────────────────

export async function searchGleifEntities(query: string): Promise<{
    success: boolean; results?: WbEntitySearchResult[]; error?: string;
}> {
    if (!await isSystemAdmin()) return { success: false, error: "Unauthorized" };
    const q = query.trim();
    if (q.length < 2) return { success: true, results: [] };

    try {
        // 20-char LEI → direct record lookup
        if (/^[A-Z0-9]{18,20}$/i.test(q.replace(/\s/g, ""))) {
            const r = await fetch(
                `https://api.gleif.org/api/v1/lei-records/${q.toUpperCase()}`,
                { headers: { Accept: "application/vnd.api+json" }, cache: "no-store", signal: AbortSignal.timeout(10000) }
            );
            if (!r.ok) return { success: false, error: `GLEIF API error ${r.status}` };
            const j = await r.json();
            const a = j.data?.attributes;
            if (!a) return { success: true, results: [] };
            return { success: true, results: [{
                id:     a.lei,
                name:   a.entity?.legalName?.name ?? a.lei,
                status: a.registration?.status,
                extra:  a.entity?.registeredAt?.id ?? "",
            }]};
        }

        // Name search — up to 10 results
        const r = await fetch(
            `https://api.gleif.org/api/v1/lei-records?filter[entity.legalName]=${encodeURIComponent(q)}&page[size]=10`,
            { headers: { Accept: "application/vnd.api+json" }, cache: "no-store", signal: AbortSignal.timeout(10000) }
        );
        if (!r.ok) return { success: false, error: `GLEIF search error ${r.status}` };
        const j = await r.json();
        const results: WbEntitySearchResult[] = (j.data ?? []).map((d: any) => ({
            id:     d.attributes?.lei ?? d.id,
            name:   d.attributes?.entity?.legalName?.name ?? d.id,
            status: d.attributes?.registration?.status,
            extra:  d.attributes?.entity?.registeredAt?.id ?? "",
        }));
        return { success: true, results };
    } catch (e: any) {
        return { success: false, error: String(e) };
    }
}

// ── Companies House search ─────────────────────────────────────────────────

export async function searchCHEntities(query: string): Promise<{
    success: boolean; results?: WbEntitySearchResult[]; error?: string;
}> {
    if (!await isSystemAdmin()) return { success: false, error: "Unauthorized" };
    const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
    if (!apiKey) return { success: false, error: "COMPANIES_HOUSE_API_KEY not configured" };

    const q = query.trim();
    if (q.length < 2) return { success: true, results: [] };

    const auth = `Basic ${Buffer.from(apiKey + ":").toString("base64")}`;

    try {
        // Pure numeric / short alphanumeric → treat as company number first
        if (/^[A-Z0-9]{6,8}$/i.test(q)) {
            const r = await fetch(
                `https://api.company-information.service.gov.uk/company/${q.toUpperCase()}`,
                { headers: { Authorization: auth }, cache: "no-store", signal: AbortSignal.timeout(10000) }
            );
            if (r.ok) {
                const j = await r.json();
                if (j.company_name) {
                    return { success: true, results: [{
                        id:     j.company_number,
                        name:   j.company_name,
                        status: j.company_status,
                        extra:  j.date_of_creation ?? "",
                    }]};
                }
            }
        }

        // Name / fallback search
        const r = await fetch(
            `https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(q)}&items_per_page=10`,
            { headers: { Authorization: auth }, cache: "no-store", signal: AbortSignal.timeout(10000) }
        );
        if (!r.ok) return { success: false, error: `CH API error ${r.status}` };
        const j = await r.json();
        const results: WbEntitySearchResult[] = (j.items ?? []).map((item: any) => ({
            id:     item.company_number,
            name:   item.title,
            status: item.company_status,
            extra:  item.date_of_creation ?? "",
        }));
        return { success: true, results };
    } catch (e: any) {
        return { success: false, error: String(e) };
    }
}

// ── French Registry search ─────────────────────────────────────────────────

export async function searchFREntities(query: string): Promise<{
    success: boolean; results?: WbEntitySearchResult[]; error?: string;
}> {
    if (!await isSystemAdmin()) return { success: false, error: "Unauthorized" };
    const q = query.trim();
    if (q.length < 2) return { success: true, results: [] };

    try {
        const r = await fetch(
            `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(q)}&page=1&per_page=10`,
            { headers: { Accept: "application/json", "User-Agent": "CoParity-Admin/1.0" }, cache: "no-store", signal: AbortSignal.timeout(10000) }
        );
        if (!r.ok) return { success: false, error: `FR API error ${r.status}` };
        const j = await r.json();
        const results: WbEntitySearchResult[] = (j.results ?? []).map((c: any) => ({
            id:     c.siren,
            name:   c.nom_raison_sociale ?? c.nom_complet ?? c.siren,
            status: c.etat_administratif === "A" ? "ACTIVE" : c.etat_administratif === "C" ? "CEASED" : c.etat_administratif,
            extra:  c.siege?.code_postal ?? "",
        }));
        return { success: true, results };
    } catch (e: any) {
        return { success: false, error: String(e) };
    }
}

// ── Refresh live payloads with custom entity IDs ───────────────────────────

export interface WbLiveEntityRef {
    sourceKey:  string;
    entityId:   string;
    entityName: string | null;
    ok:         boolean;
    error:      string | null;
}

export async function refreshWorkbenchLiveData(entities: {
    gleifLei?:   string;
    chCompanyNo?: string;
    frSiren?:    string;
}): Promise<{ refs: WbLiveEntityRef[]; payloads: Record<string, any> }> {
    if (!await isSystemAdmin()) return { refs: [], payloads: {} };

    const lei      = entities.gleifLei    ?? DEFAULT_GLEIF_LEI;
    const chNo     = entities.chCompanyNo ?? DEFAULT_CH_COMPANY_NO;
    const frSiren  = entities.frSiren     ?? DEFAULT_FR_SIREN;
    const apiKey   = process.env.COMPANIES_HOUSE_API_KEY;

    const [gleif, ch, fr] = await Promise.allSettled([
        fetch(`https://api.gleif.org/api/v1/lei-records?filter[lei]=${lei}`,
            { headers: { Accept: "application/vnd.api+json" }, cache: "no-store", signal: AbortSignal.timeout(30000) })
            .then(r => r.json()).then(j => j.data?.[0]?.attributes ?? null),

        apiKey ? (async () => {
            const auth = `Basic ${Buffer.from(apiKey + ":").toString("base64")}`;
            const r = await fetch(
                `https://api.company-information.service.gov.uk/company/${chNo}`,
                { headers: { Authorization: auth }, cache: "no-store", signal: AbortSignal.timeout(30000) }
            );
            const body = await r.json();
            return (body && "company_name" in body) ? body : null;
        })() : Promise.resolve(null),

        fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${frSiren}&page=1&per_page=1`,
            { headers: { Accept: "application/json", "User-Agent": "CoParity-Admin/1.0" }, cache: "no-store", signal: AbortSignal.timeout(30000) })
            .then(r => r.json())
            .then(d => {
                const c = d.results?.[0];
                if (!c || String(c.siren) !== String(frSiren)) return null;
                const siege = c.siege ?? {};
                return {
                    entityName: c.nom_raison_sociale ?? c.nom_complet ?? null,
                    entityStatus: c.etat_administratif ?? null,
                    incorporationDate: c.date_creation ?? null,
                    registeredAddress: { lines: [siege.adresse].filter(Boolean), city: siege.libelle_commune ?? null, country: "FR", postalCode: siege.code_postal ?? null },
                };
            }),
    ]);

    const gleifPayload = gleif.status === "fulfilled" ? gleif.value : null;
    const gleifErr     = gleif.status === "rejected"  ? String(gleif.reason) : null;
    const chRaw        = ch.status   === "fulfilled"  ? ch.value   : null;
    const chErr        = ch.status   === "rejected"   ? String(ch.reason)   : null;
    const chPayload    = (chRaw && typeof chRaw === "object" && "company_name" in chRaw) ? chRaw : null;
    const frPayload    = fr.status   === "fulfilled"  ? fr.value   : null;
    const frErr        = fr.status   === "rejected"   ? String(fr.reason)   : null;

    const refs: WbLiveEntityRef[] = [
        { sourceKey: "GLEIF",       entityId: lei,     entityName: (gleifPayload as any)?.entity?.legalName?.name ?? null, ok: !!gleifPayload, error: gleifErr },
        { sourceKey: "CH_RA000585", entityId: chNo,    entityName: (chPayload  as any)?.company_name ?? null,              ok: !!chPayload,    error: chErr ?? (chRaw && !chPayload ? "Unexpected CH response" : null) },
        { sourceKey: "FR_RA000192", entityId: frSiren, entityName: (frPayload  as any)?.entityName ?? null,                ok: !!frPayload,    error: frErr },
    ];

    const payloads: Record<string, any> = {
        "GLEIF":                           gleifPayload,
        "REGISTRATION_AUTHORITY:RA000585": chPayload,
        "REGISTRATION_AUTHORITY:RA000192": frPayload,
    };

    return { refs, payloads };
}
