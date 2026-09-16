/**
 * refreshGleifProposals — regression tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Module-scope spies ───────────────────────────────────────────────────────
const mocks = vi.hoisted(() => {
    return {
        _normalizeEvidenceMock: vi.fn().mockResolvedValue('evidence-gleif-001'),
        _getMasterFieldDefinitionMock: vi.fn(),
        _applyFieldCandidateMock: vi.fn().mockResolvedValue(true),
        _evaluateFieldCandidateMock: vi.fn().mockResolvedValue({
            action: 'PROPOSE_UPDATE',
            currentValue: null,
            currentSource: undefined,
            reason: 'No existing record',
        })
    };
});

// ─── vi.mock declarations ─────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => ({
    default: {
        clientLE: {
            findUnique: vi.fn().mockResolvedValue({ legalEntityId: 'le-001', lei: '213800TEST0000000001' }),
            update: vi.fn().mockResolvedValue({}),
        },
        registryReference: { upsert: vi.fn() },
        registryAuthority: { findUnique: vi.fn(), upsert: vi.fn() },
        fIEngagement: { findMany: vi.fn().mockResolvedValue([]) },
        masterFieldGroup: { findMany: vi.fn().mockResolvedValue([]) },
    },
}));

vi.mock('@/services/masterData/definitionService', () => ({
    getMasterFieldDefinition: (...args: any[]) => mocks._getMasterFieldDefinitionMock(...args),
    listAllMasterGroupsWithItems: vi.fn().mockResolvedValue([]),
    refreshDefinitionCache: vi.fn(),
}));

vi.mock('@/services/kyc/EvidenceService', () => ({
    EvidenceService: class {
        async normalizeEvidence(...args: any[]) { return mocks._normalizeEvidenceMock(...args); }
    },
}));

vi.mock('@/services/kyc/normalization/GleifNormalizer', () => ({
    mapGleifPayloadToFieldCandidates: vi.fn(),
}));

vi.mock('@/services/kyc/KycWriteService', () => ({
    KycWriteService: class {
        evaluateFieldCandidate = mocks._evaluateFieldCandidateMock;
        applyFieldCandidate = mocks._applyFieldCandidateMock;
    },
}));

vi.mock('@/lib/kyc/KycStateService', () => ({
    KycStateService: { getAuthoritativeValue: vi.fn().mockResolvedValue(null) },
}));

vi.mock('@/domain/registry', () => ({
    initializeRegistryDomain: vi.fn(),
    deriveRegistryReferencesFromGleif: vi.fn().mockReturnValue([]),
    RegistryEnrichmentService: { enrich: vi.fn() },
    RegistryConnectorFactory: {},
}));

vi.mock('@/actions/gleif', () => ({
    fetchGLEIFData: vi.fn().mockResolvedValue({
        success: true,
        data: { data: { attributes: { lei: '213800TEST0000000001' } } },
    }),
}));

vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn().mockResolvedValue({ userId: 'user-001' }),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

// ─── Imports (after mocks) ────────────────────────────────────────────────────
import { mapGleifPayloadToFieldCandidates } from '@/services/kyc/normalization/GleifNormalizer';
import { refreshGleifProposals } from '@/actions/kyc-proposals';
import { deriveRegistryReferencesFromGleif, RegistryEnrichmentService } from '@/domain/registry';
import prisma from '@/lib/prisma';

const gleifNormalizerMock = mapGleifPayloadToFieldCandidates as ReturnType<typeof vi.fn>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeDbField(fieldNo: number, fieldName: string, category = 'Identity') {
    return {
        fieldNo,
        fieldName,
        appDataType: 'TEXT',
        isMultiValue: false,
        isActive: true,
        modelField: 'someColumn',
        masterDataCategory: { displayName: category },
    };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('refreshGleifProposals — auto-apply and notify flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks._normalizeEvidenceMock.mockResolvedValue('evidence-gleif-001');
        mocks._evaluateFieldCandidateMock.mockResolvedValue({
            action: 'PROPOSE_UPDATE',
            currentValue: null,
            currentSource: undefined,
            reason: 'No existing record',
        });
    });

    it('T1: winning trusted source update auto-applies', async () => {
        gleifNormalizerMock.mockResolvedValue([
            { fieldNo: 3, value: 'ZZOOMM PLC', source: 'GLEIF', evidenceId: 'ev-001', confidence: 1.0 },
        ]);

        mocks._getMasterFieldDefinitionMock.mockImplementation(async (n: number) => makeDbField(3, 'Legal name'));

        const result = await refreshGleifProposals('client-le-001');

        expect(result.success).toBe(true);
        expect(result.proposals).toHaveLength(1);
        expect(result.proposals![0].action).toBe('AUTO_APPLIED');
        expect(mocks._applyFieldCandidateMock).toHaveBeenCalledTimes(1);
        expect(mocks._applyFieldCandidateMock).toHaveBeenCalledWith('client-le-001', expect.anything(), 'user-001', 'CLIENT_LE');
    });

    it('T2: trusted source update blocked by USER_INPUT', async () => {
        gleifNormalizerMock.mockResolvedValue([
            { fieldNo: 3, value: 'ZZOOMM PLC', source: 'GLEIF', evidenceId: 'ev-001', confidence: 1.0 },
        ]);

        mocks._getMasterFieldDefinitionMock.mockImplementation(async (n: number) => makeDbField(3, 'Legal name'));

        mocks._evaluateFieldCandidateMock.mockResolvedValue({
            action: 'BLOCKED',
            currentValue: 'ZZOOMM LIMITED',
            currentSource: 'USER_INPUT',
            reason: 'User manual override is protected from GLEIF updates',
        });

        const result = await refreshGleifProposals('client-le-001');

        expect(result.success).toBe(true);
        expect(result.proposals).toHaveLength(1);
        expect(result.proposals![0].action).toBe('BLOCKED');
        expect(mocks._applyFieldCandidateMock).not.toHaveBeenCalled();
        expect(result.proposals![0].reason).toContain('User manual override');
    });

    it('T3: no-change refresh produces no misleading update', async () => {
        gleifNormalizerMock.mockResolvedValue([
            { fieldNo: 3, value: 'ZZOOMM PLC', source: 'GLEIF', evidenceId: 'ev-001', confidence: 1.0 },
        ]);

        mocks._getMasterFieldDefinitionMock.mockImplementation(async (n: number) => makeDbField(3, 'Legal name'));

        mocks._evaluateFieldCandidateMock.mockResolvedValue({
            action: 'NO_CHANGE',
            currentValue: 'ZZOOMM PLC',
            currentSource: 'GLEIF',
            reason: 'Values are identical',
        });

        const result = await refreshGleifProposals('client-le-001');

        expect(result.success).toBe(true);
        expect(result.proposals).toHaveLength(1);
        expect(result.proposals![0].action).toBe('NO_CHANGE');
        expect(mocks._applyFieldCandidateMock).not.toHaveBeenCalled();
    });

    it('T4: truly unknown field (999, not in DB) is skipped', async () => {
        gleifNormalizerMock.mockResolvedValue([
            { fieldNo: 3, value: 'ZZOOMM PLC', source: 'GLEIF', evidenceId: 'ev-001', confidence: 1.0 },
            { fieldNo: 999, value: 'Ghost', source: 'GLEIF', evidenceId: 'ev-001', confidence: 0.5 },
        ]);

        mocks._getMasterFieldDefinitionMock.mockImplementation(async (n: number) => {
            if (n === 3) return makeDbField(3, 'Legal name', 'Identity');
            throw new Error(`Unknown or Inactive Field No: ${n}`);
        });

        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const result = await refreshGleifProposals('client-le-001');

        expect(result.success).toBe(true);
        // Only fieldNo 3 survives; 999 is skipped
        expect(result.proposals).toHaveLength(1);
        expect(result.proposals![0].fieldNo).toBe(3);
        expect(result.proposals![0].action).toBe('AUTO_APPLIED');
        // Warned about the skip
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('999'));

        warnSpy.mockRestore();
    });

    it('T5: unsupported national registry (RA000592) does not poison GLEIF refresh', async () => {
        gleifNormalizerMock.mockResolvedValue([
            { fieldNo: 3, value: 'ZZOOMM PLC', source: 'GLEIF', evidenceId: 'ev-001', confidence: 1.0 },
        ]);

        mocks._getMasterFieldDefinitionMock.mockImplementation(async (n: number) => makeDbField(3, 'Legal name'));

        // Mock unsupported registry reference derived from GLEIF
        vi.mocked(deriveRegistryReferencesFromGleif).mockReturnValue([
            {
                clientLEId: 'client-le-001',
                sourceSystem: 'GLEIF',
                sourceRecordId: '213800TEST0000000001',
                registryAuthorityId: 'RA000592',
                localRegistrationNumber: '730398',
                status: 'NEW',
                confidence: 1.0,
            } as any
        ]);

        (prisma.registryAuthority.findUnique as any).mockResolvedValue({
            id: 'RA000592',
            name: 'Financial Conduct Authority',
            countryCode: 'GB',
        });

        (prisma.registryReference.upsert as any).mockResolvedValue({
            id: 'ref-fca-001',
            clientLEId: 'client-le-001',
            registryAuthorityId: 'RA000592',
            localRegistrationNumber: '730398',
            status: 'UNSUPPORTED',
            lastSyncStatus: null,
        });

        // RegistryEnrichmentService returns failure because RA000592 has no connector
        vi.mocked(RegistryEnrichmentService.enrich).mockResolvedValue({
            success: false,
            error: 'No connector for authority RA000592',
        });

        const result = await refreshGleifProposals('client-le-001');

        // 1. Refresh action succeeds
        expect(result.success).toBe(true);
        // 2. GLEIF proposals are still successfully generated
        expect(result.proposals).toHaveLength(1);
        expect(result.proposals![0].fieldNo).toBe(3);
        expect(result.proposals![0].action).toBe('AUTO_APPLIED');
        // 3. GLEIF master cache persistence occurs
        expect(prisma.clientLE.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 'client-le-001' },
                data: expect.objectContaining({
                    gleifFetchedAt: expect.any(Date),
                }),
            })
        );
    });
});
