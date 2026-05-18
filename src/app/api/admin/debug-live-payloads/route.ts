/**
 * DEBUG ENDPOINT — admin only
 * GET /api/admin/debug-live-payloads
 *
 * Tests live API connectivity AND queries the DB for the records that
 * the mapping workbench depends on. Use this to diagnose why CH/FR
 * source data is missing in production.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

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
        timestamp: new Date().toISOString(),
        env: {
            COMPANIES_HOUSE_API_KEY: COMPANIES_HOUSE_API_KEY ? `set (${COMPANIES_HOUSE_API_KEY.length} chars)` : "MISSING",
            NODE_ENV:   process.env.NODE_ENV,
            VERCEL_ENV: process.env.VERCEL_ENV ?? "(not Vercel)",
        },
    };

    // ── DB: source_sample_payloads ────────────────────────────────────────
    // These drive path discovery in the Source Column.
    // If missing for REGISTRATION_AUTHORITY, CH and FR will show 0 paths.
    try {
        const samples: Array<{ id: string; sourceType: string; label: string; isDefault: boolean }> =
            await prisma.sourceSamplePayload.findMany({
                select: { id: true, sourceType: true, label: true, isDefault: true, createdAt: true },
                orderBy: { createdAt: "desc" },
            }) as any;
        results.db_source_sample_payloads = {
            total: samples.length,
            rows: samples.map(s => ({ id: s.id, sourceType: s.sourceType, label: s.label, isDefault: s.isDefault })),
            hasGleif: samples.some(s => s.sourceType === "GLEIF" && s.isDefault),
            hasRegistrationAuthority: samples.some(s => s.sourceType === "REGISTRATION_AUTHORITY" && s.isDefault),
            WARNING: samples.filter(s => s.isDefault).length === 0
                ? "⚠️  NO DEFAULT SAMPLE PAYLOADS — source columns will have 0 paths"
                : null,
        };

    } catch (e: any) {
        results.db_source_sample_payloads = { error: String(e) };
    }

    // ── DB: source_field_mappings for CH and FR ────────────────────────────
    // These provide paths even if no sample payload exists.
    try {
        const chMappings = await prisma.sourceFieldMapping.findMany({
            where: { sourceType: "REGISTRATION_AUTHORITY", sourceReference: "RA000585" },
            select: { id: true, sourcePath: true, targetFieldNo: true, isActive: true },
        });
        const frMappings = await prisma.sourceFieldMapping.findMany({
            where: { sourceType: "REGISTRATION_AUTHORITY", sourceReference: "RA000192" },
            select: { id: true, sourcePath: true, targetFieldNo: true, isActive: true },
        });
        results.db_source_field_mappings = {
            ch_RA000585: {
                total:  chMappings.length,
                active: chMappings.filter((m: { isActive: boolean }) => m.isActive).length,
                paths:  chMappings.map((m: { sourcePath: string }) => m.sourcePath),
            },
            fr_RA000192: {
                total:  frMappings.length,
                active: frMappings.filter((m: { isActive: boolean }) => m.isActive).length,
                paths:  frMappings.map((m: { sourcePath: string }) => m.sourcePath),
            },
            WARNING: (chMappings.length === 0 && frMappings.length === 0)
                ? "⚠️  NO MAPPINGS for CH or FR — combined with no sample payloads = 0 paths visible"
                : null,
        };
    } catch (e: any) {
        results.db_source_field_mappings = { error: String(e) };
    }

    // ── DB: questionnaires ────────────────────────────────────────────────
    try {
        const allQ = await prisma.questionnaire.count({ where: { isDeleted: false } });
        const templateQ = await prisma.questionnaire.count({ where: { isDeleted: false, isTemplate: true } });
        const noEngagementQ = await prisma.questionnaire.count({ where: { isDeleted: false, fiEngagementId: null } });
        results.db_questionnaires = { total_non_deleted: allQ, isTemplate_true: templateQ, fiEngagementId_null: noEngagementQ };
    } catch (e: any) {
        results.db_questionnaires = { error: String(e) };
    }

    // ── Live API checks ────────────────────────────────────────────────────
    try {
        const r = await fetch(
            `https://api.gleif.org/api/v1/lei-records?filter[lei]=${GLEIF_LEI}`,
            { headers: { Accept: "application/vnd.api+json" }, signal: AbortSignal.timeout(15000), cache: "no-store" }
        );
        const body = await r.json();
        results.gleif = { status: r.status, ok: r.ok, entityName: body?.data?.[0]?.attributes?.entity?.legalName?.name ?? null };
    } catch (e: any) { results.gleif = { error: String(e) }; }

    try {
        if (!COMPANIES_HOUSE_API_KEY) {
            results.ch = { error: "COMPANIES_HOUSE_API_KEY env var not set" };
        } else {
            const auth64 = Buffer.from(COMPANIES_HOUSE_API_KEY + ":").toString("base64");
            const r = await fetch(
                `https://api.company-information.service.gov.uk/company/${CH_COMPANY_NO}`,
                { headers: { Authorization: `Basic ${auth64}` }, signal: AbortSignal.timeout(15000), cache: "no-store" }
            );
            const body = await r.json();
            results.ch = { status: r.status, ok: r.ok, company_name: body?.company_name ?? null };
        }
    } catch (e: any) { results.ch = { error: String(e) }; }

    try {
        const r = await fetch(
            `https://recherche-entreprises.api.gouv.fr/search?q=${FR_SIREN}&page=1&per_page=1`,
            { headers: { Accept: "application/json", "User-Agent": "CoParity-Admin/1.0" }, signal: AbortSignal.timeout(15000), cache: "no-store" }
        );
        const body = await r.json();
        const first = body?.results?.[0];
        results.fr = { status: r.status, ok: r.ok, sirenMatch: first?.siren === FR_SIREN, entityName: first?.nom_raison_sociale ?? null };
    } catch (e: any) { results.fr = { error: String(e) }; }

    return NextResponse.json(results, { status: 200 });
}
