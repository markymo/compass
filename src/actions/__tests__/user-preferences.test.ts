import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock getIdentity
vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn().mockResolvedValue({ userId: 'user-123' }),
}));

// Shared mocks
const mockClientLEFindMany = vi.fn();
const mockClientLEFindFirst = vi.fn();
const mockUserFindUnique = vi.fn();
const mockUserUpdate = vi.fn();

vi.mock('@/lib/prisma', () => ({
    default: {
        clientLE: {
            findMany: (...args: any[]) => mockClientLEFindMany(...args),
            findFirst: (...args: any[]) => mockClientLEFindFirst(...args),
        },
        user: {
            findUnique: (...args: any[]) => mockUserFindUnique(...args),
            update: (...args: any[]) => mockUserUpdate(...args),
        },
    },
}));

import {
    listSelectableClientLEs,
    updateDefaultMappingCompany,
    getEffectiveMappingDefaults
} from '../user-preferences';

describe('user-preferences actions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('listSelectableClientLEs', () => {
        it('returns list of companies', async () => {
            const mockList = [
                { id: 'le-1', name: 'Company 1', lei: '12345678901234567890' },
                { id: 'le-2', name: 'Company 2', lei: null },
            ];
            mockClientLEFindMany.mockResolvedValue(mockList);

            const result = await listSelectableClientLEs();
            expect(result.success).toBe(true);
            expect(result.companies).toEqual(mockList);
            expect(mockClientLEFindMany).toHaveBeenCalledWith({
                where: { isDeleted: false },
                select: {
                    id: true,
                    name: true,
                    lei: true,
                    registryReferences: {
                        select: {
                            registryAuthorityId: true,
                            localRegistrationNumber: true
                        }
                    }
                },
                orderBy: { name: 'asc' },
            });
        });
    });

    describe('updateDefaultMappingCompany', () => {
        it('updates user preference successfully', async () => {
            mockClientLEFindFirst.mockResolvedValue({ id: 'le-1', isDeleted: false });
            mockUserFindUnique.mockResolvedValue({ preferences: { existingPref: 'yes' } });
            mockUserUpdate.mockResolvedValue({});

            const result = await updateDefaultMappingCompany('le-1');
            expect(result.success).toBe(true);
            expect(mockUserUpdate).toHaveBeenCalledWith({
                where: { id: 'user-123' },
                data: {
                    preferences: {
                        existingPref: 'yes',
                        rddDefaultMappingCompanyId: 'le-1',
                    },
                },
            });
        });

        it('returns error if clientLeId does not exist', async () => {
            mockClientLEFindFirst.mockResolvedValue(null);

            const result = await updateDefaultMappingCompany('invalid-id');
            expect(result.success).toBe(false);
            expect(result.error).toBe('ClientLE not found or deleted');
        });
    });

    describe('getEffectiveMappingDefaults', () => {
        it('returns empty defaults if preference is not set', async () => {
            mockUserFindUnique.mockResolvedValue({ preferences: {} });

            const result = await getEffectiveMappingDefaults();
            expect(result).toEqual({});
        });

        it('clears preference if company does not exist', async () => {
            mockUserFindUnique.mockResolvedValue({ preferences: { rddDefaultMappingCompanyId: 'le-missing' } });
            mockClientLEFindFirst.mockResolvedValue(null);
            mockUserUpdate.mockResolvedValue({});

            const result = await getEffectiveMappingDefaults();
            expect(result).toEqual({});
            expect(mockUserUpdate).toHaveBeenCalledWith({
                where: { id: 'user-123' },
                data: { preferences: {} },
            });
        });

        it('resolves LEI and registry references when set', async () => {
            mockUserFindUnique.mockResolvedValue({ preferences: { rddDefaultMappingCompanyId: 'le-1' } });
            mockClientLEFindFirst.mockResolvedValue({
                id: 'le-1',
                name: 'Diamond Transmission Partners Hornsea Two Limited',
                lei: '213800SN8QHYGA7QUF79',
                registryReferences: [
                    { registryAuthorityId: 'RA000585', localRegistrationNumber: '14059418' },
                    { registryAuthorityId: 'RA000192', localRegistrationNumber: '542051180' },
                ],
            });

            const result = await getEffectiveMappingDefaults();
            expect(result).toEqual({
                selectedCompanyId: 'le-1',
                selectedCompanyName: 'Diamond Transmission Partners Hornsea Two Limited',
                gleifLei: '213800SN8QHYGA7QUF79',
                registryOverrides: {
                    RA000585: { registeredAs: '14059418' },
                    RA000192: { registeredAs: '542051180' },
                },
            });
        });
    });
});
