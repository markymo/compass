import { vi } from 'vitest'

const modelMock = {
    findUnique: vi.fn(),
    findMany: vi.fn(),
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
    identityProfile: { ...modelMock },
    legalEntity: { ...modelMock },
    // Add a generic fallback or just type cast in tests if needed
}

export { prismaMock }
export default prismaMock
