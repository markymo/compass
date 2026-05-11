import { vi } from 'vitest'

const modelMock = {
    findUnique: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
}

// We mock specific models used in tests
const prismaMock = {
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    user: { ...modelMock },
    kycField: { ...modelMock },
    legalEntity: { ...modelMock },
    clientLE: { ...modelMock },
    clientLEOwner: { ...modelMock },
    identityProfile: { ...modelMock },
    fieldClaim: { ...modelMock },
    fIEngagement: { ...modelMock },
    membership: { ...modelMock },
    usageLog: { ...modelMock },
    // Add a generic fallback or just type cast in tests if needed
}

export { prismaMock }
export default prismaMock
