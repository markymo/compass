import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KycLoader } from '../KycLoader';
import { prismaMock } from '@/lib/__mocks__/prisma';
import { getFieldDefinition } from '@/domain/kyc/FieldDefinitions';

// Mock getFieldDefinition
vi.mock('@/domain/kyc/FieldDefinitions', () => ({
    getFieldDefinition: vi.fn(),
    isDocumentOnlyField: vi.fn().mockReturnValue(false),
}));

// Mock FieldGroups
vi.mock('@/domain/kyc/FieldGroups', () => ({
    FIELD_GROUPS: {}
}));

// Mock Prisma
vi.mock('@/lib/prisma');


/* 
 * NOTE: This is a basic test skeleton. 
 * Since the user environment might not have full easy Jest setup for integration,
 * we will focus on unit logic correctness.
 */

describe('KycLoader', () => {
    let loader: KycLoader;

    beforeEach(() => {
        loader = new KycLoader();
        vi.clearAllMocks();
    });

    it('should return null if definition not found', async () => {
        // @ts-ignore
        vi.mocked(getFieldDefinition).mockReturnValue({}); // Empty def/invalid

        // @ts-ignore
        const result = await loader.loadField('le-123', 999);
        expect(result).toBeNull();
    });

    it('should load field value correctly', async () => {
        // Setup mock definition
        const mockDef = {
            fieldNo: 1,
            fieldName: 'Test Field',
            model: 'IdentityProfile',
            field: 'testField',
            isRepeating: false
        };
        // @ts-ignore
        vi.mocked(getFieldDefinition).mockReturnValue(mockDef);

        // Setup prisma mock
        const mockRecord = {
            testField: 'Test Value',
            meta: {
                testField: {
                    source: 'USER',
                    confidence: 0.9
                }
            },
            updatedAt: new Date('2023-01-01')
        };

        // KycLoader maps model 'IdentityProfile' to prisma.identityProfile
        // @ts-ignore
        prismaMock.identityProfile.findUnique.mockResolvedValue(mockRecord);

        const result = await loader.loadField('le-123', 1);

        expect(result).not.toBeNull();
        expect(result?.value).toBe('Test Value');
        expect(result?.source).toBe('USER');
    });


    // Add more tests as we verify environment...
});
