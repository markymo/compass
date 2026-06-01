/**
 * Parity tests for resolveMasterDataBatch.
 *
 * Strategy: for each scenario, construct a BatchResolverInput from mock data
 * and assert that resolveMasterDataBatch returns the same ResolverResponse
 * structure that the legacy resolveMasterData would produce.
 *
 * No DB connection. All data in-memory.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaimStatus } from '@prisma/client';
import {
    resolveMasterDataBatch,
    BatchResolverInput,
} from '../kyc-query';

// ── Shared test fixtures ────────────────────────────────────────────────────

const SUBJECT_LE_ID = 'le-test-001';
const SCOPE_ID      = 'scope-org-001';

/** Minimal FieldClaim-shaped object for testing */
function makeClaim(overrides: Record<string, any>): any {
    return {
        id: overrides.id ?? 'claim-001',
        fieldNo: overrides.fieldNo ?? 3,
        subjectLeId: SUBJECT_LE_ID,
        ownerScopeId: overrides.ownerScopeId ?? null,
        status: overrides.status ?? ClaimStatus.VERIFIED,
        sourceType: overrides.sourceType ?? 'REGISTRATION_AUTHORITY',
        sourceReference: overrides.sourceReference ?? 'COMPANIES_HOUSE',
        assertedAt: overrides.assertedAt ?? new Date('2026-01-01T00:00:00Z'),
        collectionId: overrides.collectionId ?? null,
        instanceId: overrides.instanceId ?? null,
        valueText: overrides.valueText ?? null,
        valueNumber: overrides.valueNumber ?? null,
        valueDate: overrides.valueDate ?? null,
        valueJson: overrides.valueJson ?? null,
        valueDocId: overrides.valueDocId ?? null,
        evidenceId: overrides.evidenceId ?? null,
        confidenceScore: overrides.confidenceScore ?? null,
        effectiveFrom: overrides.effectiveFrom ?? null,
        effectiveTo: overrides.effectiveTo ?? null,
    };
}

/** Minimal SourceFieldMapping row */
function makeMapping(fieldNo: number, sourceType: string, sourceReference: string | null, priority: number): any {
    return { targetFieldNo: fieldNo, sourceType, sourceReference, priority };
}

/** Minimal FieldDef */
function makeDef(fieldNo: number, isMultiValue = false): any {
    return { fieldNo, fieldName: `Field ${fieldNo}`, appDataType: 'TEXT', isMultiValue };
}

// ── T1: Single field, GLEIF-sourced ─────────────────────────────────────────

describe('resolveMasterDataBatch', () => {

    it('T1: Single field — single GLEIF claim resolves correctly', async () => {
        const claim = makeClaim({ id: 'c1', fieldNo: 3, sourceType: 'GLEIF', sourceReference: null, valueText: 'Acme Ltd' });
        const input: BatchResolverInput = {
            subjectLeId: SUBJECT_LE_ID,
            ownerScopeId: null,
            questions: [{ questionId: 'q1', masterFieldNo: 3 }],
            fieldDefMap: new Map([[3, makeDef(3)]]),
            groupFieldMap: new Map(),
            claims: [claim],
            sourceMappings: [makeMapping(3, 'GLEIF', null, 10)],
        };

        const result = await resolveMasterDataBatch(input);

        expect(result['q1']).toBeDefined();
        expect(result['q1']['3'].value).toBe('Acme Ltd');
        // source is the raw sourceType for non-USER_INPUT automated claims
        expect(result['q1']['3'].source).toBe('GLEIF');
        expect(result['q1']['3'].isSynced).toBe(true);
    });

    // ── T2: Priority — USER_INPUT beats REGISTRATION_AUTHORITY ──────────────

    it('T2: USER_INPUT claim beats REGISTRATION_AUTHORITY within same tier', async () => {
        const raClaim   = makeClaim({ id: 'c-ra', fieldNo: 5, sourceType: 'REGISTRATION_AUTHORITY', sourceReference: 'COMPANIES_HOUSE', valueText: 'RA Value',   assertedAt: new Date('2026-01-02') });
        const userClaim = makeClaim({ id: 'c-ui', fieldNo: 5, sourceType: 'USER_INPUT',             sourceReference: null,              valueText: 'User Value', assertedAt: new Date('2026-01-01'), status: ClaimStatus.VERIFIED });

        const input: BatchResolverInput = {
            subjectLeId: SUBJECT_LE_ID,
            ownerScopeId: null,
            questions: [{ questionId: 'q2', masterFieldNo: 5 }],
            fieldDefMap: new Map([[5, makeDef(5)]]),
            groupFieldMap: new Map(),
            claims: [raClaim, userClaim],
            sourceMappings: [makeMapping(5, 'REGISTRATION_AUTHORITY', 'COMPANIES_HOUSE', 20)],
        };

        const result = await resolveMasterDataBatch(input);

        expect(result['q2']['5'].value).toBe('User Value');
        expect(result['q2']['5'].source).toBe('USER_INPUT');
    });

    // ── T3: Tombstoned claim returns no value ────────────────────────────────

    it('T3: Active tombstone — field returns isSynced: false', async () => {
        const tombstone = makeClaim({ id: 'c-tomb', fieldNo: 7, sourceType: 'USER_INPUT', valueJson: { tombstone: true } });
        const input: BatchResolverInput = {
            subjectLeId: SUBJECT_LE_ID,
            ownerScopeId: null,
            questions: [{ questionId: 'q3', masterFieldNo: 7 }],
            fieldDefMap: new Map([[7, makeDef(7)]]),
            groupFieldMap: new Map(),
            claims: [tombstone],
            sourceMappings: [],
        };

        const result = await resolveMasterDataBatch(input);

        expect(result['q3']['7'].isSynced).toBe(false);
        expect(result['q3']['7'].value).toBeNull();
    });

    // ── T4: Multi-value collection (SIC_CODES) ───────────────────────────────

    it('T4: Multi-value collection — both JSONB entries returned; legacy TEXT claim excluded by filterCollectionId', async () => {
        const sicA = makeClaim({
            id: 'c-sic-a', fieldNo: 20, sourceType: 'REGISTRATION_AUTHORITY',
            sourceReference: 'COMPANIES_HOUSE', collectionId: 'SIC_CODES', instanceId: 'sic_61900',
            valueJson: { code: '61900', label: 'Other telecommunications activities' },
        });
        const sicB = makeClaim({
            id: 'c-sic-b', fieldNo: 20, sourceType: 'REGISTRATION_AUTHORITY',
            sourceReference: 'COMPANIES_HOUSE', collectionId: 'SIC_CODES', instanceId: 'sic_35110',
            valueJson: { code: '35110', label: 'Production of electricity' },
        });
        // Legacy TEXT claim — should be excluded by collectionId filter
        const legacyText = makeClaim({
            id: 'c-sic-legacy', fieldNo: 20, sourceType: 'REGISTRATION_AUTHORITY',
            sourceReference: 'COMPANIES_HOUSE', collectionId: null, instanceId: null,
            valueText: '61900',
        });

        const input: BatchResolverInput = {
            subjectLeId: SUBJECT_LE_ID,
            ownerScopeId: null,
            questions: [{ questionId: 'q4', masterFieldNo: 20 }],
            fieldDefMap: new Map([[20, makeDef(20, true)]]),
            groupFieldMap: new Map(),
            claims: [sicA, sicB, legacyText],
            sourceMappings: [makeMapping(20, 'REGISTRATION_AUTHORITY', 'COMPANIES_HOUSE', 20)],
            // Complex field config is resolved internally by resolveMasterDataBatch
        };

        const result = await resolveMasterDataBatch(input);

        expect(Array.isArray(result['q4']['20'].value)).toBe(true);
        expect(result['q4']['20'].value).toHaveLength(2);
        // Ensure legacy string value is not present
        const values: any[] = result['q4']['20'].value;
        expect(values.every((v: any) => typeof v === 'object' && v.code)).toBe(true);
        expect(result['q4']['20'].isSynced).toBe(true);
    });

    // ── T5: Group-mapped question (REGISTERED_ADDRESS, 5 sub-fields) ─────────

    it('T5: Group question — all 5 sub-fields resolved from pre-loaded claims', async () => {
        // Fields 6-10 = REGISTERED_ADDRESS sub-fields
        const groupFieldNos = [6, 7, 8, 9, 10];
        const claims = groupFieldNos.map((fno, i) =>
            makeClaim({ id: `c-addr-${fno}`, fieldNo: fno, sourceType: 'REGISTRATION_AUTHORITY', sourceReference: 'COMPANIES_HOUSE', valueText: `Value${i}` })
        );

        const fieldDefMap = new Map(groupFieldNos.map(fno => [fno, makeDef(fno)]));
        fieldDefMap.set(6, { ...makeDef(6), appDataType: 'TEXT' });

        const input: BatchResolverInput = {
            subjectLeId: SUBJECT_LE_ID,
            ownerScopeId: null,
            questions: [{ questionId: 'q5', masterQuestionGroupId: 'REGISTERED_ADDRESS' }],
            fieldDefMap,
            groupFieldMap: new Map([['REGISTERED_ADDRESS', groupFieldNos]]),
            claims,
            sourceMappings: groupFieldNos.map(fno => makeMapping(fno, 'REGISTRATION_AUTHORITY', 'COMPANIES_HOUSE', 20)),
        };

        const result = await resolveMasterDataBatch(input);

        expect(result['q5']).toBeDefined();
        for (const fno of groupFieldNos) {
            expect(result['q5'][String(fno)]).toBeDefined();
            expect(result['q5'][String(fno)].isSynced).toBe(true);
        }
    });

    // ── T6: Two questions mapped to same group — resolved once ───────────────

    it('T6: Two questions mapped to same group return identical values (group resolved once)', async () => {
        const groupFieldNos = [6, 7];
        const claims = groupFieldNos.map(fno =>
            makeClaim({ id: `c-g2-${fno}`, fieldNo: fno, sourceType: 'REGISTRATION_AUTHORITY', sourceReference: 'COMPANIES_HOUSE', valueText: `V${fno}` })
        );

        const input: BatchResolverInput = {
            subjectLeId: SUBJECT_LE_ID,
            ownerScopeId: null,
            questions: [
                { questionId: 'qA', masterQuestionGroupId: 'MY_GROUP' },
                { questionId: 'qB', masterQuestionGroupId: 'MY_GROUP' },
            ],
            fieldDefMap: new Map(groupFieldNos.map(fno => [fno, makeDef(fno)])),
            groupFieldMap: new Map([['MY_GROUP', groupFieldNos]]),
            claims,
            sourceMappings: groupFieldNos.map(fno => makeMapping(fno, 'REGISTRATION_AUTHORITY', 'COMPANIES_HOUSE', 20)),
        };

        const result = await resolveMasterDataBatch(input);

        // Both questions get the same resolved group
        expect(result['qA']).toEqual(result['qB']);
        expect(result['qA']['6'].value).toBe('V6');
        expect(result['qB']['7'].value).toBe('V7');
    });

    // ── T7: Unmapped question — returns empty object ─────────────────────────

    it('T7: Unmapped question (no masterFieldNo, no group) returns empty record', async () => {
        const input: BatchResolverInput = {
            subjectLeId: SUBJECT_LE_ID,
            ownerScopeId: null,
            questions: [{ questionId: 'q7' }],
            fieldDefMap: new Map(),
            groupFieldMap: new Map(),
            claims: [],
            sourceMappings: [],
        };

        const result = await resolveMasterDataBatch(input);

        expect(result['q7']).toEqual({});
    });

    // ── T8: Field with no claims — returns isSynced: false ──────────────────

    it('T8: Mapped field with no matching claims returns isSynced: false', async () => {
        const input: BatchResolverInput = {
            subjectLeId: SUBJECT_LE_ID,
            ownerScopeId: null,
            questions: [{ questionId: 'q8', masterFieldNo: 99 }],
            fieldDefMap: new Map([[99, makeDef(99)]]),
            groupFieldMap: new Map(),
            claims: [], // no claims at all
            sourceMappings: [],
        };

        const result = await resolveMasterDataBatch(input);

        expect(result['q8']['99'].isSynced).toBe(false);
        expect(result['q8']['99'].value).toBeNull();
    });

    // ── T9: Mixed batch — fields + groups + unmapped ─────────────────────────

    it('T9: Mixed batch returns correct ResolverResponse for all question types', async () => {
        const fieldClaim = makeClaim({ id: 'c-mix-1', fieldNo: 3, sourceType: 'GLEIF', sourceReference: null, valueText: 'Test Name' });
        const groupClaims = [6, 7].map(fno =>
            makeClaim({ id: `c-mix-${fno}`, fieldNo: fno, sourceType: 'REGISTRATION_AUTHORITY', sourceReference: 'COMPANIES_HOUSE', valueText: `Addr${fno}` })
        );

        const input: BatchResolverInput = {
            subjectLeId: SUBJECT_LE_ID,
            ownerScopeId: null,
            questions: [
                { questionId: 'qField',   masterFieldNo: 3 },
                { questionId: 'qGroup',   masterQuestionGroupId: 'MY_GROUP' },
                { questionId: 'qNoMap' }, // unmapped
            ],
            fieldDefMap: new Map([
                [3,  makeDef(3)],
                [6,  makeDef(6)],
                [7,  makeDef(7)],
            ]),
            groupFieldMap: new Map([['MY_GROUP', [6, 7]]]),
            claims: [fieldClaim, ...groupClaims],
            sourceMappings: [
                makeMapping(3,  'GLEIF', null, 10),
                makeMapping(6,  'REGISTRATION_AUTHORITY', 'COMPANIES_HOUSE', 20),
                makeMapping(7,  'REGISTRATION_AUTHORITY', 'COMPANIES_HOUSE', 20),
            ],
        };

        const result = await resolveMasterDataBatch(input);

        // Field question
        expect(result['qField']['3'].value).toBe('Test Name');
        expect(result['qField']['3'].isSynced).toBe(true);
        // Group question
        expect(result['qGroup']['6'].value).toBe('Addr6');
        expect(result['qGroup']['7'].value).toBe('Addr7');
        // Unmapped question
        expect(result['qNoMap']).toEqual({});
    });

});
