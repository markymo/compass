/**
 * graph-node-picker.test.ts
 *
 * Unit tests for getGraphNodesForPicker (graph-node-picker.ts server action).
 *
 * Behaviour under test:
 *   GP-1  Returns all ClientLEGraphNode rows of the matching nodeType for clientLEId
 *   GP-2  Results are sorted alphabetically ascending by displayLabel
 *   GP-3  A node that has a matching filterEdgeType edge is NOT promoted to top
 *          — isPromoted is always false regardless of filterEdgeType
 *   GP-4  Nodes with filterActiveOnly=false edge are still included (full population)
 *   GP-5  Node from a different clientLE is not returned
 *   GP-6  displayLabel for PERSON is "firstName lastName" (or parts that exist)
 *   GP-7  activeEdgeTypes carries all edge types for the node (used for role badges)
 *   GP-8  Empty graph returns empty array, not an error
 *
 * rawFields behaviour (Phase 1):
 *   RF-1  PERSON node produces rawFields with person field values
 *   RF-2  LEGAL_ENTITY node produces rawFields with LE field values
 *   RF-3  ADDRESS node produces rawFields with address field values
 *   RF-4  rawFields keys match fieldKeys from NODE_FIELD_REGISTRY for the nodeType
 *   RF-5  storagePath resolution — deep values reached correctly
 *   RF-6  displayLabel is unchanged after rawFields addition (regression guard)
 *   RF-7  subLabel is unchanged after rawFields addition (regression guard)
 *   RF-8  rawFields missing values resolve to null, not undefined
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import prismaMock from '@/lib/__mocks__/prisma';
import { getGraphNodesForPicker } from '@/actions/graph-node-picker';
import { getNodeFields } from '@/lib/graph/node-field-registry';

// ── Mock node factories ──────────────────────────────────────────────────────

/**
 * Full PERSON node mock matching the widened registry-driven Prisma select.
 * All optional fields default to null so existing GP tests continue to work
 * without specifying them.
 */
function makePersonNode(overrides: {
    id: string;
    clientLEId: string;
    firstName: string;
    lastName: string;
    middleName?: string | null;
    nationality?: string | null;
    dateOfBirth?: Date | null;
    placeOfBirth?: string | null;
    isPublicFigure?: boolean;
}) {
    return {
        id: overrides.id,
        clientLEId: overrides.clientLEId,
        nodeType: 'PERSON',
        personId: `person-${overrides.id}`,
        legalEntityId: null,
        addressId: null,
        source: 'REGISTRATION_AUTHORITY',
        createdAt: new Date(),
        person: {
            id: `person-${overrides.id}`,
            firstName: overrides.firstName,
            middleName: overrides.middleName ?? null,
            lastName: overrides.lastName,
            dateOfBirth: overrides.dateOfBirth ?? null,
            placeOfBirth: overrides.placeOfBirth ?? null,
            primaryNationality: overrides.nationality ?? null,
            isPublicFigure: overrides.isPublicFigure ?? false,
        },
        legalEntity: null,
        address: null,
    };
}

function makeLeNode(overrides: {
    id: string;
    clientLEId: string;
    name: string;
    localRegistrationNumber?: string | null;
}) {
    return {
        id: overrides.id,
        clientLEId: overrides.clientLEId,
        nodeType: 'LEGAL_ENTITY',
        personId: null,
        legalEntityId: `le-${overrides.id}`,
        addressId: null,
        source: 'REGISTRATION_AUTHORITY',
        createdAt: new Date(),
        person: null,
        legalEntity: {
            id: `le-${overrides.id}`,
            name: overrides.name,
            localRegistrationNumber: overrides.localRegistrationNumber ?? null,
        },
        address: null,
    };
}

function makeAddressNode(overrides: {
    id: string;
    clientLEId: string;
    line1: string;
    line2?: string | null;
    city?: string | null;
    region?: string | null;
    postalCode?: string | null;
    country?: string | null;
}) {
    return {
        id: overrides.id,
        clientLEId: overrides.clientLEId,
        nodeType: 'ADDRESS',
        personId: null,
        legalEntityId: null,
        addressId: `addr-${overrides.id}`,
        source: 'USER_INPUT',
        createdAt: new Date(),
        person: null,
        legalEntity: null,
        address: {
            id: `addr-${overrides.id}`,
            line1: overrides.line1,
            line2: overrides.line2 ?? null,
            city: overrides.city ?? null,
            region: overrides.region ?? null,
            postalCode: overrides.postalCode ?? null,
            country: overrides.country ?? null,
        },
    };
}

function makeEdge(fromNodeId: string, edgeType: string, isActive = true) {
    return { fromNodeId, edgeType, isActive };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('getGraphNodesForPicker', () => {
    const clientLEId = 'le-001';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // GP-1: Returns all matching nodeType nodes for the current LE
    it('GP-1: returns all PERSON nodes for the clientLEId', async () => {
        const nodes = [
            makePersonNode({ id: 'n1', clientLEId, firstName: 'Alice', lastName: 'Smith' }),
            makePersonNode({ id: 'n2', clientLEId, firstName: 'Bob',   lastName: 'Jones' }),
        ];
        (prismaMock as any).clientLEGraphNode = { findMany: vi.fn().mockResolvedValue(nodes) };
        (prismaMock as any).clientLEGraphEdge = { findMany: vi.fn().mockResolvedValue([]) };

        const result = await getGraphNodesForPicker({ clientLEId, graphNodeType: 'PERSON' });

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.items).toHaveLength(2);
        expect(result.items.map(i => i.displayLabel)).toContain('Alice Smith');
        expect(result.items.map(i => i.displayLabel)).toContain('Bob Jones');
    });

    // GP-2: Results are sorted alphabetically ascending
    it('GP-2: results are sorted alphabetically ascending by displayLabel', async () => {
        const nodes = [
            makePersonNode({ id: 'n3', clientLEId, firstName: 'Zara',   lastName: 'Williams' }),
            makePersonNode({ id: 'n4', clientLEId, firstName: 'Alice',  lastName: 'Smith' }),
            makePersonNode({ id: 'n5', clientLEId, firstName: 'Megan',  lastName: 'Brown' }),
        ];
        (prismaMock as any).clientLEGraphNode = { findMany: vi.fn().mockResolvedValue(nodes) };
        (prismaMock as any).clientLEGraphEdge = { findMany: vi.fn().mockResolvedValue([]) };

        const result = await getGraphNodesForPicker({ clientLEId, graphNodeType: 'PERSON' });

        expect(result.success).toBe(true);
        if (!result.success) return;
        const labels = result.items.map(i => i.displayLabel);
        expect(labels).toEqual(['Alice Smith', 'Megan Brown', 'Zara Williams']);
    });

    // GP-3: filterEdgeType does NOT move a node to the top (isPromoted always false)
    it('GP-3: a node with matching filterEdgeType is NOT promoted — isPromoted is always false', async () => {
        const nodes = [
            makePersonNode({ id: 'n6', clientLEId, firstName: 'Zara', lastName: 'Williams' }),
            makePersonNode({ id: 'n7', clientLEId, firstName: 'Alice', lastName: 'Smith' }),
        ];
        const edges = [makeEdge('n6', 'DIRECTOR')];
        (prismaMock as any).clientLEGraphNode = { findMany: vi.fn().mockResolvedValue(nodes) };
        (prismaMock as any).clientLEGraphEdge = { findMany: vi.fn().mockResolvedValue(edges) };

        const result = await getGraphNodesForPicker({
            clientLEId,
            graphNodeType: 'PERSON',
            filterEdgeType: 'DIRECTOR',
        });

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.items.every(i => i.isPromoted === false)).toBe(true);
        const labels = result.items.map(i => i.displayLabel);
        expect(labels[0]).toBe('Alice Smith');
        expect(labels[1]).toBe('Zara Williams');
    });

    // GP-4: activeEdgeTypes still carries role information for badge rendering
    it('GP-4: activeEdgeTypes is populated from edge map for role badge display', async () => {
        const nodes = [makePersonNode({ id: 'n8', clientLEId, firstName: 'Alice', lastName: 'Smith' })];
        const edges = [makeEdge('n8', 'DIRECTOR'), makeEdge('n8', 'NAMED_SIGNATORY')];
        (prismaMock as any).clientLEGraphNode = { findMany: vi.fn().mockResolvedValue(nodes) };
        (prismaMock as any).clientLEGraphEdge = { findMany: vi.fn().mockResolvedValue(edges) };

        const result = await getGraphNodesForPicker({ clientLEId, graphNodeType: 'PERSON' });

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.items[0].activeEdgeTypes).toContain('DIRECTOR');
        expect(result.items[0].activeEdgeTypes).toContain('NAMED_SIGNATORY');
    });

    // GP-5: Returns empty array (not error) when no nodes exist
    it('GP-5: returns empty items array when LE has no nodes of that type', async () => {
        (prismaMock as any).clientLEGraphNode = { findMany: vi.fn().mockResolvedValue([]) };
        (prismaMock as any).clientLEGraphEdge = { findMany: vi.fn().mockResolvedValue([]) };

        const result = await getGraphNodesForPicker({ clientLEId, graphNodeType: 'PERSON' });

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.items).toEqual([]);
    });

    // GP-6: displayLabel for a PERSON uses firstName + lastName
    it('GP-6: displayLabel is "firstName lastName" for a PERSON node', async () => {
        const nodes = [makePersonNode({ id: 'n9', clientLEId, firstName: 'Jane', lastName: 'Doe', nationality: 'British' })];
        (prismaMock as any).clientLEGraphNode = { findMany: vi.fn().mockResolvedValue(nodes) };
        (prismaMock as any).clientLEGraphEdge = { findMany: vi.fn().mockResolvedValue([]) };

        const result = await getGraphNodesForPicker({ clientLEId, graphNodeType: 'PERSON' });

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.items[0].displayLabel).toBe('Jane Doe');
        expect(result.items[0].subLabel).toBe('British');
        expect(result.items[0].personId).toBe('person-n9');
    });

    // GP-7: Nodes from a different LE do not bleed in (Prisma filter test)
    it('GP-7: Prisma query uses WHERE clientLEId so cross-LE nodes are excluded', async () => {
        (prismaMock as any).clientLEGraphNode = { findMany: vi.fn().mockResolvedValue([]) };
        (prismaMock as any).clientLEGraphEdge = { findMany: vi.fn().mockResolvedValue([]) };

        await getGraphNodesForPicker({ clientLEId: 'le-999', graphNodeType: 'PERSON' });

        expect((prismaMock as any).clientLEGraphNode.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ clientLEId: 'le-999' }),
            })
        );
    });

    // GP-8: Multiple nodes with same first letter sort correctly
    it('GP-8: multiple nodes with same first letter are sorted stably', async () => {
        const nodes = [
            makePersonNode({ id: 'na', clientLEId, firstName: 'Alice', lastName: 'Zhao' }),
            makePersonNode({ id: 'nb', clientLEId, firstName: 'Alice', lastName: 'Adams' }),
            makePersonNode({ id: 'nc', clientLEId, firstName: 'Adam',  lastName: 'Baker' }),
        ];
        (prismaMock as any).clientLEGraphNode = { findMany: vi.fn().mockResolvedValue(nodes) };
        (prismaMock as any).clientLEGraphEdge = { findMany: vi.fn().mockResolvedValue([]) };

        const result = await getGraphNodesForPicker({ clientLEId, graphNodeType: 'PERSON' });

        expect(result.success).toBe(true);
        if (!result.success) return;
        const labels = result.items.map(i => i.displayLabel);
        expect(labels).toEqual(['Adam Baker', 'Alice Adams', 'Alice Zhao']);
    });
});

// ── rawFields tests (Phase 1) ─────────────────────────────────────────────────

describe('getGraphNodesForPicker — rawFields (Phase 1)', () => {
    const clientLEId = 'le-rf';

    beforeEach(() => {
        vi.clearAllMocks();
        (prismaMock as any).clientLEGraphEdge = { findMany: vi.fn().mockResolvedValue([]) };
    });

    // RF-1: PERSON node produces rawFields with person field values
    it('RF-1: PERSON node exposes all person fields in rawFields', async () => {
        const dob = new Date('1952-04-30');
        const node = makePersonNode({
            id: 'rf1',
            clientLEId,
            firstName: 'Alan',
            lastName: 'Bennett',
            middleName: null,
            nationality: 'British',
            dateOfBirth: dob,
            placeOfBirth: 'Armley',
            isPublicFigure: false,
        });
        (prismaMock as any).clientLEGraphNode = { findMany: vi.fn().mockResolvedValue([node]) };

        const result = await getGraphNodesForPicker({ clientLEId, graphNodeType: 'PERSON' });

        expect(result.success).toBe(true);
        if (!result.success) return;
        const { rawFields } = result.items[0];

        expect(rawFields.firstName).toBe('Alan');
        expect(rawFields.lastName).toBe('Bennett');
        expect(rawFields.middleName).toBeNull();
        expect(rawFields.primaryNationality).toBe('British');
        expect(rawFields.dateOfBirth).toBe(dob);
        expect(rawFields.placeOfBirth).toBe('Armley');
        expect(rawFields.isPublicFigure).toBe(false);
    });

    // RF-2: LEGAL_ENTITY node produces rawFields with LE field values
    it('RF-2: LEGAL_ENTITY node exposes LE fields in rawFields', async () => {
        const node = makeLeNode({
            id: 'rf2',
            clientLEId,
            name: 'Lynn Wind Farm Ltd',
            localRegistrationNumber: '12345678',
        });
        (prismaMock as any).clientLEGraphNode = { findMany: vi.fn().mockResolvedValue([node]) };

        const result = await getGraphNodesForPicker({ clientLEId, graphNodeType: 'LEGAL_ENTITY' });

        expect(result.success).toBe(true);
        if (!result.success) return;
        const { rawFields } = result.items[0];

        expect(rawFields.name).toBe('Lynn Wind Farm Ltd');
        expect(rawFields.localRegistrationNumber).toBe('12345678');
    });

    // RF-3: ADDRESS node produces rawFields with address field values
    it('RF-3: ADDRESS node exposes address fields in rawFields', async () => {
        const node = makeAddressNode({
            id: 'rf3',
            clientLEId,
            line1: '100 Baker Street',
            line2: 'Flat 1',
            city: 'London',
            region: 'Greater London',
            postalCode: 'W1U 6TY',
            country: 'GB',
        });
        (prismaMock as any).clientLEGraphNode = { findMany: vi.fn().mockResolvedValue([node]) };

        const result = await getGraphNodesForPicker({ clientLEId, graphNodeType: 'ADDRESS' });

        expect(result.success).toBe(true);
        if (!result.success) return;
        const { rawFields } = result.items[0];

        expect(rawFields.line1).toBe('100 Baker Street');
        expect(rawFields.line2).toBe('Flat 1');
        expect(rawFields.city).toBe('London');
        expect(rawFields.region).toBe('Greater London');
        expect(rawFields.postalCode).toBe('W1U 6TY');
        expect(rawFields.country).toBe('GB');
    });

    // RF-4: rawFields keys match fieldKeys from NODE_FIELD_REGISTRY for the nodeType
    it('RF-4: rawFields keys exactly match fieldKeys from NODE_FIELD_REGISTRY', async () => {
        for (const [graphNodeType, makeNode] of [
            ['PERSON',       () => makePersonNode({ id: 'rf4p', clientLEId, firstName: 'A', lastName: 'B' })],
            ['LEGAL_ENTITY', () => makeLeNode({ id: 'rf4l', clientLEId, name: 'Test LE' })],
            ['ADDRESS',      () => makeAddressNode({ id: 'rf4a', clientLEId, line1: '1 Test St' })],
        ] as const) {
            (prismaMock as any).clientLEGraphNode = { findMany: vi.fn().mockResolvedValue([(makeNode as any)()]) };

            const result = await getGraphNodesForPicker({ clientLEId, graphNodeType: graphNodeType as any });

            expect(result.success).toBe(true);
            if (!result.success) continue;

            const expectedKeys = getNodeFields(graphNodeType as any).map(f => f.fieldKey).sort();
            const actualKeys = Object.keys(result.items[0].rawFields).sort();
            expect(actualKeys).toEqual(expectedKeys);
        }
    });

    // RF-5: storagePath resolution — deep values reached correctly
    it('RF-5: storagePath resolves dateOfBirth via person.dateOfBirth correctly', async () => {
        const dob = new Date('1980-06-15');
        const node = makePersonNode({ id: 'rf5', clientLEId, firstName: 'Jo', lastName: 'Test', dateOfBirth: dob });
        (prismaMock as any).clientLEGraphNode = { findMany: vi.fn().mockResolvedValue([node]) };

        const result = await getGraphNodesForPicker({ clientLEId, graphNodeType: 'PERSON' });

        expect(result.success).toBe(true);
        if (!result.success) return;
        // storagePath "person.dateOfBirth" → node.person.dateOfBirth
        expect(result.items[0].rawFields.dateOfBirth).toBe(dob);
    });

    it('RF-5b: storagePath resolves address.region via address.region correctly', async () => {
        const node = makeAddressNode({ id: 'rf5b', clientLEId, line1: '1 St', region: 'Yorkshire' });
        (prismaMock as any).clientLEGraphNode = { findMany: vi.fn().mockResolvedValue([node]) };

        const result = await getGraphNodesForPicker({ clientLEId, graphNodeType: 'ADDRESS' });

        expect(result.success).toBe(true);
        if (!result.success) return;
        // storagePath "address.region" — this field was NOT in the pre-Phase-1 select
        expect(result.items[0].rawFields.region).toBe('Yorkshire');
    });

    // RF-6: displayLabel is unchanged after rawFields addition (regression)
    it('RF-6: displayLabel is unchanged — "firstName lastName" with middleName included when present', async () => {
        const node = makePersonNode({
            id: 'rf6',
            clientLEId,
            firstName: 'Jane',
            middleName: 'Marie',
            lastName: 'Doe',
            nationality: 'French',
        });
        (prismaMock as any).clientLEGraphNode = { findMany: vi.fn().mockResolvedValue([node]) };

        const result = await getGraphNodesForPicker({ clientLEId, graphNodeType: 'PERSON' });

        expect(result.success).toBe(true);
        if (!result.success) return;
        // displayLabel construction is unchanged from pre-Phase-1
        expect(result.items[0].displayLabel).toBe('Jane Marie Doe');
    });

    it('RF-6b: LEGAL_ENTITY displayLabel unchanged — uses name', async () => {
        const node = makeLeNode({ id: 'rf6b', clientLEId, name: 'Acme Corp', localRegistrationNumber: '99999' });
        (prismaMock as any).clientLEGraphNode = { findMany: vi.fn().mockResolvedValue([node]) };

        const result = await getGraphNodesForPicker({ clientLEId, graphNodeType: 'LEGAL_ENTITY' });

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.items[0].displayLabel).toBe('Acme Corp');
        expect(result.items[0].subLabel).toBe('99999');
    });

    it('RF-6c: ADDRESS displayLabel unchanged — joins line1, city, postalCode, country', async () => {
        const node = makeAddressNode({ id: 'rf6c', clientLEId, line1: '100 Baker St', city: 'London', postalCode: 'W1U 6TY', country: 'GB' });
        (prismaMock as any).clientLEGraphNode = { findMany: vi.fn().mockResolvedValue([node]) };

        const result = await getGraphNodesForPicker({ clientLEId, graphNodeType: 'ADDRESS' });

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.items[0].displayLabel).toBe('100 Baker St, London, W1U 6TY, GB');
        expect(result.items[0].subLabel).toBe('GB');
    });

    // RF-7: subLabel is unchanged after rawFields addition (regression)
    it('RF-7: subLabel for PERSON is still primaryNationality', async () => {
        const node = makePersonNode({ id: 'rf7', clientLEId, firstName: 'A', lastName: 'B', nationality: 'Irish' });
        (prismaMock as any).clientLEGraphNode = { findMany: vi.fn().mockResolvedValue([node]) };

        const result = await getGraphNodesForPicker({ clientLEId, graphNodeType: 'PERSON' });

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.items[0].subLabel).toBe('Irish');
    });

    // RF-8: missing fields resolve to null, not undefined
    it('RF-8: rawFields with no entity data present resolves all to null, not undefined', async () => {
        const node = makePersonNode({ id: 'rf8', clientLEId, firstName: 'Sparse', lastName: 'Data' });
        // dateOfBirth, placeOfBirth are null in makePersonNode defaults
        (prismaMock as any).clientLEGraphNode = { findMany: vi.fn().mockResolvedValue([node]) };

        const result = await getGraphNodesForPicker({ clientLEId, graphNodeType: 'PERSON' });

        expect(result.success).toBe(true);
        if (!result.success) return;
        const { rawFields } = result.items[0];

        // All values must be null or a real value — never undefined
        for (const value of Object.values(rawFields)) {
            expect(value).not.toBeUndefined();
        }
        expect(rawFields.dateOfBirth).toBeNull();
        expect(rawFields.placeOfBirth).toBeNull();
        expect(rawFields.middleName).toBeNull();
    });
});
