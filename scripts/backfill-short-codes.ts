#!/usr/bin/env tsx
/**
 * scripts/backfill-short-codes.ts
 *
 * Generates and saves 5-char vowel-elision short codes for all
 * Organisation and ClientLE rows that don't already have one.
 *
 * Usage:
 *   npx tsx scripts/backfill-short-codes.ts              # fill missing codes
 *   npx tsx scripts/backfill-short-codes.ts --dry-run    # preview only
 *   npx tsx scripts/backfill-short-codes.ts --overwrite  # regenerate all
 *
 * DATABASE_URL env var controls which DB is used. Override inline:
 *   DATABASE_URL='postgres://...' npx tsx scripts/backfill-short-codes.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const OVERWRITE = process.argv.includes('--overwrite');
const DRY_RUN   = process.argv.includes('--dry-run');
const TARGET    = 5;

// ── Generator (mirrors src/lib/org-short-code.ts) ────────────────────────────

const VOWELS = new Set(['A','E','I','O','U']);

const NOISE = new Set([
    'LIMITED','LTD','PLC','INC','LLC','CORP','CORPORATION',
    'GROUP','HOLDINGS','HOLDING','SERVICES','GLOBAL','INTERNATIONAL',
    'BANK','FINANCE','FINANCIAL','CAPITAL','PARTNERS','VENTURES',
    'FUND','TRUST','MANAGEMENT','ASSET','ASSETS','INVESTMENTS',
    'OF','THE','AND','FOR','DE','DEL','DU','LA','LE',
    'SYSTEM','SYSTEMS',
]);

const PROFANITY = new Set([
    'BITCH','CUNTS','DICKS','FUCKS','PRICK','PUSSY','SHITS',
    'WANKS','PENIS','ARSED','COCKS','TWATS',
]);

const PROFANITY_SUB = ['FUCK','SHIT','CUNT','COCK','DICK','ARSE','WANK'];

function normalize(name: string): string {
    return name.normalize('NFD').replace(/[\u0300-\u036f]/g,'')
        .toUpperCase().replace(/[^A-Z0-9]/g,' ').replace(/\s+/g,' ').trim();
}

function isProfane(code: string): boolean {
    if (PROFANITY.has(code)) return true;
    return PROFANITY_SUB.some(w => code.includes(w));
}

function sanitize(code: string): string {
    return isProfane(code) ? code.slice(0,4) + '9' : code;
}

function generateShortCode(name: string): string {
    if (name.toLowerCase().includes('coparity')) return 'COPAR';

    const bracketMatch = name.trim().match(/^\(([A-Z0-9]+)\)$/);
    if (bracketMatch) {
        return sanitize(bracketMatch[1].padEnd(TARGET,'0').slice(0,TARGET));
    }

    const upper = normalize(name);
    const allWords = upper.split(/\s+/).filter(Boolean);
    const meaningful = allWords.filter(w => !NOISE.has(w));
    const base = meaningful.length > 0 ? meaningful : allWords;
    const effectiveBase = (base.length === 1 && base[0].length === 1) ? allWords : base;
    const joined = effectiveBase.join('');

    if (joined.length <= TARGET - 1) {
        return sanitize(joined.padEnd(TARGET,'0'));
    }

    // Elide interior vowels in-place
    const elided = joined[0] + joined.slice(1).replace(/[AEIOU]/g,'');

    if (elided.length >= TARGET) {
        return sanitize(elided.slice(0, TARGET));
    }

    // Short after elision — append trailing vowels from original
    const originalVowels = [...joined.slice(1)].filter(c => VOWELS.has(c));
    const needed = TARGET - elided.length;
    const filler = originalVowels.slice(-needed).join('');
    const result = (elided + filler).padEnd(TARGET,'0').slice(0, TARGET);
    return sanitize(result);
}

function makeUnique(desired: string, used: Set<string>): string {
    if (!used.has(desired)) return desired;
    for (let i = 1; i <= 9; i++) {
        const c = desired.slice(0,4) + i;
        if (!used.has(c)) return c;
    }
    for (let i = 10; i <= 99; i++) {
        const c = desired.slice(0,3) + i;
        if (!used.has(c)) return c;
    }
    throw new Error(`Cannot find unique code for base "${desired}"`);
}

// ── Shared backfill logic ─────────────────────────────────────────────────────

type Row = { id: string; name: string; shortCode: string | null };

function processRows(
    label: string,
    rows: Row[],
    usedCodes: Set<string>
): { id: string; name: string; newCode: string }[] {

    console.log(`\n── ${label} (${rows.length} rows) ──`);
    const updates: { id: string; name: string; newCode: string }[] = [];

    for (const row of rows) {
        if (row.shortCode && !OVERWRITE) {
            console.log(`  KEEP  ${row.shortCode.padEnd(6)}← ${row.name}`);
            continue;
        }
        const raw  = generateShortCode(row.name);
        const code = makeUnique(raw, usedCodes);
        usedCodes.add(code);
        updates.push({ id: row.id, name: row.name, newCode: code });
        const tag = OVERWRITE && row.shortCode ? 'REGEN' : 'SET  ';
        console.log(`  ${tag} ${code.padEnd(6)}← ${row.name}`);
    }
    return updates;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    console.log(`\nOVERWRITE=${OVERWRITE}  DRY_RUN=${DRY_RUN}\n`);

    // Single shared uniqueness pool across both models
    const usedCodes = new Set<string>();

    // --- Organizations ---
    const orgs = await prisma.organization.findMany({
        select: { id: true, name: true, shortCode: true },
        orderBy: { name: 'asc' },
    });

    // Seed with already-persisted codes we're keeping
    if (!OVERWRITE) {
        orgs.filter(o => o.shortCode).forEach(o => usedCodes.add(o.shortCode!));
    }

    const orgUpdates = processRows('ORGANISATIONS', orgs, usedCodes);

    // --- ClientLEs ---
    const les = await prisma.clientLE.findMany({
        where: { isDeleted: false },
        select: { id: true, name: true, shortCode: true },
        orderBy: { name: 'asc' },
    });

    if (!OVERWRITE) {
        les.filter(l => l.shortCode).forEach(l => usedCodes.add(l.shortCode!));
    }

    const leUpdates = processRows('CLIENT LEs', les, usedCodes);

    const totalUpdates = orgUpdates.length + leUpdates.length;
    console.log(`\nTotal to update: ${totalUpdates} rows`);

    if (totalUpdates === 0) {
        console.log('Nothing to do.\n');
        return;
    }

    if (DRY_RUN) {
        console.log('DRY-RUN: no changes saved.\n');
        return;
    }

    console.log('\nSaving…');

    await Promise.all([
        ...orgUpdates.map(u => prisma.organization.update({
            where: { id: u.id }, data: { shortCode: u.newCode }
        })),
        ...leUpdates.map(u => prisma.clientLE.update({
            where: { id: u.id }, data: { shortCode: u.newCode }
        })),
    ]);

    console.log('Done ✓\n');
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
