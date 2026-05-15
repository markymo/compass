/**
 * acceptProposal tests
 *
 * Tests verify that acceptProposal() routes:
 * - RA evidence → RegistryMappingEngine (via stored EnrichmentRun)
 * - GLEIF evidence → GleifNormalizer (unchanged)
 * - Missing EnrichmentRun → safe failure (no fallback to legacy mapper)
 *
 * Testing strategy: EvidenceService is mocked as a class whose getEvidence
 * method is a module-scoped vi.fn() that we control per-test. This is the
 * only reliable way to intercept calls on the module-level singleton instance
 * created inside kyc-proposals.ts, given Vitest's hoisting constraints.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Module-scope spy for EvidenceService.getEvidence ────────────────────────
// Defined BEFORE any mocks so we can reference it inside the factory via
// a wrapper function (avoiding the hoisting temporal-dead-zone issue).
const _getEvidenceMock = vi.fn();
const _normalizeEvidenceMock = vi.fn().mockResolvedValue('evidence-001');

// ─── vi.mock declarations ─────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => ({
    default: {
        evidenceStore: { findUnique: vi.fn(), create: vi.fn() },
        clientLE: { findUnique: vi.fn(), update: vi.fn() },
        registryFetch: { findFirst: vi.fn() },
        enrichmentRun: { findFirst: vi.fn() },
        registryReference: { upsert: vi.fn() },
    },
}));

vi.mock('@/services/kyc/normalization/RegistryMappingEngine', () => ({
    RegistryMappingEngine: { mapEnrichmentRun: vi.fn() },
}));

vi.mock('@/services/kyc/normalization/GleifNormalizer', () => ({
    mapGleifPayloadToFieldCandidates: vi.fn(),
}));

vi.mock('@/services/kyc/normalization/CanonicalRegistryMapper', () => ({
    CanonicalRegistryMapper: { mapToCandidates: vi.fn() },
}));

// EvidenceService must be a class (new-able). The getEvidence and normalizeEvidence
// methods delegate to the module-scope spies via a wrapper function call, which
// IS safe to reference inside a vi.mock factory (unlike direct variable access).
vi.mock('@/services/kyc/EvidenceService', async () => {
    const { vi: _vi } = await import('vitest');
    return {
        EvidenceService: class {
            async getEvidence(id: string) {
                return _getEvidenceMock(id);
            }
            async normalizeEvidence(...args: any[]) {
                return _normalizeEvidenceMock(...args);
            }
        },
    };
});

vi.mock('@/services/kyc/KycWriteService', () => ({
    KycWriteService: class {
        applyFieldCandidate = vi.fn().mockResolvedValue(true);
        evaluateFieldCandidate = vi.fn().mockResolvedValue({ action: 'UPDATE', currentValue: null });
    },
}));

vi.mock('@/domain/registry', () => ({
    initializeRegistryDomain: vi.fn(),
    deriveRegistryReferencesFromGleif: vi.fn().mockReturnValue([]),
    RegistryEnrichmentService: { enrich: vi.fn() },
    RegistryConnectorFactory: { getConnectorForProvider: vi.fn() },
}));

vi.mock('@/domain/kyc/FieldDefinitions', () => ({
    getFieldDefinition: vi.fn().mockReturnValue({ fieldName: 'Test Field', model: 'LegalEntity', field: 'name' }),
}));

vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn().mockResolvedValue({ userId: 'user-001' }),
}));

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
}));

vi.mock('@/actions/gleif', () => ({
    fetchGLEIFData: vi.fn(),
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────
import prisma from '@/lib/prisma';
import { RegistryMappingEngine } from '@/services/kyc/normalization/RegistryMappingEngine';
import { CanonicalRegistryMapper } from '@/services/kyc/normalization/CanonicalRegistryMapper';
import { mapGleifPayloadToFieldCandidates } from '@/services/kyc/normalization/GleifNormalizer';
import { acceptProposal } from '@/actions/kyc-proposals';

const prismaMock = prisma as any;
const engineMock = RegistryMappingEngine as any;
const canonicalMock = CanonicalRegistryMapper as any;
const gleifMock = mapGleifPayloadToFieldCandidates as ReturnType<typeof vi.fn>;

// ────────────────────────────────────────────────────────────────────────────

describe('acceptProposal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Re-apply stable no-op defaults
        _getEvidenceMock.mockResolvedValue(null);
        prismaMock.registryFetch.findFirst.mockResolvedValue(null);
        prismaMock.enrichmentRun.findFirst.mockResolvedValue(null);
        engineMock.mapEnrichmentRun.mockResolvedValue([]);
        gleifMock.mockResolvedValue([]);
    });

    // T9 ─ RA branch uses RegistryMappingEngine, not CanonicalRegistryMapper
    it('T9: RA evidence acceptance calls RegistryMappingEngine, not CanonicalRegistryMapper', async () => {
        _getEvidenceMock.mockResolvedValue({ id: 'evidence-001', provider: 'REGISTRATION_AUTHORITY', payload: {} });
        prismaMock.registryFetch.findFirst.mockResolvedValue({
            evidenceId: 'evidence-001', reference: { clientLEId: 'le-001' },
        });
        prismaMock.enrichmentRun.findFirst.mockResolvedValue({ id: 'run-001', status: 'SUCCESS' });
        engineMock.mapEnrichmentRun.mockResolvedValue([
            { fieldNo: 3, value: 'Test Co', source: 'REGISTRATION_AUTHORITY', evidenceId: 'evidence-001', confidence: 1.0 },
        ]);

        await acceptProposal('le-001', 3, 'evidence-001');

        expect(engineMock.mapEnrichmentRun).toHaveBeenCalledWith('run-001');
        expect(canonicalMock.mapToCandidates).not.toHaveBeenCalled();
    });

    // T10 ─ GLEIF branch calls GleifNormalizer, not RegistryMappingEngine
    it('T10: GLEIF evidence acceptance calls GleifNormalizer, not RegistryMappingEngine', async () => {
        _getEvidenceMock.mockResolvedValue({ id: 'evidence-gleif-001', provider: 'GLEIF', payload: { data: {} } });
        gleifMock.mockResolvedValue([
            { fieldNo: 3, value: 'GLEIF Co', source: 'GLEIF', evidenceId: 'evidence-gleif-001', confidence: 1.0 },
        ]);

        await acceptProposal('le-001', 3, 'evidence-gleif-001');

        expect(gleifMock).toHaveBeenCalled();
        expect(engineMock.mapEnrichmentRun).not.toHaveBeenCalled();
        expect(canonicalMock.mapToCandidates).not.toHaveBeenCalled();
    });

    // T11 ─ Safe fallback when no RegistryFetch found (legacy evidence pre-EnrichmentRun)
    it('T11: returns failure gracefully when no RegistryFetch links evidence to an EnrichmentRun', async () => {
        _getEvidenceMock.mockResolvedValue({ id: 'legacy-001', provider: 'REGISTRATION_AUTHORITY', payload: {} });
        prismaMock.registryFetch.findFirst.mockResolvedValue(null);

        const result = await acceptProposal('le-001', 3, 'legacy-001');

        expect(result.success).toBe(false);
        expect(result.message).toMatch(/no enrichment run/i);
        expect(engineMock.mapEnrichmentRun).not.toHaveBeenCalled();
    });

    // T12 ─ Safe fallback when RegistryFetch exists but no EnrichmentRun found
    it('T12: returns failure gracefully when RegistryFetch exists but no EnrichmentRun found', async () => {
        _getEvidenceMock.mockResolvedValue({ id: 'evidence-002', provider: 'REGISTRATION_AUTHORITY', payload: {} });
        prismaMock.registryFetch.findFirst.mockResolvedValue({
            evidenceId: 'evidence-002', reference: { clientLEId: 'le-002' },
        });
        prismaMock.enrichmentRun.findFirst.mockResolvedValue(null);

        const result = await acceptProposal('le-002', 3, 'evidence-002');

        expect(result.success).toBe(false);
        expect(result.message).toMatch(/no enrichment run/i);
        expect(engineMock.mapEnrichmentRun).not.toHaveBeenCalled();
    });

    // T13 ─ NI/Scotland company (COMPANIES_HOUSE provider variant)
    it('T13: RA acceptance for NI company (COMPANIES_HOUSE provider) calls RegistryMappingEngine with correct run id', async () => {
        _getEvidenceMock.mockResolvedValue({ id: 'ni-evidence-001', provider: 'COMPANIES_HOUSE', payload: {} });
        prismaMock.registryFetch.findFirst.mockResolvedValue({
            evidenceId: 'ni-evidence-001', reference: { clientLEId: 'le-ni-001' },
        });
        prismaMock.enrichmentRun.findFirst.mockResolvedValue({ id: 'run-ni-001', status: 'SUCCESS' });
        engineMock.mapEnrichmentRun.mockResolvedValue([
            { fieldNo: 9, value: 'GB', source: 'REGISTRATION_AUTHORITY', evidenceId: 'ni-evidence-001', confidence: 1.0 },
        ]);

        await acceptProposal('le-ni-001', 9, 'ni-evidence-001');

        expect(engineMock.mapEnrichmentRun).toHaveBeenCalledWith('run-ni-001');
        expect(canonicalMock.mapToCandidates).not.toHaveBeenCalled();
    });
});
