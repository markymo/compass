import { vi } from 'vitest'

const modelMock = () => ({
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn().mockResolvedValue(0),
    upsert: vi.fn(),
})

// We mock the specific Prisma models used across the test suite.
// Add new models here as they are needed by tests.
const prismaMock = {
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    // $transaction: handles both the interactive-transaction (callback) form
    // and the batch-promise (array) form used by reorderGroupItems.
    $transaction: vi.fn().mockImplementation(async (cbOrArray: any) => {
        if (typeof cbOrArray === 'function') return cbOrArray(prismaMock);
        return Promise.all(cbOrArray);
    }),
    user: modelMock(),
    kycField: modelMock(),
    legalEntity: modelMock(),
    person: modelMock(),
    address: modelMock(),
    clientLE: modelMock(),
    clientLEOwner: modelMock(),
    identityProfile: modelMock(),
    fieldClaim: modelMock(),
    fIEngagement: modelMock(),
    membership: modelMock(),
    usageLog: modelMock(),
    sourceFieldMapping: modelMock(),    // KycStateService priority resolution
    masterFieldGroup: modelMock(),      // Group membership actions
    masterFieldGroupItem: modelMock(),  // Group membership actions
    masterFieldDefinition: modelMock(), // Group membership actions / field guards
}

export { prismaMock }
export default prismaMock
