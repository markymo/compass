#!/usr/bin/env tsx
/**
 * scripts/backfill-short-codes.ts
 *
 * Generates and saves short codes for all organisations that don't already have one.
 *
 * Usage:
 *   npx tsx scripts/backfill-short-codes.ts            # set codes for orgs with no code
 *   npx tsx scripts/backfill-short-codes.ts --dry-run  # preview without saving
 *   npx tsx scripts/backfill-short-codes.ts --overwrite # regenerate all codes
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const OVERWRITE = process.argv.includes("--overwrite");
const DRY_RUN   = process.argv.includes("--dry-run");

// ── Short-code generator ──────────────────────────────────────────────────────

function generateOrgShortCode(name: string): string {
    if (name.toLowerCase().includes("coparity")) return "COPARI";

    // Bracketed ALL-CAPS codes like "(MUFG)", "(RBC)"
    const allCapsBracket = name.trim().match(/^\(([A-Z0-9]{2,6})\)$/);
    if (allCapsBracket) return allCapsBracket[1];

    let upper = name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .replace(/[-_.]/g, " ")
        .replace(/[^A-Z0-9\s]/g, "")
        .trim();

    const NOISE = new Set([
        "LIMITED", "LTD", "PLC", "INC", "LLC", "CORP", "CORPORATION",
        "GROUP", "HOLDINGS", "HOLDING", "SERVICES", "GLOBAL", "INTERNATIONAL",
        "BANK", "FINANCE", "FINANCIAL", "CAPITAL", "PARTNERS", "VENTURES",
        "OF", "THE", "AND", "FOR", "DE", "DEL", "DU", "LA", "LE",
        "SYSTEM", "TEST",
    ]);

    const words = upper.split(/\s+/).filter(Boolean);
    const meaningful = words.filter(w => !NOISE.has(w));
    const base = meaningful.length > 0 ? meaningful : words;

    if (base.length === 1) {
        const w = base[0];
        if (w.length <= 6 && w.length >= 2) return w;
        if (w.length === 1) return upper.slice(0, 4);
        return w.slice(0, 4);
    }

    const acronym = base.map(w => w[0]).join("");
    if (acronym.length >= 4 && acronym.length <= 6) return acronym;
    if (acronym.length > 6) return acronym.slice(0, 4);

    // Pad short acronym with extra chars from first word
    const restLetters = base.slice(1).map(w => w[0]).join("");
    const charsNeeded = 4 - restLetters.length;
    const fromFirst   = base[0].slice(0, charsNeeded);
    return (fromFirst + restLetters).slice(0, 4);
}

// ── Collision resolution ──────────────────────────────────────────────────────

function makeUnique(desired: string, used: Set<string>): string {
    if (!used.has(desired)) return desired;
    for (let i = 2; i <= 9; i++) {
        const c = desired.slice(0, 5) + i;
        if (!used.has(c)) return c;
    }
    for (let i = 10; i <= 99; i++) {
        const c = desired.slice(0, 4) + i;
        if (!used.has(c)) return c;
    }
    throw new Error(`Cannot find unique code for "${desired}"`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    const orgs = await prisma.organization.findMany({
        select: { id: true, name: true, shortCode: true },
        orderBy: { name: "asc" },
    });

    console.log(`\nFound ${orgs.length} organisations. OVERWRITE=${OVERWRITE}  DRY_RUN=${DRY_RUN}\n`);

    const usedCodes = new Set<string>(
        orgs.filter(o => o.shortCode && !OVERWRITE).map(o => o.shortCode as string)
    );

    const updates: { id: string; name: string; newCode: string }[] = [];

    for (const org of orgs) {
        if (org.shortCode && !OVERWRITE) {
            console.log(`  KEEP  ${org.shortCode.padEnd(8)}← ${org.name}`);
            continue;
        }
        const raw  = generateOrgShortCode(org.name);
        const code = makeUnique(raw, usedCodes);
        usedCodes.add(code);
        updates.push({ id: org.id, name: org.name, newCode: code });
        const tag = OVERWRITE && org.shortCode ? "REGEN" : "SET  ";
        console.log(`  ${tag} ${code.padEnd(8)}← ${org.name}`);
    }

    if (updates.length === 0) {
        console.log("\nNothing to update.\n");
        return;
    }

    if (DRY_RUN) {
        console.log(`\nDRY-RUN: would update ${updates.length} organisations (no changes saved).\n`);
        return;
    }

    console.log(`\nSaving ${updates.length} short codes…`);
    await Promise.all(
        updates.map(u =>
            prisma.organization.update({ where: { id: u.id }, data: { shortCode: u.newCode } })
        )
    );
    console.log("Done ✓\n");
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
