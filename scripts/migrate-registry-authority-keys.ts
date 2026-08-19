#!/usr/bin/env ts-node
/**
 * Data Migration: Registry Authority Keys & Mapping Source Keys Backfill
 *
 * Idempotent migration:
 * 1. Drops the legacy unique index on registry_authorities.registryKey so multiple RAs (RA000585, RA000586, RA000587) can share registryKey = "GB_COMPANIES_HOUSE".
 * 2. Updates RA000585, RA000586, RA000587 to registryKey = "GB_COMPANIES_HOUSE", mappingSourceKey = "COMPANIES_HOUSE".
 * 3. Updates RA000592 to registryKey = "UK_FCA", mappingSourceKey = null.
 *
 * Usage:
 *   DATABASE_URL="..." npx ts-node --compiler-options '{"module":"CommonJS","strict":false}' scripts/migrate-registry-authority-keys.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');
const log = (msg: string) => console.log(`[${DRY_RUN ? 'DRY-RUN' : 'LIVE'}] ${msg}`);

async function run() {
    log('Starting RegistryAuthority keys data migration...\n');

    // 1. Drop legacy unique constraint on registryKey if it exists
    log('Step 1: Dropping unique constraint on registry_authorities.registryKey...');
    if (!DRY_RUN) {
        await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "registry_authorities_registryKey_key";`);
    }

    // 2. Companies House RAs
    const chRAs = [
        { id: 'RA000585', jurisdiction: 'England and Wales' },
        { id: 'RA000586', jurisdiction: 'Northern Ireland' },
        { id: 'RA000587', jurisdiction: 'Scotland' },
    ];

    for (const item of chRAs) {
        const existing = await prisma.registryAuthority.findUnique({ where: { id: item.id } });
        if (!existing) {
            log(`  UPSERT ${item.id}: authority record missing. Creating...`);
            if (!DRY_RUN) {
                await prisma.registryAuthority.create({
                    data: {
                        id: item.id,
                        registryKey: 'GB_COMPANIES_HOUSE',
                        mappingSourceKey: 'COMPANIES_HOUSE',
                        name: 'United Kingdom of Great Britain and Northern Ireland | Companies House | Companies Register',
                        countryCode: 'GB',
                        jurisdiction: item.jurisdiction,
                        isActive: true
                    }
                });
            }
            continue;
        }

        const needsUpdate = existing.registryKey !== 'GB_COMPANIES_HOUSE' || existing.mappingSourceKey !== 'COMPANIES_HOUSE';
        if (!needsUpdate) {
            log(`  SKIP ${item.id}: already has registryKey=GB_COMPANIES_HOUSE, mappingSourceKey=COMPANIES_HOUSE`);
            continue;
        }

        log(`  UPDATE ${item.id}: registryKey="${existing.registryKey}" → "GB_COMPANIES_HOUSE" | mappingSourceKey="${existing.mappingSourceKey}" → "COMPANIES_HOUSE"`);
        if (!DRY_RUN) {
            await prisma.registryAuthority.update({
                where: { id: item.id },
                data: {
                    registryKey: 'GB_COMPANIES_HOUSE',
                    mappingSourceKey: 'COMPANIES_HOUSE'
                }
            });
        }
    }

    // 3. FCA Financial Services Register (RA000592)
    const fcaId = 'RA000592';
    const fcaExisting = await prisma.registryAuthority.findUnique({ where: { id: fcaId } });
    if (!fcaExisting) {
        log(`  UPSERT ${fcaId}: authority record missing. Creating...`);
        if (!DRY_RUN) {
            await prisma.registryAuthority.create({
                data: {
                    id: fcaId,
                    registryKey: 'UK_FCA',
                    mappingSourceKey: null,
                    name: 'United Kingdom of Great Britain and Northern Ireland | Financial Conduct Authority | Financial Services Register',
                    countryCode: 'GB',
                    jurisdiction: 'United Kingdom of Great Britain and Northern Ireland',
                    isActive: true
                }
            });
        }
    } else {
        const needsFcaUpdate = fcaExisting.registryKey !== 'UK_FCA';
        if (!needsFcaUpdate) {
            log(`  SKIP ${fcaId}: already has registryKey=UK_FCA`);
        } else {
            log(`  UPDATE ${fcaId}: registryKey="${fcaExisting.registryKey}" → "UK_FCA"`);
            if (!DRY_RUN) {
                await prisma.registryAuthority.update({
                    where: { id: fcaId },
                    data: {
                        registryKey: 'UK_FCA',
                        mappingSourceKey: null
                    }
                });
            }
        }
    }

    log('\nRegistryAuthority migration completed successfully.');
}

run()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
