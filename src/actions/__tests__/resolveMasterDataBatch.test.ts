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
import prisma from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({
    default: {
        cCAddress: { findMany: vi.fn() },
        cCParty: { findMany: vi.fn() },
    }
}));

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

    // ── T10: sourceReference is threaded from claim to HydratedValue ────────

    it('T10: REGISTRATION_AUTHORITY claim carries sourceReference through to HydratedValue', async () => {
        const claim = makeClaim({
            id: 'c-t10', fieldNo: 3,
            sourceType: 'REGISTRATION_AUTHORITY', sourceReference: 'RA000585',
            valueText: 'Lynn Wind Farm Ltd',
        });
        const input: BatchResolverInput = {
            subjectLeId: SUBJECT_LE_ID,
            ownerScopeId: null,
            questions: [{ questionId: 'q10', masterFieldNo: 3 }],
            fieldDefMap: new Map([[3, makeDef(3)]]),
            groupFieldMap: new Map(),
            claims: [claim],
            sourceMappings: [makeMapping(3, 'REGISTRATION_AUTHORITY', 'RA000585', 20)],
        };

        const result = await resolveMasterDataBatch(input);

        expect(result['q10']['3'].sourceReference).toBe('RA000585');
        expect(result['q10']['3'].source).toBe('REGISTRATION_AUTHORITY'); // source unchanged
        expect(result['q10']['3'].isSynced).toBe(true);
    });

    // ── T11: USER_INPUT produces sourceReference: null ───────────────────────

    it('T11: USER_INPUT claim produces null sourceReference in HydratedValue', async () => {
        // Note: makeClaim uses ?? so null is coalesced to the default 'COMPANIES_HOUSE'.
        // Use an explicit empty-string sentinel to force null-like, or omit sourceReference
        // and instead build a raw claim object directly.
        const claim = {
            id: 'c-t11', fieldNo: 3,
            subjectLeId: SUBJECT_LE_ID,
            ownerScopeId: null,
            status: 'VERIFIED',
            sourceType: 'USER_INPUT',
            sourceReference: null,      // explicitly null — not coalesced by factory
            assertedAt: new Date('2026-01-01T00:00:00Z'),
            collectionId: null, instanceId: null,
            valueText: 'Manually entered name',
            valueNumber: null, valueDate: null, valueJson: null, valueDocId: null,
            evidenceId: null, confidenceScore: null, effectiveFrom: null, effectiveTo: null,
        };
        const input: BatchResolverInput = {
            subjectLeId: SUBJECT_LE_ID,
            ownerScopeId: null,
            questions: [{ questionId: 'q11', masterFieldNo: 3 }],
            fieldDefMap: new Map([[3, makeDef(3)]]),
            groupFieldMap: new Map(),
            claims: [claim as any],
            sourceMappings: [],
        };

        const result = await resolveMasterDataBatch(input);

        expect(result['q11']['3'].sourceReference).toBeNull();
        expect(result['q11']['3'].source).toBe('USER_INPUT');
    });

    // ── T12: Collection updatedAt = MAX(assertedAt), not first item ──────────

    it('T12: Collection updatedAt uses MAX assertedAt not collection[0].assertedAt', async () => {
        const older = makeClaim({
            id: 'c-t12-old', fieldNo: 20,
            sourceType: 'REGISTRATION_AUTHORITY', sourceReference: 'RA000585',
            collectionId: 'SIC_CODES', instanceId: 'sic_35110',
            valueJson: { code: '35110', label: 'Production of electricity' },
            assertedAt: new Date('2026-01-01T00:00:00Z'),
        });
        const newer = makeClaim({
            id: 'c-t12-new', fieldNo: 20,
            sourceType: 'REGISTRATION_AUTHORITY', sourceReference: 'RA000585',
            collectionId: 'SIC_CODES', instanceId: 'sic_20100',
            valueJson: { code: '20100', label: 'Manufacture of plastics' },
            assertedAt: new Date('2026-06-10T10:00:00Z'), // newer
        });
        const input: BatchResolverInput = {
            subjectLeId: SUBJECT_LE_ID,
            ownerScopeId: null,
            questions: [{ questionId: 'q12', masterFieldNo: 20 }],
            fieldDefMap: new Map([[20, makeDef(20, true)]]),
            groupFieldMap: new Map(),
            claims: [older, newer],
            sourceMappings: [makeMapping(20, 'REGISTRATION_AUTHORITY', 'RA000585', 20)],
        };

        const result = await resolveMasterDataBatch(input);

        // updatedAt must equal the NEWER timestamp, not older
        const updatedAt = result['q12']['20'].updatedAt as Date;
        expect(updatedAt).toEqual(new Date('2026-06-10T10:00:00Z'));
        expect(result['q12']['20'].value).toHaveLength(2);
    });

    // ── T13: sourceReference threads into group sub-fields ───────────────────

    it('T13: Group sub-field carries sourceReference from its winning claim', async () => {
        const claim = makeClaim({
            id: 'c-t13', fieldNo: 6,
            sourceType: 'REGISTRATION_AUTHORITY', sourceReference: 'RA000585',
            valueText: '1 Wind Farm Road',
        });
        const input: BatchResolverInput = {
            subjectLeId: SUBJECT_LE_ID,
            ownerScopeId: null,
            questions: [{ questionId: 'q13', masterQuestionGroupId: 'REGISTERED_ADDRESS' }],
            fieldDefMap: new Map([[6, makeDef(6)]]),
            groupFieldMap: new Map([['REGISTERED_ADDRESS', [6]]]),
            claims: [claim],
            sourceMappings: [makeMapping(6, 'REGISTRATION_AUTHORITY', 'RA000585', 20)],
        };

        const result = await resolveMasterDataBatch(input);

        expect(result['q13']['6'].sourceReference).toBe('RA000585');
        expect(result['q13']['6'].source).toBe('REGISTRATION_AUTHORITY');
    });

    // ── T14: Consumers destructuring only {value,source,isSynced} unaffected ─

    it('T14: Existing consumer destructuring source/value/isSynced still works (backwards compat)', async () => {
        const claim = makeClaim({ id: 'c-t14', fieldNo: 3, sourceType: 'GLEIF', sourceReference: null, valueText: 'Test' });
        const input: BatchResolverInput = {
            subjectLeId: SUBJECT_LE_ID,
            ownerScopeId: null,
            questions: [{ questionId: 'q14', masterFieldNo: 3 }],
            fieldDefMap: new Map([[3, makeDef(3)]]),
            groupFieldMap: new Map(),
            claims: [claim],
            sourceMappings: [makeMapping(3, 'GLEIF', null, 10)],
        };

        const result = await resolveMasterDataBatch(input);

        // Simulate a consumer that only cares about the original three fields
        const { value, source, isSynced } = result['q14']['3'];
        expect(value).toBe('Test');
        expect(source).toBe('GLEIF');
        expect(isSynced).toBe(true);
        // sourceReference is optional — accessing it does not throw.
        // The makeClaim factory defaults sourceReference to 'COMPANIES_HOUSE' when not
        // overridden; the field is present and should not be undefined.
        expect(result['q14']['3'].sourceReference).toBeDefined();
    });

    // ── T15: Scalar field projection ──────────────────────────────────────────

    it('T15: Scalar field projection extracts specific property and inherits provenance', async () => {
        const claim = makeClaim({
            id: 'c-t15', fieldNo: 3,
            sourceType: 'REGISTRATION_AUTHORITY', sourceReference: 'RA000585',
            valueJson: { locality: 'London', region: 'Greater London' },
            assertedAt: new Date('2026-02-01T00:00:00Z'),
        });
        const input: BatchResolverInput = {
            subjectLeId: SUBJECT_LE_ID,
            ownerScopeId: null,
            questions: [{ questionId: 'q15', masterFieldNo: 3, masterFieldProjectionPath: 'locality' }],
            fieldDefMap: new Map([[3, { ...makeDef(3), appDataType: 'ADDRESS' }]]),
            groupFieldMap: new Map(),
            claims: [claim],
            sourceMappings: [makeMapping(3, 'REGISTRATION_AUTHORITY', 'RA000585', 20)],
        };

        const result = await resolveMasterDataBatch(input);

        expect(result['q15']['3'].value).toBe('London'); // Extracted 'locality'
        expect(result['q15']['3'].source).toBe('REGISTRATION_AUTHORITY');
        expect(result['q15']['3'].sourceReference).toBe('RA000585');
        expect(result['q15']['3'].isSynced).toBe(true);
        expect(result['q15']['3'].updatedAt).toEqual(new Date('2026-02-01T00:00:00Z'));
    });

    // ── T16: Array field projection (indexed) ───────────────────────────────

    it('T16: Array field projection extracts indexed property', async () => {
        const claim = makeClaim({
            id: 'c-t16', fieldNo: 3,
            sourceType: 'GLEIF', sourceReference: null,
            valueJson: { addressLines: ['Line 1', 'Line 2'] },
        });
        const input: BatchResolverInput = {
            subjectLeId: SUBJECT_LE_ID,
            ownerScopeId: null,
            questions: [{ questionId: 'q16', masterFieldNo: 3, masterFieldProjectionPath: 'addressLines[1]' }],
            fieldDefMap: new Map([[3, { ...makeDef(3), appDataType: 'ADDRESS' }]]),
            groupFieldMap: new Map(),
            claims: [claim],
            sourceMappings: [makeMapping(3, 'GLEIF', null, 10)],
        };

        const result = await resolveMasterDataBatch(input);

        expect(result['q16']['3'].value).toBe('Line 2');
    });

    // ── T17: Missing path returns null ──────────────────────────────────────

    it('T17: Missing projection path on resolved value returns null', async () => {
        const claim = makeClaim({
            id: 'c-t17', fieldNo: 3,
            sourceType: 'USER_INPUT',
            valueJson: { locality: 'London' }, // Missing 'region'
        });
        const input: BatchResolverInput = {
            subjectLeId: SUBJECT_LE_ID,
            ownerScopeId: null,
            questions: [{ questionId: 'q17', masterFieldNo: 3, masterFieldProjectionPath: 'region' }],
            fieldDefMap: new Map([[3, { ...makeDef(3), appDataType: 'ADDRESS' }]]),
            groupFieldMap: new Map(),
            claims: [claim],
            sourceMappings: [makeMapping(3, 'USER_INPUT', null, 30)],
        };

        const result = await resolveMasterDataBatch(input);

        expect(result['q17']['3'].value).toBeNull();
        expect(result['q17']['3'].isSynced).toBe(true); // Still "synced" with the master record, just empty property
    });

    // ── T18: Deep nesting and combinations ─────────────────────────────────

    it('T18: Deep paths with dot notation and array index combinations', async () => {
        const claim = makeClaim({
            id: 'c-t18', fieldNo: 3,
            sourceType: 'USER_INPUT',
            valueJson: { 
                address: { locality: 'London', country: { code: 'UK' } },
                addresses: [{ postalCode: '123' }],
                dateOfBirth: { year: 1990 }
            },
        });
        
        // Define common input payload
        const makeInput = (path: string): BatchResolverInput => ({
            subjectLeId: SUBJECT_LE_ID,
            ownerScopeId: null,
            questions: [{ questionId: 'q18', masterFieldNo: 3, masterFieldProjectionPath: path }],
            fieldDefMap: new Map([[3, { ...makeDef(3), appDataType: 'JSON' }]]),
            groupFieldMap: new Map(),
            claims: [claim],
            sourceMappings: [makeMapping(3, 'USER_INPUT', null, 30)],
        });

        const r1 = await resolveMasterDataBatch(makeInput('address.locality'));
        expect(r1['q18']['3'].value).toBe('London');

        const r2 = await resolveMasterDataBatch(makeInput('address.country.code'));
        expect(r2['q18']['3'].value).toBe('UK');

        const r3 = await resolveMasterDataBatch(makeInput('addresses[0].postalCode'));
        expect(r3['q18']['3'].value).toBe('123');

        const r4 = await resolveMasterDataBatch(makeInput('dateOfBirth.year'));
        expect(r4['q18']['3'].value).toBe(1990);
    });

    // ── T19: CCAddress full resolution ───────────────────────────────────────

    it('T19: full { ccAddressId } resolves to resolvedSummary/data', async () => {
        // Mock the DB call inside enrichAddressReferences
        vi.mocked(prisma.cCAddress.findMany).mockResolvedValueOnce([
            { id: 'addr-123', data: { locality: 'London', postalCode: 'W1' } } as any
        ]);

        const claim = makeClaim({
            id: 'c-t19', fieldNo: 3,
            sourceType: 'USER_INPUT',
            valueJson: { ccAddressId: 'addr-123' },
        });
        const input: BatchResolverInput = {
            subjectLeId: SUBJECT_LE_ID,
            ownerScopeId: null,
            questions: [{ questionId: 'q19', masterFieldNo: 3 }],
            fieldDefMap: new Map([[3, { ...makeDef(3), appDataType: 'ADDRESS' }]]),
            groupFieldMap: new Map(),
            claims: [claim],
            sourceMappings: [],
        };

        const result = await resolveMasterDataBatch(input);

        expect(result['q19']['3'].value).toMatchObject({
            ccAddressId: 'addr-123',
            _resolvedData: {
                ccAddress: expect.objectContaining({
                    data: { locality: 'London', postalCode: 'W1' }
                })
            },
            resolvedSummary: expect.any(String)
        });
    });

    // ── T20: CCAddress projected resolution ──────────────────────────────────

    it('T20: projection postalCode over ccAddressId returns postcode', async () => {
        vi.mocked(prisma.cCAddress.findMany).mockResolvedValueOnce([
            { id: 'addr-123', data: { locality: 'London', postalCode: 'W1' } } as any
        ]);

        const claim = makeClaim({
            id: 'c-t20', fieldNo: 3,
            sourceType: 'USER_INPUT',
            valueJson: { ccAddressId: 'addr-123' },
        });
        const input: BatchResolverInput = {
            subjectLeId: SUBJECT_LE_ID,
            ownerScopeId: null,
            questions: [{ questionId: 'q20', masterFieldNo: 3, masterFieldProjectionPath: 'postalCode' }],
            fieldDefMap: new Map([[3, { ...makeDef(3), appDataType: 'ADDRESS' }]]),
            groupFieldMap: new Map(),
            claims: [claim],
            sourceMappings: [],
        };

        const result = await resolveMasterDataBatch(input);

        // Should return the exact projected value (string)
        expect(result['q20']['3'].value).toBe('W1');
    });

    // ── T21: Parse-before-enrich stringified JSON fallback ───────────────────

    it('T21: stringified JSON address payload is parsed before enrichment and projection', async () => {
        // Mock the DB call inside enrichAddressReferences
        vi.mocked(prisma.cCAddress.findMany).mockResolvedValueOnce([
            { id: 'addr-789', data: { locality: 'Manchester', postalCode: 'M1' } } as any
        ]);

        const claim = makeClaim({
            id: 'c-t21', fieldNo: 3,
            sourceType: 'USER_INPUT',
            // Simulate the bug where the payload is trapped in valueText as stringified JSON
            valueText: JSON.stringify({ ccAddressId: 'addr-789' }),
        });
        const input: BatchResolverInput = {
            subjectLeId: SUBJECT_LE_ID,
            ownerScopeId: null,
            questions: [{ questionId: 'q21', masterFieldNo: 3, masterFieldProjectionPath: 'locality' }],
            fieldDefMap: new Map([[3, { ...makeDef(3), appDataType: 'ADDRESS' }]]),
            groupFieldMap: new Map(),
            claims: [claim],
            sourceMappings: [],
        };

        const result = await resolveMasterDataBatch(input);

        // It should have successfully parsed the string, enriched it with findMany data,
        // and extracted the 'locality' projection path.
        expect(result['q21']['3'].value).toBe('Manchester');
    });

});
