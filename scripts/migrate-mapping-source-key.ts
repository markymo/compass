#!/usr/bin/env ts-node
/**
 * Data Migration: mappingSourceKey Architecture
 *
 * Run against PRODUCTION after code changes are deployed.
 * Idempotent: each step checks current state before mutating.
 *
 * Usage:
 *   DATABASE_URL="<prod-url>" npx ts-node --compiler-options '{"module":"CommonJS","strict":false}' scripts/migrate-mapping-source-key.ts
 *
 * Steps:
 *   1. Set mappingSourceKey = "COMPANIES_HOUSE" on RA000585, RA000586, RA000587
 *   2. Delete F17 (registryKey) mapping — no replacement
 *   3. Migrate 6 BASELINE/null mappings → RAW_PAYLOAD/COMPANY_PROFILE + COMPANIES_HOUSE
 *   4. Migrate 3 null-ref RAW_PAYLOAD mappings → COMPANIES_HOUSE (F5, F62, F63)
 *   5. Migrate 4 RA000585-scoped mappings → COMPANIES_HOUSE (F3, F18, F22, F78)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--dry-run');
const log = (msg: string) => console.log(`[${DRY_RUN ? 'DRY-RUN' : 'LIVE'}] ${msg}`);

async function run() {
    log('Starting mappingSourceKey data migration...\n');

    // ── Step 1: Set mappingSourceKey on Companies House authorities ──────────

    log('Step 1: Set RegistryAuthority.mappingSourceKey = "COMPANIES_HOUSE" for CH RAs');
    const chRAs = ['RA000585', 'RA000586', 'RA000587'];
    for (const id of chRAs) {
        const existing = await prisma.registryAuthority.findUnique({ where: { id } });
        if (!existing) {
            log(`  SKIP ${id}: not found in DB`);
            continue;
        }
        if (existing.mappingSourceKey === 'COMPANIES_HOUSE') {
            log(`  SKIP ${id}: already set to COMPANIES_HOUSE`);
            continue;
        }
        log(`  UPDATE ${id}: registryKey=${existing.registryKey} → mappingSourceKey=COMPANIES_HOUSE`);
        if (!DRY_RUN) {
            await prisma.registryAuthority.update({
                where: { id },
                data: { mappingSourceKey: 'COMPANIES_HOUSE' }
            });
        }
    }
    log('');

    // ── Step 2: Delete F17 (registryKey mapping — no replacement) ────────────

    log('Step 2: Delete F17 (registryKey BASELINE/null mapping)');
    const f17 = await prisma.sourceFieldMapping.findFirst({
        where: {
            sourceType: 'REGISTRATION_AUTHORITY',
            targetFieldNo: 17,
        }
    });
    if (!f17) {
        log('  SKIP F17: not found (already deleted or never existed)');
    } else {
        log(`  DELETE F17 id=${f17.id} sourceRef=${f17.sourceReference} scope=${f17.mappingScope} path=${f17.sourcePath}`);
        if (!DRY_RUN) {
            await prisma.sourceFieldMapping.delete({ where: { id: f17.id } });
        }
    }
    log('');

    // ── Step 3: Migrate 6 BASELINE/null mappings ─────────────────────────────

    log('Step 3: Migrate BASELINE/null RA mappings → RAW_PAYLOAD/COMPANY_PROFILE + COMPANIES_HOUSE');
    const baselineMigrations = [
        {
            targetFieldNo: 6,
            description: 'Address line 1',
            currentPath: 'registeredAddress.lines[0]',
            newPath: 'registered_office_address.address_line_1',
        },
        {
            targetFieldNo: 7,
            description: 'City/locality',
            currentPath: 'registeredAddress.city',
            newPath: 'registered_office_address.locality',
        },
        {
            targetFieldNo: 9,
            description: 'Country',
            currentPath: 'registeredAddress.country',
            newPath: 'registered_office_address.country',
        },
        {
            targetFieldNo: 10,
            description: 'Postcode',
            currentPath: 'registeredAddress.postalCode',
            newPath: 'registered_office_address.postal_code',
        },
        {
            targetFieldNo: 20,
            description: 'SIC code',
            currentPath: 'rawSourcePayload.COMPANY_PROFILE.sic_codes[0]',
            newPath: 'sic_codes[0]',
        },
        {
            targetFieldNo: 73,
            description: 'Source record ID / company number',
            currentPath: 'sourceRecordId',
            newPath: 'company_number',
        },
    ];

    for (const m of baselineMigrations) {
        const existing = await prisma.sourceFieldMapping.findFirst({
            where: {
                sourceType: 'REGISTRATION_AUTHORITY',
                targetFieldNo: m.targetFieldNo,
                mappingScope: 'BASELINE',
                sourceReference: null,
            }
        });
        if (!existing) {
            log(`  SKIP F${m.targetFieldNo} (${m.description}): no matching BASELINE/null row found`);
            continue;
        }

        // Check for collision before updating
        const collision = await prisma.sourceFieldMapping.findFirst({
            where: {
                sourceType: 'REGISTRATION_AUTHORITY',
                sourceReference: 'COMPANIES_HOUSE',
                mappingScope: 'RAW_PAYLOAD',
                payloadSubtype: 'COMPANY_PROFILE',
                sourcePath: m.newPath,
                targetFieldNo: m.targetFieldNo,
            }
        });
        if (collision) {
            log(`  WARN F${m.targetFieldNo}: collision with existing COMPANIES_HOUSE row id=${collision.id}. Deleting old BASELINE row instead.`);
            if (!DRY_RUN) {
                await prisma.sourceFieldMapping.delete({ where: { id: existing.id } });
            }
            continue;
        }

        log(`  UPDATE F${m.targetFieldNo} (${m.description}): path="${m.currentPath}" → "${m.newPath}" | BASELINE/null → RAW_PAYLOAD/COMPANY_PROFILE/COMPANIES_HOUSE`);
        if (!DRY_RUN) {
            await prisma.sourceFieldMapping.update({
                where: { id: existing.id },
                data: {
                    sourceReference: 'COMPANIES_HOUSE',
                    mappingScope: 'RAW_PAYLOAD',
                    payloadSubtype: 'COMPANY_PROFILE',
                    sourcePath: m.newPath,
                    notes: `Migrated from BASELINE/null. Corrected path. ${new Date().toISOString()}`,
                }
            });
        }
    }
    log('');

    // ── Step 4: Migrate null-ref RAW_PAYLOAD mappings (F5, F62, F63) ─────────

    log('Step 4: Migrate null-ref RAW_PAYLOAD mappings → COMPANIES_HOUSE (F5=previous names, F62=PSC, F63=Officers)');
    const nullRawPayloadFields = [
        { targetFieldNo: 5,  description: 'Previous company names' },
        { targetFieldNo: 62, description: 'PSC' },
        { targetFieldNo: 63, description: 'Officers' },
    ];

    for (const m of nullRawPayloadFields) {
        const existing = await prisma.sourceFieldMapping.findFirst({
            where: {
                sourceType: 'REGISTRATION_AUTHORITY',
                targetFieldNo: m.targetFieldNo,
                mappingScope: 'RAW_PAYLOAD',
                sourceReference: null,
            }
        });
        if (!existing) {
            log(`  SKIP F${m.targetFieldNo} (${m.description}): no matching null-ref RAW_PAYLOAD row`);
            continue;
        }

        const collision = await prisma.sourceFieldMapping.findFirst({
            where: {
                sourceType: 'REGISTRATION_AUTHORITY',
                sourceReference: 'COMPANIES_HOUSE',
                mappingScope: 'RAW_PAYLOAD',
                payloadSubtype: existing.payloadSubtype,
                sourcePath: existing.sourcePath,
                targetFieldNo: m.targetFieldNo,
            }
        });
        if (collision) {
            log(`  WARN F${m.targetFieldNo}: collision id=${collision.id}. Deleting old null-ref row instead.`);
            if (!DRY_RUN) {
                await prisma.sourceFieldMapping.delete({ where: { id: existing.id } });
            }
            continue;
        }

        log(`  UPDATE F${m.targetFieldNo} (${m.description}): sourceReference null → COMPANIES_HOUSE`);
        if (!DRY_RUN) {
            await prisma.sourceFieldMapping.update({
                where: { id: existing.id },
                data: {
                    sourceReference: 'COMPANIES_HOUSE',
                    notes: `Migrated from null sourceReference. ${new Date().toISOString()}`,
                }
            });
        }
    }
    log('');

    // ── Step 5: Migrate RA000585-scoped mappings → COMPANIES_HOUSE ───────────

    log('Step 5: Migrate RA000585-scoped mappings → COMPANIES_HOUSE (F3, F18, F22, F78)');
    const ra585Fields = [
        { targetFieldNo: 3,  description: 'Legal entity name' },
        { targetFieldNo: 18, description: 'Company number' },
        { targetFieldNo: 22, description: 'Jurisdiction / country of formation' },
        { targetFieldNo: 78, description: 'SIC codes (multi)' },
    ];

    for (const m of ra585Fields) {
        const existing = await prisma.sourceFieldMapping.findFirst({
            where: {
                sourceType: 'REGISTRATION_AUTHORITY',
                targetFieldNo: m.targetFieldNo,
                sourceReference: 'RA000585',
            }
        });
        if (!existing) {
            log(`  SKIP F${m.targetFieldNo} (${m.description}): no RA000585-scoped row found`);
            continue;
        }

        const collision = await prisma.sourceFieldMapping.findFirst({
            where: {
                sourceType: 'REGISTRATION_AUTHORITY',
                sourceReference: 'COMPANIES_HOUSE',
                mappingScope: existing.mappingScope,
                payloadSubtype: existing.payloadSubtype,
                sourcePath: existing.sourcePath,
                targetFieldNo: m.targetFieldNo,
            }
        });
        if (collision) {
            log(`  WARN F${m.targetFieldNo}: collision id=${collision.id}. Deleting old RA000585 row instead.`);
            if (!DRY_RUN) {
                await prisma.sourceFieldMapping.delete({ where: { id: existing.id } });
            }
            continue;
        }

        log(`  UPDATE F${m.targetFieldNo} (${m.description}): sourceReference RA000585 → COMPANIES_HOUSE`);
        if (!DRY_RUN) {
            await prisma.sourceFieldMapping.update({
                where: { id: existing.id },
                data: {
                    sourceReference: 'COMPANIES_HOUSE',
                    notes: `Migrated from RA000585 sourceReference. ${new Date().toISOString()}`,
                }
            });
        }
    }
    log('');

    log('Migration complete.');
    log('\nPost-migration: run verification queries to confirm state.');
}

run()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
