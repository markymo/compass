import { vi } from 'vitest'

const modelMock = () => ({
    findUnique: vi.fn(),
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
})

// We mock specific models used in tests
const prismaMock = {
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    user: modelMock(),
    kycField: modelMock(),
    legalEntity: modelMock(),
    clientLE: modelMock(),
    clientLEOwner: modelMock(),
    identityProfile: modelMock(),
    fieldClaim: modelMock(),
    fIEngagement: modelMock(),
    membership: modelMock(),
    usageLog: modelMock(),
    sourceFieldMapping: modelMock(),   // for KycStateService priority resolution
}

export { prismaMock }
export default prismaMock
