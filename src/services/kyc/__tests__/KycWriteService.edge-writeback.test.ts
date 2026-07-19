/**
 * KycWriteService.edge-writeback.test.ts
 *
 * Regression tests for the graph edge write-back behaviour in
 * KycWriteService.updateField() / performEdgeWriteback().
 *
 * Critical invariant:
 *   When an existing (non-tombstone) FieldClaim is found during the idempotency
 *   check, the graph edge write-back must STILL run so that:
 *   - FieldClaims written before a MasterFieldGraphBinding was configured gain
 *     their missing DIRECTOR/PSC edges on the next re-enrichment.
 *   - Re-enrichment after admin binding setup does not require deleting claims.
 *
 * Tests:
 *
 *   EW-1: Normal write path — fresh field 63 value → edge created (sanity check)
 *   EW-2: Idempotency path — existing claim + active binding + no edge
 *          → re-enrichment still calls edge upsert
 *   EW-3: Idempotency path — existing claim + NO binding → edge NOT attempted
 *   EW-4: Idempotency path — USER_INPUT tombstone → no edge attempt (user exclusion wins)
 *   EW-5: Idempotency path — existing claim + active binding + edge already exists
 *          → upsert called (idempotent, no duplicate)
 *   EW-6: Edge write-back failure is swallowed — updateField still returns true
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SourceType, ClaimStatus } from '@prisma/client';

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@/lib/prisma');
vi.mock('@/services/masterData/definitionService');
vi.mock('@/lib/kyc/KycStateService');
vi.mock('@/lib/kyc/FieldClaimService');
vi.mock('@/lib/master-data/complex-field-config');
vi.mock('@/lib/master-data/field-types', () => ({
    APP_DATA_TYPES: {
        DOCUMENT_REF: 'DOCUMENT_REF',
        JSONB: 'JSONB',
        PARTY_REF: 'PARTY_REF',
        PERSON_REF: 'PERSON_REF',
    },
    isKnownAppDataType: () => true,
}));
vi.mock('@/lib/kyc/source-priority-config', () => ({
    getFallbackPriority: () => 500,
    USER_INPUT_PRIORITY: 0,
}));

import prismaMock from '@/lib/__mocks__/prisma';
import { getMasterFieldDefinition, listAllMasterGroupsWithItems } from '@/services/masterData/definitionService';
import { KycStateService } from '@/lib/kyc/KycStateService';
import { FieldClaimService } from '@/lib/kyc/FieldClaimService';
import { getComplexFieldConfig } from '@/lib/master-data/complex-field-config';
import { KycWriteService } from '@/services/kyc/KycWriteService';

// ── Constants ─────────────────────────────────────────────────────────────────

const CLIENT_LE_ID = 'client-le-abc';
const PERSON_ID    = 'person-director-1';
const GRAPH_NODE_ID = 'graph-node-director-1';
const ROOT_NODE_ID  = 'graph-node-root-le';
const ROOT_LE_ID    = 'legal-entity-root';
const INSTANCE_ID   = 'ch_2024-01-01_smith_j';
const FIELD_NO      = 63;

// ── Field definition (field 63 — PARTY_REF, isMultiValue) ────────────────────

const FIELD_63_DEF = {
    fieldNo: FIELD_NO,
    fieldName: 'List of company directors',
    appDataType: 'PARTY_REF',
    isMultiValue: true,
    modelField: null,
    categoryId: 'DIRECTORS',
    options: [],
};

// ── Graph binding with writeBackEdgeType ──────────────────────────────────────

const ACTIVE_DIRECTOR_BINDING = {
    id: 'binding-1',
    fieldNo: FIELD_NO,
    isActive: true,
    writeBackEdgeType: 'DIRECTOR',
    graphNodeType: 'PERSON',
};

// ── FieldClaim stub (existing non-tombstone director claim) ───────────────────

function makeExistingDirectorClaim(overrides: Record<string, any> = {}): any {
    return {
        id: 'existing-director-claim-1',
        fieldNo: FIELD_NO,
        subjectLeId: ROOT_LE_ID,
        clientLEId: CLIENT_LE_ID,
        instanceId: INSTANCE_ID,
        collectionId: 'DIRECTORS',
        sourceType: SourceType.REGISTRATION_AUTHORITY,
        valueJson: { metadata_type: 'PERSON', firstName: 'John', lastName: 'Smith' },
        valuePersonId: PERSON_ID,
        valueLeId: null,
        valueAddressId: null,
        assertedAt: new Date('2026-01-01T10:00:00Z'),
        status: ClaimStatus.ASSERTED,
        ...overrides,
    };
}

const RA_PROVENANCE = {
    source: 'REGISTRATION_AUTHORITY' as any,
    reason: 'RA000585',
};

// ── Setup ─────────────────────────────────────────────────────────────────────

describe('KycWriteService.performEdgeWriteback — graph edge regression', () => {
    let service: KycWriteService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new KycWriteService();

        // Field 63 definition
        (getMasterFieldDefinition as any).mockResolvedValue(FIELD_63_DEF);

        // evaluateOverwrite — allowed
        (KycStateService.getAuthoritativeValue as any).mockResolvedValue(null);
        (KycStateService.getAuthoritativeCollection as any).mockResolvedValue([]);
        (prismaMock.sourceFieldMapping as any).findMany = vi.fn().mockResolvedValue([]);
        
        (prismaMock as any).person = {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({ id: PERSON_ID }),
        };

        // complex-field-config: field 63 → DIRECTORS collection
        (getComplexFieldConfig as any).mockImplementation((no: number) =>
            no === FIELD_NO ? { collectionId: 'DIRECTORS', kind: 'GRAPH_RELATIONSHIP_COLLECTION' } : undefined
        );
        // FieldClaimService.assertClaim
        (FieldClaimService.assertClaim as any).mockResolvedValue({ id: 'new-claim-1' });

        // propagateToQuestions dependencies
        (listAllMasterGroupsWithItems as any).mockResolvedValue([]);
        (prismaMock as any).question = { findMany: vi.fn().mockResolvedValue([]) };

        // Default graph bindings: active DIRECTOR binding for field 63
        (prismaMock as any).masterFieldGraphBinding = {
            findMany: vi.fn().mockResolvedValue([ACTIVE_DIRECTOR_BINDING]),
        };

        // Default: person graph node exists for this clientLE+personId
        (prismaMock as any).clientLEGraphNode = {
            findFirst: vi.fn().mockImplementation((args: any) => {
                if (args?.where?.legalEntityId === ROOT_LE_ID) {
                    return Promise.resolve({ id: ROOT_NODE_ID, nodeType: 'LEGAL_ENTITY', legalEntityId: ROOT_LE_ID });
                }
                if (args?.where?.personId === PERSON_ID) {
                    return Promise.resolve({ id: GRAPH_NODE_ID, nodeType: 'PERSON', personId: PERSON_ID });
                }
                return Promise.resolve(null);
            }),
            create: vi.fn().mockResolvedValue({ id: ROOT_NODE_ID }),
        };

        // Default: clientLE exists with a root legalEntityId
        (prismaMock.clientLE as any).findUnique = vi.fn().mockResolvedValue({
            id: CLIENT_LE_ID,
            legalEntityId: ROOT_LE_ID,
        });

        // Default: ensureLegalEntity (entityType CLIENT_LE path)
        (prismaMock.clientLE as any).findFirst = vi.fn().mockResolvedValue({
            id: CLIENT_LE_ID,
            legalEntityId: ROOT_LE_ID,
        });

        // legalEntity for ensureLegalEntity
        (prismaMock.legalEntity as any) = {
            findFirst: vi.fn().mockResolvedValue({ id: ROOT_LE_ID }),
            create: vi.fn().mockResolvedValue({ id: ROOT_LE_ID }),
        };

        // Edge upsert — succeeds
        (prismaMock as any).clientLEGraphEdge = {
            upsert: vi.fn().mockResolvedValue({ id: 'edge-1' }),
            findMany: vi.fn().mockResolvedValue([]),
        };

        // No existing claim by default (overridden per test)
        (prismaMock.fieldClaim as any).findFirst = vi.fn().mockResolvedValue(null);
        (prismaMock.fieldClaim as any).create = vi.fn().mockResolvedValue({ id: 'new-claim-1' });
    });

    // ── EW-1: performEdgeWriteback directly — creates edge when node exists ───

    it('EW-1: performEdgeWriteback directly — creates DIRECTOR edge when binding and node exist', async () => {
        await (service as any).performEdgeWriteback(
            FIELD_NO,
            CLIENT_LE_ID,
            PERSON_ID,   // valuePersonId
            undefined,   // valueLeId
            undefined,   // valueAddressId
            'REGISTRATION_AUTHORITY',
        );

        expect((prismaMock as any).clientLEGraphEdge.upsert).toHaveBeenCalledTimes(1);
        expect((prismaMock as any).clientLEGraphEdge.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    fromNodeId_toNodeId_edgeType: expect.objectContaining({
                        fromNodeId: GRAPH_NODE_ID,
                        toNodeId: ROOT_NODE_ID,
                        edgeType: 'DIRECTOR',
                    }),
                }),
                create: expect.objectContaining({ edgeType: 'DIRECTOR', isActive: true }),
            })
        );
    });

    // ── EW-2: Idempotency path — existing claim + binding → edge still upserted

    it('EW-2 [regression]: existing non-tombstone claim + active binding → edge write-back still runs', async () => {
        // Simulate: FieldClaim exists (from before the binding was set up)
        const claim = makeExistingDirectorClaim();
        (KycStateService.getAuthoritativeCollection as any).mockResolvedValue([{ ...claim, value: claim.valueJson }]);
        (prismaMock.fieldClaim as any).findFirst = vi.fn().mockResolvedValue(claim);

        const result = await (service as any).updateField(
            CLIENT_LE_ID,
            FIELD_NO,
            { metadata_type: 'PERSON', firstName: 'John', lastName: 'Smith' },
            RA_PROVENANCE,
            INSTANCE_ID,
            'CLIENT_LE'
        );

        // Claim write still skipped (idempotency)
        expect(result).toBe(true);
        expect(FieldClaimService.assertClaim).not.toHaveBeenCalled();

        // But edge write-back MUST have run
        expect((prismaMock as any).clientLEGraphEdge.upsert).toHaveBeenCalledTimes(1);
        expect((prismaMock as any).clientLEGraphEdge.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    fromNodeId_toNodeId_edgeType: expect.objectContaining({
                        fromNodeId: GRAPH_NODE_ID,
                        toNodeId: ROOT_NODE_ID,
                        edgeType: 'DIRECTOR',
                    }),
                }),
                create: expect.objectContaining({
                    clientLEId: CLIENT_LE_ID,
                    edgeType: 'DIRECTOR',
                    isActive: true,
                }),
                update: expect.objectContaining({ isActive: true }),
            })
        );
    });

    // ── EW-3: Idempotency path — existing claim + NO binding → no edge attempt

    it('EW-3: existing claim + no active binding → edge NOT created', async () => {
        // No binding for this field
        (prismaMock as any).masterFieldGraphBinding = {
            findMany: vi.fn().mockResolvedValue([]),
        };
        (prismaMock.fieldClaim as any).findFirst = vi.fn().mockResolvedValue(
            makeExistingDirectorClaim()
        );

        const result = await (service as any).updateField(
            CLIENT_LE_ID,
            FIELD_NO,
            { metadata_type: 'PERSON', firstName: 'John', lastName: 'Smith' },
            RA_PROVENANCE,
            INSTANCE_ID,
            'CLIENT_LE'
        );

        expect(result).toBe(true);
        expect((prismaMock as any).clientLEGraphEdge.upsert).not.toHaveBeenCalled();
    });

    // ── EW-4: USER_INPUT tombstone → no edge attempt (user exclusion wins)

    it('EW-4: USER_INPUT tombstone for instanceId → edge write-back NOT attempted', async () => {
        (prismaMock.fieldClaim as any).findFirst = vi.fn().mockResolvedValue(
            makeExistingDirectorClaim({
                sourceType: SourceType.USER_INPUT,
                valueJson: { tombstone: true },
                valuePersonId: PERSON_ID, // has a personId but claim is a tombstone
            })
        );

        const result = await (service as any).updateField(
            CLIENT_LE_ID,
            FIELD_NO,
            { metadata_type: 'PERSON', firstName: 'John', lastName: 'Smith' },
            RA_PROVENANCE,
            INSTANCE_ID,
            'CLIENT_LE'
        );

        expect(result).toBe(true);
        // User exclusion exits before edge write-back
        expect((prismaMock as any).clientLEGraphEdge.upsert).not.toHaveBeenCalled();
    });

    // ── EW-5: Edge already exists → upsert still called (idempotent)

    it('EW-5: existing claim + existing edge → upsert called (idempotent, no error)', async () => {
        const claim = makeExistingDirectorClaim();
        (KycStateService.getAuthoritativeCollection as any).mockResolvedValue([{ ...claim, value: claim.valueJson }]);
        (prismaMock.fieldClaim as any).findFirst = vi.fn().mockResolvedValue(claim);
        // Edge already exists — upsert is idempotent
        (prismaMock as any).clientLEGraphEdge.upsert = vi.fn().mockResolvedValue({
            id: 'edge-1',
            edgeType: 'DIRECTOR',
            isActive: true,
        });

        const result = await (service as any).updateField(
            CLIENT_LE_ID,
            FIELD_NO,
            { metadata_type: 'PERSON', firstName: 'John', lastName: 'Smith' },
            RA_PROVENANCE,
            INSTANCE_ID,
            'CLIENT_LE'
        );

        expect(result).toBe(true);
        expect((prismaMock as any).clientLEGraphEdge.upsert).toHaveBeenCalledTimes(1);
    });

    // ── EW-6: Edge write-back failure is swallowed — updateField still returns true

    it('EW-6: edge write-back failure is caught and swallowed — updateField returns true', async () => {
        const claim = makeExistingDirectorClaim();
        (KycStateService.getAuthoritativeCollection as any).mockResolvedValue([{ ...claim, value: claim.valueJson }]);
        (prismaMock.fieldClaim as any).findFirst = vi.fn().mockResolvedValue(claim);
        // Simulate DB failure in edge upsert
        (prismaMock as any).clientLEGraphEdge.upsert = vi.fn().mockRejectedValue(
            new Error('Unique constraint violation')
        );

        const result = await (service as any).updateField(
            CLIENT_LE_ID,
            FIELD_NO,
            { metadata_type: 'PERSON', firstName: 'John', lastName: 'Smith' },
            RA_PROVENANCE,
            INSTANCE_ID,
            'CLIENT_LE'
        );

        // Error is caught inside performEdgeWriteback — must not propagate
        expect(result).toBe(true);
    });

    // ── EW-7: Existing claim has no valuePersonId (e.g. JSONB-only) → no edge

    it('EW-7: existing claim with null valuePersonId/valueLeId → edge write-back skipped gracefully', async () => {
        const claim = makeExistingDirectorClaim({
            valuePersonId: null,
            valueLeId: null,
            valueAddressId: null,
        });
        (KycStateService.getAuthoritativeCollection as any).mockResolvedValue([{ ...claim, value: claim.valueJson }]);
        (prismaMock.fieldClaim as any).findFirst = vi.fn().mockResolvedValue(claim);

        const result = await (service as any).updateField(
            CLIENT_LE_ID,
            FIELD_NO,
            { metadata_type: 'PERSON', firstName: 'John', lastName: 'Smith' },
            RA_PROVENANCE,
            INSTANCE_ID,
            'CLIENT_LE'
        );

        expect(result).toBe(true);
        expect((prismaMock as any).clientLEGraphEdge.upsert).not.toHaveBeenCalled();
    });
});
