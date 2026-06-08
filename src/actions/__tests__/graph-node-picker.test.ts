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
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import prismaMock from '@/lib/__mocks__/prisma';
import { getGraphNodesForPicker } from '@/actions/graph-node-picker';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makePersonNode(overrides: {
    id: string;
    clientLEId: string;
    firstName: string;
    lastName: string;
    nationality?: string;
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
            middleName: null,
            lastName: overrides.lastName,
            primaryNationality: overrides.nationality ?? null,
        },
        legalEntity: null,
        address: null,
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
        const edges = [
            makeEdge('n6', 'DIRECTOR'), // Zara is a director — would have been promoted before the fix
        ];
        (prismaMock as any).clientLEGraphNode = { findMany: vi.fn().mockResolvedValue(nodes) };
        (prismaMock as any).clientLEGraphEdge = { findMany: vi.fn().mockResolvedValue(edges) };

        const result = await getGraphNodesForPicker({
            clientLEId,
            graphNodeType: 'PERSON',
            filterEdgeType: 'DIRECTOR',
        });

        expect(result.success).toBe(true);
        if (!result.success) return;

        // All isPromoted must be false
        expect(result.items.every(i => i.isPromoted === false)).toBe(true);

        // Alphabetical order must be preserved — Alice before Zara even though Zara is a DIRECTOR
        const labels = result.items.map(i => i.displayLabel);
        expect(labels[0]).toBe('Alice Smith');
        expect(labels[1]).toBe('Zara Williams');
    });

    // GP-4: activeEdgeTypes still carries role information for badge rendering
    it('GP-4: activeEdgeTypes is populated from edge map for role badge display', async () => {
        const nodes = [
            makePersonNode({ id: 'n8', clientLEId, firstName: 'Alice', lastName: 'Smith' }),
        ];
        const edges = [
            makeEdge('n8', 'DIRECTOR'),
            makeEdge('n8', 'NAMED_SIGNATORY'),
        ];
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
        const nodes = [
            makePersonNode({ id: 'n9', clientLEId, firstName: 'Jane', lastName: 'Doe', nationality: 'British' }),
        ];
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
        // "Adam Baker" < "Alice Adams" < "Alice Zhao" alphabetically
        expect(labels).toEqual(['Adam Baker', 'Alice Adams', 'Alice Zhao']);
    });
});
