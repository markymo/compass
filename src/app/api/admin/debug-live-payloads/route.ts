/**
 * DEBUG ENDPOINT — admin only
 * Hit this in production to diagnose live payload fetch failures:
 *   GET /api/admin/debug-live-payloads
 *
 * Returns a JSON summary of each registry fetch attempt including
 * HTTP status, response preview, and any errors.
 * Remove or gate behind feature flag once debugging is complete.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";

const COMPANIES_HOUSE_API_KEY = process.env.COMPANIES_HOUSE_API_KEY;
const GLEIF_LEI              = "213800SN8QHYGA7QUF79";
const CH_COMPANY_NO          = "14059418";
const FR_SIREN               = "542051180";

export async function GET() {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const results: Record<string, any> = {
        timestamp:           new Date().toISOString(),
        env: {
            COMPANIES_HOUSE_API_KEY: COMPANIES_HOUSE_API_KEY ? `set (${COMPANIES_HOUSE_API_KEY.length} chars)` : "MISSING",
            NODE_ENV:                process.env.NODE_ENV,
            VERCEL_ENV:              process.env.VERCEL_ENV ?? "(not Vercel)",
        },
    };

    // ── GLEIF ──────────────────────────────────────────────────────────────
    try {
        const r = await fetch(
            `https://api.gleif.org/api/v1/lei-records?filter[lei]=${GLEIF_LEI}`,
            { headers: { Accept: "application/vnd.api+json" }, signal: AbortSignal.timeout(15000) }
        );
        const body = await r.json();
        results.gleif = {
            status:    r.status,
            ok:        r.ok,
            entityName: body?.data?.[0]?.attributes?.entity?.legalName?.name ?? null,
            preview:   JSON.stringify(body).slice(0, 300),
        };
    } catch (e: any) {
        results.gleif = { error: String(e) };
    }

    // ── Companies House ────────────────────────────────────────────────────
    try {
        if (!COMPANIES_HOUSE_API_KEY) {
            results.ch = { error: "COMPANIES_HOUSE_API_KEY env var is not set" };
        } else {
            const auth64 = Buffer.from(COMPANIES_HOUSE_API_KEY + ":").toString("base64");
            const r = await fetch(
                `https://api.company-information.service.gov.uk/company/${CH_COMPANY_NO}`,
                { headers: { Authorization: `Basic ${auth64}` }, signal: AbortSignal.timeout(15000) }
            );
            const body = await r.json();
            results.ch = {
                status:      r.status,
                ok:          r.ok,
                company_name: body?.company_name ?? null,
                hasExpectedField: "company_name" in (body ?? {}),
                preview:     JSON.stringify(body).slice(0, 300),
            };
        }
    } catch (e: any) {
        results.ch = { error: String(e) };
    }

    // ── French Registry ────────────────────────────────────────────────────
    try {
        const r = await fetch(
            `https://recherche-entreprises.api.gouv.fr/search?q=${FR_SIREN}&page=1&per_page=1`,
            { headers: { Accept: "application/json", "User-Agent": "CoParity-Admin/1.0" }, signal: AbortSignal.timeout(15000) }
        );
        const body = await r.json();
        const first = body?.results?.[0];
        results.fr = {
            status:     r.status,
            ok:         r.ok,
            sirenMatch: first?.siren === FR_SIREN,
            returnedSiren: first?.siren ?? null,
            entityName: first?.nom_raison_sociale ?? first?.nom_complet ?? null,
            preview:    JSON.stringify(body).slice(0, 300),
        };
    } catch (e: any) {
        results.fr = { error: String(e) };
    }

    return NextResponse.json(results, { status: 200 });
}
