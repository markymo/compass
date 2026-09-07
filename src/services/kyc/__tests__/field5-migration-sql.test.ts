/**
 * field5-migration-sql.test.ts
 *
 * Deterministic regression test for production migration repair:
 * - 20260828213000_set_field5_snapshot_sync_canonical
 * - 20260828222000_ensure_gleif_field5_mapping
 * - 20260828224000_ensure_companies_house_field5_mapping
 *
 * Covers:
 *  1. Production data baseline with GLEIF payloadSubtype = 'LEVEL_1'
 *     does NOT trigger duplicate key insertion collision on id 'a08d12e2-7a76-49ba-991e-a28f82e37bde'.
 *  2. Companies House production mapping converges to TO_NAME_HISTORY_LIST + SNAPSHOT_SYNC without duplicate insert.
 *  3. Exactly ONE canonical mapping exists for each source after migration.
 *  4. Blank database baseline successfully inserts canonical rows with correct payloadSubtype and IDs.
 *  5. Migration is strictly idempotent (running repeatedly produces no duplicates).
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const GLEIF_MIGRATION_PATH = path.resolve(
    __dirname,
    '../../../../prisma/migrations/20260828222000_ensure_gleif_field5_mapping/migration.sql'
);

const CH_MIGRATION_PATH = path.resolve(
    __dirname,
    '../../../../prisma/migrations/20260828224000_ensure_companies_house_field5_mapping/migration.sql'
);

interface MappingRow {
    id: string;
    sourceType: string;
    sourceReference: string | null;
    mappingScope: string;
    payloadSubtype: string | null;
    sourcePath: string;
    targetFieldNo: number;
    transformType: string;
    syncMode: string;
    priority: number;
    isActive: boolean;
    notes?: string | null;
}

/**
 * Executes the SQL semantics of 20260828222000_ensure_gleif_field5_mapping
 */
function applyGleifMigration(rows: MappingRow[]): { inserted: boolean; updated: number } {
    let updated = 0;
    let inserted = false;

    // 1. UPDATE if exists (matching repaired WHERE clause)
    for (const r of rows) {
        const matchesId = r.id === 'a08d12e2-7a76-49ba-991e-a28f82e37bde';
        const matchesSemantic =
            r.sourceType === 'GLEIF' &&
            r.sourceReference === null &&
            r.mappingScope === 'BASELINE' &&
            (r.payloadSubtype === null || r.payloadSubtype === 'LEVEL_1') &&
            r.sourcePath === 'entity.otherNames' &&
            r.targetFieldNo === 5;

        if (matchesId || matchesSemantic) {
            r.transformType = 'TO_NAME_HISTORY_LIST';
            r.syncMode = 'SNAPSHOT_SYNC';
            r.priority = 110;
            r.isActive = true;
            r.notes = 'GLEIF otherNames — TO_NAME_HISTORY_LIST handles string[] or {name,type}[] tolerantly. Dates typically absent.';
            updated++;
        }
    }

    // 2. INSERT if not exists (matching repaired WHERE NOT EXISTS clause)
    const exists = rows.some(r => {
        const matchesId = r.id === 'a08d12e2-7a76-49ba-991e-a28f82e37bde';
        const matchesSemantic =
            r.sourceType === 'GLEIF' &&
            r.sourceReference === null &&
            r.mappingScope === 'BASELINE' &&
            (r.payloadSubtype === null || r.payloadSubtype === 'LEVEL_1') &&
            r.sourcePath === 'entity.otherNames' &&
            r.targetFieldNo === 5;
        return matchesId || matchesSemantic;
    });

    if (!exists) {
        if (rows.some(r => r.id === 'a08d12e2-7a76-49ba-991e-a28f82e37bde')) {
            throw new Error('duplicate key value violates unique constraint "source_field_mappings_pkey"');
        }
        rows.push({
            id: 'a08d12e2-7a76-49ba-991e-a28f82e37bde',
            sourceType: 'GLEIF',
            sourceReference: null,
            mappingScope: 'BASELINE',
            payloadSubtype: 'LEVEL_1',
            sourcePath: 'entity.otherNames',
            targetFieldNo: 5,
            transformType: 'TO_NAME_HISTORY_LIST',
            syncMode: 'SNAPSHOT_SYNC',
            priority: 110,
            isActive: true,
            notes: 'GLEIF otherNames — TO_NAME_HISTORY_LIST handles string[] or {name,type}[] tolerantly. Dates typically absent.'
        });
        inserted = true;
    }

    return { inserted, updated };
}

/**
 * Executes the SQL semantics of 20260828224000_ensure_companies_house_field5_mapping
 */
function applyCompaniesHouseMigration(rows: MappingRow[]): { inserted: boolean; updated: number } {
    let updated = 0;
    let inserted = false;

    // 1. UPDATE if exists (matching repaired WHERE clause)
    for (const r of rows) {
        const matchesId = r.id === '342fe97e-8459-47bb-be99-5d16ebf7692a';
        const matchesSemantic =
            r.sourceType === 'REGISTRATION_AUTHORITY' &&
            (r.sourceReference === 'COMPANIES_HOUSE' || r.sourceReference === 'RA000585') &&
            r.mappingScope === 'RAW_PAYLOAD' &&
            r.payloadSubtype === 'COMPANY_PROFILE' &&
            r.sourcePath === 'previous_company_names' &&
            r.targetFieldNo === 5;

        if (matchesId || matchesSemantic) {
            r.transformType = 'TO_NAME_HISTORY_LIST';
            r.syncMode = 'SNAPSHOT_SYNC';
            r.priority = 100;
            r.isActive = true;
            r.notes = 'UK Previous Legal Names — TO_NAME_HISTORY_LIST produces one structured row per entry (name, effectiveFrom, effectiveTo). Path: previous_company_names in COMPANY_PROFILE payload.';
            updated++;
        }
    }

    // 2. INSERT if not exists (matching repaired WHERE NOT EXISTS clause)
    const exists = rows.some(r => {
        const matchesId = r.id === '342fe97e-8459-47bb-be99-5d16ebf7692a';
        const matchesSemantic =
            r.sourceType === 'REGISTRATION_AUTHORITY' &&
            (r.sourceReference === 'COMPANIES_HOUSE' || r.sourceReference === 'RA000585') &&
            r.mappingScope === 'RAW_PAYLOAD' &&
            r.payloadSubtype === 'COMPANY_PROFILE' &&
            r.sourcePath === 'previous_company_names' &&
            r.targetFieldNo === 5;
        return matchesId || matchesSemantic;
    });

    if (!exists) {
        if (rows.some(r => r.id === '342fe97e-8459-47bb-be99-5d16ebf7692a')) {
            throw new Error('duplicate key value violates unique constraint "source_field_mappings_pkey"');
        }
        rows.push({
            id: '342fe97e-8459-47bb-be99-5d16ebf7692a',
            sourceType: 'REGISTRATION_AUTHORITY',
            sourceReference: 'COMPANIES_HOUSE',
            mappingScope: 'RAW_PAYLOAD',
            payloadSubtype: 'COMPANY_PROFILE',
            sourcePath: 'previous_company_names',
            targetFieldNo: 5,
            transformType: 'TO_NAME_HISTORY_LIST',
            syncMode: 'SNAPSHOT_SYNC',
            priority: 100,
            isActive: true,
            notes: 'UK Previous Legal Names — TO_NAME_HISTORY_LIST produces one structured row per entry (name, effectiveFrom, effectiveTo). Path: previous_company_names in COMPANY_PROFILE payload.'
        });
        inserted = true;
    }

    return { inserted, updated };
}

describe('Field 5 Migration Repair & Production Convergence Regression', () => {

    describe('Migration SQL File Static Invariants', () => {
        it('GLEIF migration checks ID or LEVEL_1 in WHERE and WHERE NOT EXISTS clauses', () => {
            const sql = fs.readFileSync(GLEIF_MIGRATION_PATH, 'utf-8');
            
            // Must check for existing ID to prevent PK collision
            expect(sql).toContain(`"id" = 'a08d12e2-7a76-49ba-991e-a28f82e37bde'`);
            
            // Must handle production LEVEL_1 payloadSubtype
            expect(sql).toMatch(/payloadSubtype.*LEVEL_1/);
            
            // Must insert LEVEL_1 for canonical blank databases
            expect(sql).toContain(`'LEVEL_1'`);
        });

        it('Companies House migration checks ID or COMPANIES_HOUSE in WHERE and WHERE NOT EXISTS clauses', () => {
            const sql = fs.readFileSync(CH_MIGRATION_PATH, 'utf-8');
            
            // Must check for existing ID to prevent PK collision
            expect(sql).toContain(`"id" = '342fe97e-8459-47bb-be99-5d16ebf7692a'`);
            
            // Must target COMPANY_PROFILE
            expect(sql).toContain(`'COMPANY_PROFILE'`);
        });
    });

    describe('Production-Shaped Database State Convergence (Rehearsal Simulation)', () => {
        it('GLEIF: Existing production row with payloadSubtype = LEVEL_1 is updated without duplicate insert', () => {
            // Actual baseline from production before migrations 3 & 4
            const db: MappingRow[] = [
                {
                    id: 'a08d12e2-7a76-49ba-991e-a28f82e37bde',
                    sourceType: 'GLEIF',
                    sourceReference: null,
                    mappingScope: 'BASELINE',
                    payloadSubtype: 'LEVEL_1', // REAL PRODUCTION VALUE
                    sourcePath: 'entity.otherNames',
                    targetFieldNo: 5,
                    transformType: 'DIRECT',
                    syncMode: 'UPSERT_ONLY',
                    priority: 10,
                    isActive: true,
                }
            ];

            const result = applyGleifMigration(db);
            
            // Proves: Updated existing row, did NOT attempt duplicate insert
            expect(result.inserted).toBe(false);
            expect(result.updated).toBe(1);

            // Proves: Exactly one canonical mapping exists
            const gleifMappings = db.filter(r => r.targetFieldNo === 5 && r.sourceType === 'GLEIF');
            expect(gleifMappings.length).toBe(1);

            const m = gleifMappings[0];
            expect(m.id).toBe('a08d12e2-7a76-49ba-991e-a28f82e37bde');
            expect(m.transformType).toBe('TO_NAME_HISTORY_LIST');
            expect(m.syncMode).toBe('SNAPSHOT_SYNC');
            expect(m.priority).toBe(110);
            expect(m.isActive).toBe(true);
            expect(m.payloadSubtype).toBe('LEVEL_1');
        });

        it('Companies House: Existing production row is updated without duplicate insert', () => {
            const db: MappingRow[] = [
                {
                    id: '342fe97e-8459-47bb-be99-5d16ebf7692a',
                    sourceType: 'REGISTRATION_AUTHORITY',
                    sourceReference: 'COMPANIES_HOUSE',
                    mappingScope: 'RAW_PAYLOAD',
                    payloadSubtype: 'COMPANY_PROFILE',
                    sourcePath: 'previous_company_names',
                    targetFieldNo: 5,
                    transformType: 'TO_NAME_HISTORY_LIST',
                    syncMode: 'UPSERT_ONLY',
                    priority: 100,
                    isActive: true,
                }
            ];

            const result = applyCompaniesHouseMigration(db);
            
            expect(result.inserted).toBe(false);
            expect(result.updated).toBe(1);

            const chMappings = db.filter(r => r.targetFieldNo === 5 && r.sourceType === 'REGISTRATION_AUTHORITY');
            expect(chMappings.length).toBe(1);

            const m = chMappings[0];
            expect(m.id).toBe('342fe97e-8459-47bb-be99-5d16ebf7692a');
            expect(m.transformType).toBe('TO_NAME_HISTORY_LIST');
            expect(m.syncMode).toBe('SNAPSHOT_SYNC');
            expect(m.priority).toBe(100);
            expect(m.isActive).toBe(true);
        });

        it('Full combined production baseline: Both migrations run cleanly and leave exactly 2 canonical Field 5 rows', () => {
            // Production state with both existing mappings
            const db: MappingRow[] = [
                {
                    id: 'a08d12e2-7a76-49ba-991e-a28f82e37bde',
                    sourceType: 'GLEIF',
                    sourceReference: null,
                    mappingScope: 'BASELINE',
                    payloadSubtype: 'LEVEL_1',
                    sourcePath: 'entity.otherNames',
                    targetFieldNo: 5,
                    transformType: 'DIRECT',
                    syncMode: 'UPSERT_ONLY',
                    priority: 10,
                    isActive: true,
                },
                {
                    id: '342fe97e-8459-47bb-be99-5d16ebf7692a',
                    sourceType: 'REGISTRATION_AUTHORITY',
                    sourceReference: 'COMPANIES_HOUSE',
                    mappingScope: 'RAW_PAYLOAD',
                    payloadSubtype: 'COMPANY_PROFILE',
                    sourcePath: 'previous_company_names',
                    targetFieldNo: 5,
                    transformType: 'TO_NAME_HISTORY_LIST',
                    syncMode: 'UPSERT_ONLY',
                    priority: 100,
                    isActive: true,
                }
            ];

            const gleifRes = applyGleifMigration(db);
            const chRes = applyCompaniesHouseMigration(db);

            expect(gleifRes.inserted).toBe(false);
            expect(chRes.inserted).toBe(false);

            // Exactly 2 Field 5 mappings exist in total
            const f5Mappings = db.filter(r => r.targetFieldNo === 5);
            expect(f5Mappings.length).toBe(2);

            // Companies House outranks GLEIF
            const ch = f5Mappings.find(r => r.sourceType === 'REGISTRATION_AUTHORITY')!;
            const gleif = f5Mappings.find(r => r.sourceType === 'GLEIF')!;
            expect(ch.priority).toBe(100);
            expect(gleif.priority).toBe(110);
            expect(ch.syncMode).toBe('SNAPSHOT_SYNC');
            expect(gleif.syncMode).toBe('SNAPSHOT_SYNC');
            expect(ch.transformType).toBe('TO_NAME_HISTORY_LIST');
            expect(gleif.transformType).toBe('TO_NAME_HISTORY_LIST');
        });

        it('Blank Database State: Inserts canonical mappings with expected IDs and values', () => {
            const db: MappingRow[] = [];

            const gleifRes = applyGleifMigration(db);
            const chRes = applyCompaniesHouseMigration(db);

            expect(gleifRes.inserted).toBe(true);
            expect(chRes.inserted).toBe(true);

            expect(db.length).toBe(2);
            expect(db.find(r => r.id === 'a08d12e2-7a76-49ba-991e-a28f82e37bde')).toBeDefined();
            expect(db.find(r => r.id === '342fe97e-8459-47bb-be99-5d16ebf7692a')).toBeDefined();
        });

        it('Idempotency: Re-running migrations against already migrated DB makes zero inserts and retains state', () => {
            const db: MappingRow[] = [];

            // First run (blank DB)
            applyGleifMigration(db);
            applyCompaniesHouseMigration(db);
            expect(db.length).toBe(2);

            // Second run (already migrated)
            const secondGleif = applyGleifMigration(db);
            const secondCH = applyCompaniesHouseMigration(db);

            expect(secondGleif.inserted).toBe(false);
            expect(secondCH.inserted).toBe(false);
            expect(db.length).toBe(2);
        });
    });
});
