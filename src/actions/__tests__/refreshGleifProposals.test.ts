/**
 * refreshGleifProposals — regression tests
 *
 * Key scenarios:
 *  T1: Field 134 exists in DB (dynamically created). GLEIF candidate maps to
 *      fieldNo 134. refreshGleifProposals must NOT throw and must include a
 *      proposal for field 134 with the correct fieldName from the DB.
 *
 *  T2: Candidate for a field that is unknown even in the DB (e.g. 999) is
 *      silently skipped — the rest of the proposals still return and the
 *      action does NOT return success:false.
 *
 *  T3: Mixed candidates: one known static field (fieldNo 3) and one
 *      dynamically created field (fieldNo 134). Both appear in proposals.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Module-scope spies ───────────────────────────────────────────────────────
const _normalizeEvidenceMock = vi.fn().mockResolvedValue('evidence-gleif-001');
const _getMasterFieldDefinitionMock = vi.fn();

// ─── vi.mock declarations ─────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => ({
    default: {
        clientLE: {
            findUnique: vi.fn().mockResolvedValue({ legalEntityId: 'le-001', lei: '213800TEST0000000001' }),
            update: vi.fn().mockResolvedValue({}),
        },
        registryReference: { upsert: vi.fn() },
        fIEngagement: { findMany: vi.fn().mockResolvedValue([]) },
        masterFieldGroup: { findMany: vi.fn().mockResolvedValue([]) },
    },
}));

vi.mock('@/services/masterData/definitionService', () => ({
    getMasterFieldDefinition: (...args: any[]) => _getMasterFieldDefinitionMock(...args),
    listAllMasterGroupsWithItems: vi.fn().mockResolvedValue([]),
    refreshDefinitionCache: vi.fn(),
}));

vi.mock('@/services/kyc/EvidenceService', () => ({
    EvidenceService: class {
        async normalizeEvidence(...args: any[]) { return _normalizeEvidenceMock(...args); }
    },
}));

vi.mock('@/services/kyc/normalization/GleifNormalizer', () => ({
    mapGleifPayloadToFieldCandidates: vi.fn(),
}));

vi.mock('@/services/kyc/KycWriteService', () => ({
    KycWriteService: class {
        evaluateFieldCandidate = vi.fn().mockResolvedValue({
            action: 'PROPOSE_UPDATE',
            currentValue: null,
            currentSource: undefined,
            reason: 'No existing record',
        });
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

const gleifNormalizerMock = mapGleifPayloadToFieldCandidates as ReturnType<typeof vi.fn>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Fake MasterFieldDefinition row as returned by Prisma (with category join). */
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

describe('refreshGleifProposals — dynamic field support', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        _normalizeEvidenceMock.mockResolvedValue('evidence-gleif-001');
    });

    it('T1: field 134 in DB — GLEIF candidate maps correctly, no throw', async () => {
        // GLEIF normalizer returns one candidate for fieldNo 134
        gleifNormalizerMock.mockResolvedValue([
            { fieldNo: 134, value: 'Test Value 134', source: 'GLEIF', evidenceId: 'evidence-gleif-001', confidence: 0.95 },
        ]);

        // DB knows about field 134
        _getMasterFieldDefinitionMock.mockImplementation(async (n: number) => {
            if (n === 134) return makeDbField(134, 'New Dynamic Field', 'Compliance');
            throw new Error(`Unknown or Inactive Field No: ${n}`);
        });

        const result = await refreshGleifProposals('client-le-001');

        expect(result.success).toBe(true);
        expect(result.proposals).toHaveLength(1);
        expect(result.proposals![0].fieldNo).toBe(134);
        expect(result.proposals![0].fieldName).toBe('New Dynamic Field');
        expect(result.proposals![0].table).toBe('Compliance');
        expect(result.proposals![0].action).toBe('PROPOSE_UPDATE');
    });

    it('T2: truly unknown field (999, not in DB) is skipped — other proposals still returned', async () => {
        gleifNormalizerMock.mockResolvedValue([
            { fieldNo: 3, value: 'ZZOOMM PLC', source: 'GLEIF', evidenceId: 'ev-001', confidence: 1.0 },
            { fieldNo: 999, value: 'Ghost', source: 'GLEIF', evidenceId: 'ev-001', confidence: 0.5 },
        ]);

        _getMasterFieldDefinitionMock.mockImplementation(async (n: number) => {
            if (n === 3) return makeDbField(3, 'Legal name', 'Identity');
            throw new Error(`Unknown or Inactive Field No: ${n}`);
        });

        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const result = await refreshGleifProposals('client-le-001');

        expect(result.success).toBe(true);
        // Only fieldNo 3 survives; 999 is skipped
        expect(result.proposals).toHaveLength(1);
        expect(result.proposals![0].fieldNo).toBe(3);
        // Warned about the skip
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('999'));

        warnSpy.mockRestore();
    });

    it('T3: mixed known static field + dynamic field 134 — both in proposals', async () => {
        gleifNormalizerMock.mockResolvedValue([
            { fieldNo: 3,   value: 'ZZOOMM PLC',        source: 'GLEIF', evidenceId: 'ev-001', confidence: 1.0 },
            { fieldNo: 134, value: 'GLEIF Dynamic Val',  source: 'GLEIF', evidenceId: 'ev-001', confidence: 0.9 },
        ]);

        _getMasterFieldDefinitionMock.mockImplementation(async (n: number) => {
            if (n === 3)   return makeDbField(3,   'Legal name',       'Identity');
            if (n === 134) return makeDbField(134, 'New Dynamic Field', 'Compliance');
            throw new Error(`Unknown or Inactive Field No: ${n}`);
        });

        const result = await refreshGleifProposals('client-le-001');

        expect(result.success).toBe(true);
        expect(result.proposals).toHaveLength(2);

        const f3   = result.proposals!.find(p => p.fieldNo === 3);
        const f134 = result.proposals!.find(p => p.fieldNo === 134);

        expect(f3?.fieldName).toBe('Legal name');
        expect(f134?.fieldName).toBe('New Dynamic Field');
        expect(f134?.table).toBe('Compliance');
    });
});
