import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KycLoader } from '../KycLoader';
import { prismaMock } from '@/lib/__mocks__/prisma';
import { getFieldDefinition } from '@/domain/kyc/FieldDefinitions';

// Mock getFieldDefinition
vi.mock('@/domain/kyc/FieldDefinitions', () => ({
    getFieldDefinition: vi.fn(),
    isDocumentOnlyField: vi.fn().mockReturnValue(false),
}));

// Mock getMasterFieldGroup (DB-backed — replaces old FIELD_GROUPS mock)
vi.mock('@/services/masterData/definitionService', () => ({
    getMasterFieldGroup: vi.fn(),
}));

// Mock Prisma
vi.mock('@/lib/prisma');

// Mock KycStateService
vi.mock('@/lib/kyc/KycStateService', () => ({
    KycStateService: {
        resolveScopeId: vi.fn().mockResolvedValue(null),
        getAuthoritativeValue: vi.fn().mockResolvedValue(null),
        getAuthoritativeCollection: vi.fn().mockResolvedValue([]),
    }
}));

import { getMasterFieldGroup } from '@/services/masterData/definitionService';
import { KycStateService } from '@/lib/kyc/KycStateService';

describe('KycLoader', () => {
    let loader: KycLoader;

    beforeEach(() => {
        loader = new KycLoader();
        vi.clearAllMocks();
    });

    // ---------------------------------------------------------------------------
    // loadField
    // ---------------------------------------------------------------------------

    it('should return null if definition not found', async () => {
        // @ts-ignore
        vi.mocked(getFieldDefinition).mockReturnValue({}); // Empty def / invalid

        // @ts-ignore
        const result = await loader.loadField('le-123', 999);
        expect(result).toBeNull();
    });

    it('should load field value correctly', async () => {
        const mockDef = {
            fieldNo: 1,
            fieldName: 'Test Field',
            model: 'IdentityProfile',
            field: 'testField',
            isRepeating: false,
            isMultiValue: false,
        };
        // @ts-ignore
        vi.mocked(getFieldDefinition).mockReturnValue(mockDef);

        const mockDerived = {
            value: 'Test Value',
            sourceType: 'USER_INPUT',
            confidenceScore: 0.95,
            assertedAt: new Date('2023-01-01'),
            isScoped: false,
            evidenceProvider: null,
        };

        // @ts-ignore
        vi.mocked(KycStateService.getAuthoritativeValue).mockResolvedValue(mockDerived);

        const result = await loader.loadField('le-123', 1);

        expect(result).not.toBeNull();
        expect(result?.value).toBe('Test Value');
        expect(result?.source).toBe('USER_INPUT');
    });

    // ---------------------------------------------------------------------------
    // loadGroup — DB-backed via getMasterFieldGroup
    // ---------------------------------------------------------------------------

    it('loadGroup: loads fields listed in DB group items', async () => {
        // Arrange: DB group with two fields
        const mockGroup = {
            id: 'group-1',
            key: 'REGISTERED_ADDRESS',
            label: 'Registered Address',
            isActive: true,
            items: [
                { id: 'item-1', fieldNo: 6, order: 0 },
                { id: 'item-2', fieldNo: 7, order: 1 },
            ],
        };
        vi.mocked(getMasterFieldGroup as any).mockResolvedValue(mockGroup);

        // CLIENT_LE path: prisma.clientLE.findUnique must return a legalEntityId
        // @ts-ignore
        prismaMock.clientLE.findUnique.mockResolvedValue({ legalEntityId: 'le-resolved' });

        // loadField will call KycStateService.getAuthoritativeValue for each field
        // @ts-ignore
        vi.mocked(getFieldDefinition).mockImplementation((fieldNo: number) => ({
            fieldNo,
            fieldName: `Field ${fieldNo}`,
            isMultiValue: false,
            isRepeating: false,
        }));

        vi.mocked(KycStateService.getAuthoritativeValue as any).mockImplementation(async (_subject: any, fieldNo: number) => ({
            value: `value-for-${fieldNo}`,
            sourceType: 'GLEIF',
            confidenceScore: 1.0,
            assertedAt: new Date('2024-01-01'),
            isScoped: false,
            evidenceProvider: null,
        }));

        // Act
        const result = await loader.loadGroup('clientle-abc', 'REGISTERED_ADDRESS', 'CLIENT_LE');

        // Assert: getMasterFieldGroup was called with the correct key
        expect(getMasterFieldGroup).toHaveBeenCalledWith('REGISTERED_ADDRESS');

        // Assert: results keyed by fieldNo contain both fields
        expect(result[6]).not.toBeNull();
        expect(result[6]?.value).toBe('value-for-6');
        expect(result[7]).not.toBeNull();
        expect(result[7]?.value).toBe('value-for-7');

        // Assert: only fields from the DB group items are loaded (not the old hardcoded set)
        expect(Object.keys(result)).toHaveLength(2);
        expect(Object.keys(result).map(Number)).toEqual(expect.arrayContaining([6, 7]));
    });

    it('loadGroup: throws clearly for an unknown group key', async () => {
        // getMasterFieldGroup throws the DB-backed error message
        vi.mocked(getMasterFieldGroup as any).mockRejectedValue(
            new Error('Unknown or Inactive Field Group: NONEXISTENT_GROUP')
        );

        await expect(
            loader.loadGroup('clientle-abc', 'NONEXISTENT_GROUP', 'CLIENT_LE')
        ).rejects.toThrow('Unknown or Inactive Field Group: NONEXISTENT_GROUP');
    });

    it('loadGroup: throws clearly for an inactive group', async () => {
        vi.mocked(getMasterFieldGroup as any).mockRejectedValue(
            new Error('Unknown or Inactive Field Group: RETIRED_GROUP')
        );

        await expect(
            loader.loadGroup('clientle-abc', 'RETIRED_GROUP')
        ).rejects.toThrow('Unknown or Inactive Field Group: RETIRED_GROUP');
    });

    it('loadGroup: returns empty object when group has no items', async () => {
        const emptyGroup = {
            id: 'group-empty',
            key: 'EMPTY_GROUP',
            label: 'Empty',
            isActive: true,
            items: [],
        };
        vi.mocked(getMasterFieldGroup as any).mockResolvedValue(emptyGroup);

        const result = await loader.loadGroup('clientle-abc', 'EMPTY_GROUP');
        expect(result).toEqual({});
    });

    it('loadGroup: does NOT use FIELD_GROUPS — only DB items drive field loading', async () => {
        // This is the regression guard: the DB group has field 6 only.
        // FieldGroups.ts (if it were consulted) would have [6,7,8,9,10].
        // Confirm that only field 6 appears in the result.
        const dbGroup = {
            id: 'group-narrow',
            key: 'REGISTERED_ADDRESS',
            label: 'Registered Address',
            isActive: true,
            items: [{ id: 'item-1', fieldNo: 6, order: 0 }], // only field 6
        };
        vi.mocked(getMasterFieldGroup as any).mockResolvedValue(dbGroup);

        // @ts-ignore
        vi.mocked(getFieldDefinition).mockReturnValue({ fieldNo: 6, isMultiValue: false, isRepeating: false });

        // CLIENT_LE path: prisma.clientLE.findUnique must return a legalEntityId
        // @ts-ignore
        prismaMock.clientLE.findUnique.mockResolvedValue({ legalEntityId: 'le-resolved' });

        vi.mocked(KycStateService.getAuthoritativeValue as any).mockResolvedValue({
            value: 'Line 1',
            sourceType: 'GLEIF',
            confidenceScore: 1.0,
            assertedAt: new Date(),
            isScoped: false,
            evidenceProvider: null,
        });

        const result = await loader.loadGroup('clientle-abc', 'REGISTERED_ADDRESS');

        // Should have exactly 1 key (field 6), not 5 from the old hardcoded list
        expect(Object.keys(result)).toHaveLength(1);
        expect(result[6]).not.toBeNull();
        expect(result[7]).toBeUndefined();
    });
});
