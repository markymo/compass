import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prismaMock } from '@/lib/__mocks__/prisma';

// ── Environment mocks required for every action test ────────────────────────
// next/cache and next-auth transitively import next/server, which is not
// available in the Vitest (Node) environment. Mock the entire chain.
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/prisma');
vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn().mockResolvedValue({ userId: 'test-user' }),
}));
vi.mock('@/actions/admin', () => ({
    isSystemAdmin: vi.fn().mockResolvedValue(true),
}));
vi.mock('@/actions/momentum', () => ({
    captureMomentumObservation: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/services/masterData/definitionService', () => ({
    invalidateDefinitionCache: vi.fn(),
}));


import {
    addFieldToGroup,
    removeGroupItem,
    reorderGroupItems,
    toggleGroupItemPickerVisibility,
    toggleGroupActive,
} from '@/actions/master-data-governance';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ACTIVE_GROUP = { id: 'g-1', key: 'TEST_GROUP', label: 'Test Group', isActive: true };
const ACTIVE_FIELD = { fieldNo: 42, fieldName: 'Test Field', appDataType: 'TEXT', isActive: true };

// ─── addFieldToGroup ─────────────────────────────────────────────────────────

describe('addFieldToGroup', () => {
    beforeEach(() => vi.clearAllMocks());

    it('creates a group item appended at the end', async () => {
        // @ts-ignore
        prismaMock.masterFieldGroup.findUnique.mockResolvedValue(ACTIVE_GROUP);
        // @ts-ignore
        prismaMock.masterFieldDefinition.findUnique.mockResolvedValue(ACTIVE_FIELD);
        // @ts-ignore
        prismaMock.masterFieldGroupItem.findUnique.mockResolvedValue(null); // not already a member
        // @ts-ignore
        prismaMock.masterFieldGroupItem.findFirst.mockResolvedValue({ order: 3 }); // max order = 3
        // @ts-ignore
        prismaMock.masterFieldGroupItem.create.mockResolvedValue({
            id: 'item-new',
            groupId: 'g-1',
            fieldNo: 42,
            order: 4,
            hideFromFieldPicker: true,
        });

        const res = await addFieldToGroup('g-1', 42);

        expect(res.success).toBe(true);
        expect(prismaMock.masterFieldGroupItem.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    groupId: 'g-1',
                    fieldNo: 42,
                    order: 4,              // MAX(3) + 1
                    hideFromFieldPicker: true, // default
                })
            })
        );
    });

    it('defaults hideFromFieldPicker to true', async () => {
        // @ts-ignore
        prismaMock.masterFieldGroup.findUnique.mockResolvedValue(ACTIVE_GROUP);
        // @ts-ignore
        prismaMock.masterFieldDefinition.findUnique.mockResolvedValue(ACTIVE_FIELD);
        // @ts-ignore
        prismaMock.masterFieldGroupItem.findUnique.mockResolvedValue(null);
        // @ts-ignore
        prismaMock.masterFieldGroupItem.findFirst.mockResolvedValue(null); // empty group → order 0
        // @ts-ignore
        prismaMock.masterFieldGroupItem.create.mockResolvedValue({ id: 'item-1' });

        await addFieldToGroup('g-1', 42); // no options

        expect(prismaMock.masterFieldGroupItem.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ hideFromFieldPicker: true })
            })
        );
    });

    it('rejects a duplicate field in the same group', async () => {
        // @ts-ignore
        prismaMock.masterFieldGroup.findUnique.mockResolvedValue(ACTIVE_GROUP);
        // @ts-ignore
        prismaMock.masterFieldDefinition.findUnique.mockResolvedValue(ACTIVE_FIELD);
        // @ts-ignore
        prismaMock.masterFieldGroupItem.findUnique.mockResolvedValue({ id: 'existing-item' }); // already a member

        const res = await addFieldToGroup('g-1', 42);

        expect(res.success).toBe(false);
        expect(res.error).toMatch(/already a member/i);
        expect(prismaMock.masterFieldGroupItem.create).not.toHaveBeenCalled();
    });

    it('rejects when group is not found or inactive', async () => {
        // @ts-ignore
        prismaMock.masterFieldGroup.findUnique.mockResolvedValue(null);

        const res = await addFieldToGroup('g-nonexistent', 42);

        expect(res.success).toBe(false);
        expect(res.error).toMatch(/not found or inactive/i);
        expect(prismaMock.masterFieldGroupItem.create).not.toHaveBeenCalled();
    });

    it('rejects when field is not found or inactive', async () => {
        // @ts-ignore
        prismaMock.masterFieldGroup.findUnique.mockResolvedValue(ACTIVE_GROUP);
        // @ts-ignore
        prismaMock.masterFieldDefinition.findUnique.mockResolvedValue(null);

        const res = await addFieldToGroup('g-1', 999);

        expect(res.success).toBe(false);
        expect(res.error).toMatch(/not found or inactive/i);
        expect(prismaMock.masterFieldGroupItem.create).not.toHaveBeenCalled();
    });
});

// ─── removeGroupItem ─────────────────────────────────────────────────────────

describe('removeGroupItem', () => {
    beforeEach(() => vi.clearAllMocks());

    it('deletes the item by id', async () => {
        // @ts-ignore
        prismaMock.masterFieldGroupItem.delete.mockResolvedValue({ id: 'item-1' });

        const res = await removeGroupItem('item-1');

        expect(res.success).toBe(true);
        expect(prismaMock.masterFieldGroupItem.delete).toHaveBeenCalledWith({
            where: { id: 'item-1' }
        });
    });

    it('returns error when item does not exist', async () => {
        // @ts-ignore
        prismaMock.masterFieldGroupItem.delete.mockRejectedValue(
            new Error('Record to delete does not exist.')
        );

        const res = await removeGroupItem('item-missing');

        expect(res.success).toBe(false);
        expect(res.error).toBeTruthy();
    });
});

// ─── reorderGroupItems ───────────────────────────────────────────────────────

describe('reorderGroupItems', () => {
    beforeEach(() => vi.clearAllMocks());

    it('updates order for all items in the group', async () => {
        const currentItems = [{ id: 'item-a' }, { id: 'item-b' }, { id: 'item-c' }];
        // @ts-ignore
        prismaMock.masterFieldGroupItem.findMany.mockResolvedValue(currentItems);
        // $transaction receives an array of promises — mock it as a resolved value
        // @ts-ignore
        prismaMock.$transaction.mockResolvedValue([{}, {}, {}]);

        const res = await reorderGroupItems('g-1', ['item-c', 'item-a', 'item-b']);

        expect(res.success).toBe(true);
        // $transaction should have been called with the update promises
        expect(prismaMock.$transaction).toHaveBeenCalled();
    });

    it('rejects when supplied list is shorter than group items', async () => {
        // @ts-ignore
        prismaMock.masterFieldGroupItem.findMany.mockResolvedValue([
            { id: 'item-a' }, { id: 'item-b' }, { id: 'item-c' }
        ]);

        const res = await reorderGroupItems('g-1', ['item-a', 'item-b']); // missing item-c

        expect(res.success).toBe(false);
        expect(res.error).toMatch(/group has 3 items/i);
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('rejects when a supplied ID does not belong to the group', async () => {
        // @ts-ignore
        prismaMock.masterFieldGroupItem.findMany.mockResolvedValue([
            { id: 'item-a' }, { id: 'item-b' }
        ]);

        const res = await reorderGroupItems('g-1', ['item-a', 'item-FOREIGN']);

        expect(res.success).toBe(false);
        expect(res.error).toMatch(/does not belong to this group/i);
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });
});

// ─── toggleGroupItemPickerVisibility ─────────────────────────────────────────

describe('toggleGroupItemPickerVisibility', () => {
    beforeEach(() => vi.clearAllMocks());

    it('sets hideFromFieldPicker to the supplied value', async () => {
        // @ts-ignore
        prismaMock.masterFieldGroupItem.update.mockResolvedValue({ id: 'item-1', hideFromFieldPicker: false });

        const res = await toggleGroupItemPickerVisibility('item-1', false);

        expect(res.success).toBe(true);
        expect(prismaMock.masterFieldGroupItem.update).toHaveBeenCalledWith({
            where: { id: 'item-1' },
            data: { hideFromFieldPicker: false }
        });
    });

    it('can re-hide a visible field', async () => {
        // @ts-ignore
        prismaMock.masterFieldGroupItem.update.mockResolvedValue({ id: 'item-1', hideFromFieldPicker: true });

        const res = await toggleGroupItemPickerVisibility('item-1', true);

        expect(res.success).toBe(true);
        expect(prismaMock.masterFieldGroupItem.update).toHaveBeenCalledWith({
            where: { id: 'item-1' },
            data: { hideFromFieldPicker: true }
        });
    });
});

// ─── toggleGroupActive (deactivate path) ─────────────────────────────────────

describe('toggleGroupActive — deactivate', () => {
    beforeEach(() => vi.clearAllMocks());

    it('sets isActive=false on the group', async () => {
        // @ts-ignore — prismaMock type predates masterFieldGroup model
        prismaMock.masterFieldGroup.update.mockResolvedValue({ id: 'g-1', isActive: false });

        const res = await toggleGroupActive('g-1', false);

        expect(res.success).toBe(true);
        expect(prismaMock.masterFieldGroup.update).toHaveBeenCalledWith({
            where: { id: 'g-1' },
            data: { isActive: false }
        });
    });

    it('can reactivate a deactivated group', async () => {
        // @ts-ignore — prismaMock type predates masterFieldGroup model
        prismaMock.masterFieldGroup.update.mockResolvedValue({ id: 'g-1', isActive: true });

        const res = await toggleGroupActive('g-1', true);

        expect(res.success).toBe(true);
        expect(prismaMock.masterFieldGroup.update).toHaveBeenCalledWith({
            where: { id: 'g-1' },
            data: { isActive: true }
        });
    });
});
