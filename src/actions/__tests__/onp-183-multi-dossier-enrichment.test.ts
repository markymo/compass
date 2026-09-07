import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KycWriteService } from '@/services/kyc/KycWriteService';
import { FieldClaimService } from '@/lib/kyc/FieldClaimService';
import { KycStateService } from '@/lib/kyc/KycStateService';
import { getMasterFieldDefinition, listAllMasterGroupsWithItems } from '@/services/masterData/definitionService';
import prisma from '@/lib/prisma';
import { getFullMasterData } from '@/actions/client-le';
import { RegistryAuthorityService } from '@/domain/registry/RegistryAuthorityService';
import { RegistryConnectorFactory } from '@/domain/registry/RegistryConnectorFactory';
import { RegistryEnrichmentService } from '@/domain/registry/RegistryEnrichmentService';
import { LegalEntityEnrichmentService } from '@/domain/registry/LegalEntityEnrichmentService';

// Contract: ONP-183 — Multi-dossier isolation, genuine provenance, and registry failure isolation
// Linear: ONP-183

vi.mock('@/lib/prisma', () => ({
    default: {
        clientLE: {
            findUnique: vi.fn(),
            findFirst: vi.fn(),
            update: vi.fn(),
        },
        fieldClaim: {
            findFirst: vi.fn(),
            findMany: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
        },
        registryReference: {
            findUnique: vi.fn(),
            findMany: vi.fn(),
            findFirst: vi.fn(),
            upsert: vi.fn(),
            update: vi.fn(),
        },
        registryAuthority: {
            findUnique: vi.fn(),
            findMany: vi.fn(),
            findFirst: vi.fn(),
            upsert: vi.fn(),
            update: vi.fn(),
        },
        sourceFieldMapping: {
            findMany: vi.fn().mockResolvedValue([]),
        },
        customFieldDefinition: {
            findMany: vi.fn().mockResolvedValue([]),
        },
        customDataValue: {
            findMany: vi.fn().mockResolvedValue([]),
        },
        masterFieldAssignment: {
            findMany: vi.fn().mockResolvedValue([]),
        },
        fIEngagement: {
            findMany: vi.fn().mockResolvedValue([]),
        },
        membership: {
            findMany: vi.fn().mockResolvedValue([{ organizationId: 'org-1', role: 'ORG_ADMIN' }]),
            findFirst: vi.fn().mockResolvedValue(null),
        },
        clientLEOwner: {
            findFirst: vi.fn().mockResolvedValue({ partyId: 'org-1' }),
        },
        organization: {
            findUnique: vi.fn().mockResolvedValue({ id: 'org-1' }),
        },
        question: {
            findMany: vi.fn().mockResolvedValue([]),
        },
        evidenceStore: {
            findUnique: vi.fn().mockResolvedValue({ id: 'ev_1' }),
            create: vi.fn().mockResolvedValue({ id: 'ev_1' }),
        },
        address: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({ id: 'addr_1' }),
        },
        clientLEGraphNode: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({ id: 'node_1' }),
        },
        questionnaire: {
            findMany: vi.fn().mockResolvedValue([]),
        },
        cCParty: {
            findUnique: vi.fn(),
            findFirst: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
        },
        cCAddress: {
            findUnique: vi.fn(),
            findFirst: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
        },
        $queryRaw: vi.fn().mockResolvedValue([]),
    },
}));

vi.mock('@/services/masterData/definitionService', () => ({
    getMasterFieldDefinition: vi.fn(),
    listAllMasterFields: vi.fn().mockResolvedValue([]),
    listAllMasterGroupsWithItems: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/kyc/FieldClaimService', () => ({
    FieldClaimService: {
        assertClaim: vi.fn().mockResolvedValue({ id: 'new-claim-id' }),
        emitTombstone: vi.fn(),
    },
}));

vi.mock('@/lib/kyc/KycStateService', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/kyc/KycStateService')>();
    return {
        KycStateService: {
            ...actual.KycStateService,
            getAuthoritativeValue: vi.fn(),
            getAuthoritativeCollection: vi.fn().mockResolvedValue([]),
            resolveScopeId: vi.fn().mockResolvedValue(null),
            resolveAllFields: vi.fn().mockResolvedValue(new Map()),
            evaluateSyncAttempt: vi.fn().mockImplementation(actual.KycStateService.evaluateSyncAttempt),
            calculateDisplayState: vi.fn().mockImplementation(actual.KycStateService.calculateDisplayState),
            isMappingApplicableToLE: vi.fn().mockImplementation(actual.KycStateService.isMappingApplicableToLE),
        },
    };
});

vi.mock('@/lib/master-data/complex-field-config', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/master-data/complex-field-config')>();
    return {
        ...actual,
        getComplexFieldConfig: vi.fn().mockReturnValue(null),
    };
});

vi.mock('@/lib/master-data/field-types', () => ({
    APP_DATA_TYPES: { TEXT: 'TEXT', PARTY: 'PARTY', PARTY_REF: 'PARTY_REF', ADDRESS_REF: 'ADDRESS_REF' },
    isKnownAppDataType: () => true,
}));

vi.mock('@/lib/kyc/source-priority-config', () => ({
    getFallbackPriority: (source: string) => (source === 'REGISTRATION_AUTHORITY' ? 20 : 30),
    USER_INPUT_PRIORITY: 0,
}));

vi.mock('@/lib/auth/permissions', () => ({
    can: vi.fn().mockResolvedValue(true),
    Action: { LE_VIEW_MASTER_DATA: 'LE_VIEW_MASTER_DATA' },
}));

vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn().mockResolvedValue({ userId: 'user-001' }),
}));

vi.mock('@sentry/nextjs', () => ({
    startSpan: vi.fn((_, fn) => fn({ setAttribute: vi.fn() })),
}));

describe('ONP-183: Multi-Dossier Enrichment & Registry Failure Isolation (8 Scenarios)', () => {
    let writeService: KycWriteService;

    beforeEach(() => {
        vi.clearAllMocks();
        writeService = new KycWriteService();

        vi.mocked(getMasterFieldDefinition).mockImplementation(async (fieldNo: number) => {
            if (fieldNo === 1) {
                return { fieldNo: 1, fieldName: 'Legal Name', appDataType: 'TEXT', isMultiValue: false, modelField: 'name' } as any;
            }
            if (fieldNo === 6) {
                return { fieldNo: 6, fieldName: 'Trading Name', appDataType: 'TEXT', isMultiValue: false } as any;
            }
            if (fieldNo === 63) {
                return { fieldNo: 63, fieldName: 'List of company directors', appDataType: 'PARTY', isMultiValue: true, model: 'Stakeholder' } as any;
            }
            if (fieldNo === 64) {
                return { fieldNo: 64, fieldName: 'List of persons controlling', appDataType: 'PARTY_REF', isMultiValue: true, model: 'Stakeholder' } as any;
            }
            if (fieldNo === 122) {
                return { fieldNo: 122, fieldName: 'Primary Address (Structured)', appDataType: 'ADDRESS_REF', isMultiValue: false, model: 'IdentityProfile' } as any;
            }
            return { fieldNo, fieldName: `Field ${fieldNo}`, appDataType: 'TEXT', isMultiValue: false } as any;
        });

        vi.mocked(listAllMasterGroupsWithItems).mockResolvedValue([]);
    });

    // ─── SCENARIO A: Second ClientLE for Same LegalEntity (Non-Interference & Scoping) ───
    describe('Scenario A: Second ClientLE for Same LegalEntity', () => {
        it('A1 (Integration Non-Interference): Dossier B enrichment leaves Dossier A claims 100% identical and asserts B claims', async () => {
            // In-memory claims store simulating database
            const mockDbClaims: any[] = [
                {
                    id: 'claim_A_001',
                    clientLEId: 'clientLE_A',
                    subjectLeId: 'shared_le_123',
                    fieldNo: 1,
                    valueText: 'Environmena UK Holdco Limited',
                    sourceType: 'REGISTRATION_AUTHORITY',
                    sourceReference: 'RA000585',
                    status: 'ACTIVE',
                    assertedAt: new Date('2026-08-20T10:00:00Z'),
                }
            ];

            (prisma.clientLE.findUnique as any).mockImplementation(async ({ where }: any) => {
                if (where.id === 'clientLE_B') {
                    return { id: 'clientLE_B', legalEntityId: 'shared_le_123', name: 'Environmena UK Holdco Limited' };
                }
                if (where.id === 'clientLE_A') {
                    return { id: 'clientLE_A', legalEntityId: 'shared_le_123', name: 'Environmena UK Holdco Limited' };
                }
                return null;
            });

            // Capture snapshot of Dossier A before B processing
            const snapshotABefore = JSON.parse(JSON.stringify(mockDbClaims.filter(c => c.clientLEId === 'clientLE_A')));

            vi.mocked(KycStateService.getAuthoritativeValue).mockImplementation(async (subject: any) => {
                // If caller scopes to clientLE_B, it has NO claims yet
                if (subject.clientLEId === 'clientLE_B') {
                    return null;
                }
                // If caller omits clientLEId and checks shared subjectLeId, it sees Dossier A's claim!
                if (subject.subjectLeId === 'shared_le_123') {
                    const claim = mockDbClaims.find(c => c.subjectLeId === 'shared_le_123');
                    return claim ? { value: claim.valueText, sourceType: claim.sourceType, sourceReference: claim.sourceReference } as any : null;
                }
                return null;
            });

            const candidate = {
                fieldNo: 1,
                value: 'Environmena UK Holdco Limited',
                source: 'REGISTRATION_AUTHORITY' as const,
                sourceKey: 'RA000585',
                confidence: 1.0,
            };

            const result = await writeService.applyFieldCandidate('clientLE_B', candidate, undefined, 'CLIENT_LE');

            // 1. Assert Dossier B successfully receives claim
            expect(result).toBe(true);
            expect(FieldClaimService.assertClaim).toHaveBeenCalledWith(
                expect.objectContaining({
                    clientLEId: 'clientLE_B',
                    fieldNo: 1,
                    valueText: 'Environmena UK Holdco Limited',
                })
            );

            // 2. Assert Dossier A was NOT mutated: exactly unchanged
            const snapshotAAfter = JSON.parse(JSON.stringify(mockDbClaims.filter(c => c.clientLEId === 'clientLE_A')));
            expect(snapshotAAfter).toEqual(snapshotABefore);
            expect(FieldClaimService.assertClaim).not.toHaveBeenCalledWith(
                expect.objectContaining({ clientLEId: 'clientLE_A' })
            );
        });

        it('A2 (Query Scoping): candidate evaluation strictly scopes lookups to clientLEId = B', async () => {
            (prisma.clientLE.findUnique as any).mockResolvedValue({
                id: 'clientLE_B',
                legalEntityId: 'shared_le_123',
                name: 'Environmena UK Holdco Limited',
            });

            vi.mocked(KycStateService.getAuthoritativeValue).mockImplementation(async (subject: any) => {
                if (subject.clientLEId === 'clientLE_B') return null;
                if (subject.subjectLeId === 'shared_le_123') {
                    return { value: 'Environmena UK Holdco Limited', sourceType: 'REGISTRATION_AUTHORITY' } as any;
                }
                return null;
            });

            const candidate = {
                fieldNo: 1,
                value: 'Environmena UK Holdco Limited',
                source: 'REGISTRATION_AUTHORITY' as const,
                sourceKey: 'RA000585',
            };

            const evalResult = await writeService.evaluateFieldCandidate('clientLE_B', candidate, 'CLIENT_LE');

            // KycStateService MUST have been called with clientLEId: 'clientLE_B'
            expect(KycStateService.getAuthoritativeValue).toHaveBeenCalledWith(
                expect.objectContaining({ clientLEId: 'clientLE_B' }),
                1
            );
            expect(evalResult.action).toBe('PROPOSE_UPDATE');
        });
    });

    // ─── SCENARIO B: Idempotent Refresh Within Dossier B ───
    describe('Scenario B: Idempotent Refresh Within Dossier B', () => {
        it('B1: Refreshing B when B already has the claim detects idempotency and creates no duplicates', async () => {
            (prisma.clientLE.findUnique as any).mockResolvedValue({
                id: 'clientLE_B',
                legalEntityId: 'shared_le_123',
            });

            // KycStateService reports that clientLE_B ALREADY has this claim
            vi.mocked(KycStateService.getAuthoritativeValue).mockImplementation(async (subject: any) => {
                if (subject.clientLEId === 'clientLE_B') {
                    return {
                        value: 'Environmena UK Holdco Limited',
                        sourceType: 'REGISTRATION_AUTHORITY',
                        sourceReference: 'RA000585',
                    } as any;
                }
                return null;
            });

            const candidate = {
                fieldNo: 1,
                value: 'Environmena UK Holdco Limited',
                source: 'REGISTRATION_AUTHORITY' as const,
                sourceKey: 'RA000585',
            };

            const result = await writeService.applyFieldCandidate('clientLE_B', candidate, undefined, 'CLIENT_LE');

            // Idempotent: returns true, but does NOT assert duplicate claim
            expect(result).toBe(true);
            expect(FieldClaimService.assertClaim).not.toHaveBeenCalled();
        });
    });

    // ─── SCENARIO C: Multi-Value & Structured Field Isolation (Fields 63, 64, 122) ───
    describe('Scenario C: Multi-Value & Structured Field Isolation', () => {
        it('C1 (Collection Item Isolation): Collection items in Dossier A do not suppress Dossier B items', async () => {
            (prisma.clientLE.findUnique as any).mockResolvedValue({
                id: 'clientLE_B',
                legalEntityId: 'shared_le_123',
            });

            const directorRowId = 'ch::officer_director_001';
            const directorValue = { name: 'Jane Director', roles: [{ roleType: 'DIRECTOR' }] };

            // In A, this director exists. In B, B has no collection items yet.
            // If prisma.fieldClaim.findFirst omits clientLEId, it finds A's item and skips B!
            (prisma.fieldClaim.findFirst as any).mockImplementation(async ({ where }: any) => {
                if (where.clientLEId === 'clientLE_B') return null;
                if (where.subjectLeId === 'shared_le_123') {
                    return {
                        id: 'claim_A_dir',
                        clientLEId: 'clientLE_A',
                        instanceId: directorRowId,
                        valueJson: directorValue,
                        sourceType: 'REGISTRATION_AUTHORITY',
                    };
                }
                return null;
            });

            const candidate = {
                fieldNo: 63, // Field 63: List of company directors (PARTY, isMultiValue)
                value: [directorValue],
                rowKeys: [directorRowId],
                source: 'REGISTRATION_AUTHORITY' as const,
                sourceKey: 'RA000585',
                evidenceId: null,
            };

            const result = await writeService.applyFieldCandidate('clientLE_B', candidate, undefined, 'CLIENT_LE');

            expect(result).toBe(true);
            expect(FieldClaimService.assertClaim).toHaveBeenCalledWith(
                expect.objectContaining({
                    clientLEId: 'clientLE_B',
                    fieldNo: 63,
                    instanceId: expect.stringContaining(directorRowId),
                })
            );
        });

        it('C2 (Tombstone / SNAPSHOT_SYNC Non-Interference): Dossier A tombstone or omission does not tombstone Dossier B', async () => {
            (prisma.clientLE.findUnique as any).mockResolvedValue({
                id: 'clientLE_B',
                legalEntityId: 'shared_le_123',
            });

            // In SNAPSHOT_SYNC: existing claims query MUST scope to clientLEId: 'clientLE_B'
            // If it queries subjectLeId: 'shared_le_123', it finds Dossier A's director and tombstones it!
            (prisma.fieldClaim.findMany as any).mockImplementation(async ({ where }: any) => {
                // Return Dossier A claims if query is not scoped to B
                if (!where.clientLEId && where.subjectLeId === 'shared_le_123') {
                    return [
                        {
                            id: 'claim_A_dir',
                            clientLEId: 'clientLE_A',
                            instanceId: 'ch::officer_director_A',
                            valueJson: { name: 'Director A' },
                            sourceType: 'REGISTRATION_AUTHORITY',
                            collectionId: 'FIELD_63',
                        }
                    ];
                }
                return [];
            });

            const candidate = {
                fieldNo: 63,
                value: [{ name: 'Director B', roles: [{ roleType: 'DIRECTOR' }] }],
                rowKeys: ['ch::officer_director_B'],
                source: 'REGISTRATION_AUTHORITY' as const,
                sourceKey: 'RA000585',
                evidenceId: null,
                syncMode: 'SNAPSHOT_SYNC',
            };

            await writeService.applyFieldCandidate('clientLE_B', candidate, undefined, 'CLIENT_LE');

            // Verify SNAPSHOT_SYNC query scoped strictly to clientLE_B
            expect(prisma.fieldClaim.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        clientLEId: 'clientLE_B',
                    }),
                })
            );

            // Dossier A's director must NOT be tombstoned
            expect(FieldClaimService.emitTombstone).not.toHaveBeenCalledWith(
                expect.anything(),
                63,
                expect.anything(),
                'ch::officer_director_A',
                expect.anything(),
                expect.anything()
            );
        });

        it('C3 (Structured Nested Address): materializeNestedAddress passes clientLEId = B to assertClaim', async () => {
            (prisma.clientLE.findUnique as any).mockResolvedValue({
                id: 'clientLE_B',
                legalEntityId: 'shared_le_123',
            });

            const addressCandidate = {
                fieldNo: 122, // Field 122: Primary Address (Structured)
                value: {
                    line1: '123 High Street',
                    city: 'London',
                    postalCode: 'EC1A 1BB',
                    country: 'GB',
                },
                source: 'REGISTRATION_AUTHORITY' as const,
                sourceKey: 'RA000585',
            };

            await writeService.applyFieldCandidate('clientLE_B', addressCandidate, undefined, 'CLIENT_LE');

            // EVERY call to FieldClaimService.assertClaim must be explicitly scoped to clientLE_B
            const assertClaimCalls = vi.mocked(FieldClaimService.assertClaim).mock.calls;
            expect(assertClaimCalls.length).toBeGreaterThan(0);
            for (const [args] of assertClaimCalls) {
                expect(args).toHaveProperty('clientLEId', 'clientLE_B');
            }
        });
    });

    // ─── SCENARIO D: Deleted / Recreated Dossier Recovery ───
    describe('Scenario D: Deleted / Recreated Dossier Recovery', () => {
        it('D1: Soft-deleted Dossier A claims do not suppress newly created Dossier B for the same entity', async () => {
            (prisma.clientLE.findUnique as any).mockResolvedValue({
                id: 'clientLE_B_new',
                legalEntityId: 'shared_le_123',
            });

            // DB has claims on shared_le_123 from soft-deleted clientLE_A_deleted
            vi.mocked(KycStateService.getAuthoritativeValue).mockImplementation(async (subject: any) => {
                if (subject.clientLEId === 'clientLE_B_new') return null;
                // If query fails to scope by clientLEId, it sees the soft-deleted claims!
                if (subject.subjectLeId === 'shared_le_123') {
                    return { value: 'Environmena UK Holdco Limited', sourceType: 'REGISTRATION_AUTHORITY' } as any;
                }
                return null;
            });

            const candidate = {
                fieldNo: 1,
                value: 'Environmena UK Holdco Limited',
                source: 'REGISTRATION_AUTHORITY' as const,
                sourceKey: 'RA000585',
            };

            const result = await writeService.applyFieldCandidate('clientLE_B_new', candidate, undefined, 'CLIENT_LE');

            expect(result).toBe(true);
            expect(FieldClaimService.assertClaim).toHaveBeenCalledWith(
                expect.objectContaining({
                    clientLEId: 'clientLE_B_new',
                    fieldNo: 1,
                    valueText: 'Environmena UK Holdco Limited',
                })
            );
        });
    });

    // ─── SCENARIO E: Source Precedence on Multi-Source Fields ───
    describe('Scenario E: Source Precedence on Multi-Source Fields', () => {
        it('E1: Winning claim asserted in Dossier B is from REGISTRATION_AUTHORITY (priority 20), outranking existing GLEIF (priority 30)', async () => {
            (prisma.clientLE.findUnique as any).mockResolvedValue({
                id: 'clientLE_B',
                legalEntityId: 'shared_le_123',
            });

            // B currently has a GLEIF claim (priority 30)
            vi.mocked(KycStateService.getAuthoritativeValue).mockImplementation(async (subject: any) => {
                if (subject.clientLEId === 'clientLE_B') {
                    return {
                        value: 'Enviromena International Holdings Limited',
                        sourceType: 'GLEIF',
                    } as any;
                }
                return null;
            });

            const chCandidate = {
                fieldNo: 1,
                value: 'ENVIROMENA UK HOLDCO LIMITED',
                source: 'REGISTRATION_AUTHORITY' as const,
                sourceKey: 'RA000585',
            };

            // Evaluate overwrite: CH (priority 20) against existing GLEIF (priority 30)
            const evaluation = await writeService.evaluateFieldCandidate('clientLE_B', chCandidate, 'CLIENT_LE');

            expect(evaluation.action).toBe('PROPOSE_UPDATE');

            await writeService.applyFieldCandidate('clientLE_B', chCandidate, undefined, 'CLIENT_LE');

            expect(FieldClaimService.assertClaim).toHaveBeenCalledWith(
                expect.objectContaining({
                    clientLEId: 'clientLE_B',
                    fieldNo: 1,
                    sourceType: 'REGISTRATION_AUTHORITY',
                    valueText: 'ENVIROMENA UK HOLDCO LIMITED',
                })
            );
        });
    });

    // ─── SCENARIO F: Genuine "Checked: No Data" Semantics (3-Way Branch) ───
    describe('Scenario F: Genuine "Checked: No Data" Semantics', () => {
        it('F1 (Genuine Absence): Source completed SUCCESS and payload/mapper evaluation positively confirms field is absent -> CHECKED_NO_DATA with evaluationOutcome: NO_DATA', () => {
            // Field 6 (Trading Name) mapped to COMPANIES_HOUSE with sourcePath: 'trading_name'
            // The raw payload has company_name, but trading_name is genuinely absent/empty
            const clientLE = {
                gleifFetchedAt: null,
                registryReferences: [
                    {
                        authority: { registryKey: 'GB_COMPANIES_HOUSE', mappingSourceKey: 'COMPANIES_HOUSE' },
                        lastSyncStatus: 'SUCCESS',
                        lastSyncSucceededAt: new Date('2026-08-20T10:00:00Z'),
                    },
                ],
                nationalRegistryData: {
                    company_name: 'ENVIROMENA UK HOLDCO LIMITED',
                    // trading_name is genuinely omitted / null
                }
            };

            const mappings = [{
                sourceType: 'COMPANIES_HOUSE',
                sourceReference: 'COMPANIES_HOUSE',
                sourcePath: 'trading_name',
                mappingScope: 'RAW_PAYLOAD',
            }];

            const result = KycStateService.evaluateSyncAttempt(clientLE as any, mappings);

            // Hardened contract: evaluation must confirm genuine absence, NOT just successful sync timestamp
            expect((result as any).evaluationOutcome).toBe('NO_DATA');
            expect(result.hasApplicableEvaluationAttempt).toBe(true);
            expect(result.evaluatedSourceBadge).toBe('COMPANIES_HOUSE');

            const state = KycStateService.calculateDisplayState({
                hasValue: false,
                hasApplicableMapping: result.hasApplicableMapping,
                hasApplicableEvaluationAttempt: result.hasApplicableEvaluationAttempt,
            });
            expect(state).toBe('CHECKED_NO_DATA');
        });

        it('F2 (Sync Failure): Source sync FAILED -> NEVER CHECKED_NO_DATA', () => {
            const clientLE = {
                gleifFetchedAt: null,
                registryReferences: [
                    {
                        authority: { registryKey: 'GB_COMPANIES_HOUSE', mappingSourceKey: 'COMPANIES_HOUSE' },
                        lastSyncStatus: 'FAILED',
                        lastSyncSucceededAt: null,
                        lastSyncAttemptAt: new Date(),
                    },
                ],
                nationalRegistryData: null,
            };

            const mappings = [{ sourceType: 'COMPANIES_HOUSE', sourceReference: 'COMPANIES_HOUSE', sourcePath: 'trading_name' }];

            const result = KycStateService.evaluateSyncAttempt(clientLE as any, mappings);
            const state = KycStateService.calculateDisplayState({
                hasValue: false,
                hasApplicableMapping: result.hasApplicableMapping,
                hasApplicableEvaluationAttempt: result.hasApplicableEvaluationAttempt,
            });

            expect(state).not.toBe('CHECKED_NO_DATA');
            expect(result.hasApplicableEvaluationAttempt).toBe(false);
        });

        it('F3 (Pipeline Drop): Source sync completed but payload contained data for the field that was skipped/lost -> strictly forbidden from CHECKED_NO_DATA', () => {
            // External GLEIF feed contained Legal Name in canonical attribute root
            const clientLE = {
                gleifFetchedAt: new Date('2026-08-20T10:00:00Z'),
                gleifData: {
                    data: {
                        attributes: {
                            entity: {
                                legalName: { name: 'ENVIROMENA UK HOLDCO LIMITED' },
                            },
                        },
                    },
                },
                registryReferences: [],
            };

            const mappings = [{
                sourceType: 'GLEIF',
                sourceReference: null,
                sourcePath: 'entity.legalName.name',
            }];

            const result = KycStateService.evaluateSyncAttempt(clientLE as any, mappings);

            // Hardened contract: source contained data; evaluationOutcome must be VALUE, NOT NO_DATA
            // hasApplicableEvaluationAttempt must be false so calculateDisplayState NEVER produces CHECKED_NO_DATA!
            expect(result.hasApplicableEvaluationAttempt).toBe(false);
            expect((result as any).evaluationOutcome).not.toBe('NO_DATA');
        });
    });

    // ─── SCENARIO G: Unsupported Registry + Alternative Source Success ───
    describe('Scenario G: Unsupported Registry + Alternative Source Success', () => {
        it('G1 (Direct Service Transition): RegistryEnrichmentService sets status = UNSUPPORTED and lastSyncStatus = null when authority has no connector', async () => {
            (prisma.registryReference.findUnique as any).mockResolvedValue({
                id: 'ref_unsupported_001',
                clientLEId: 'clientLE_charity',
                registryAuthorityId: 'RA000589', // Charity Commission
                localRegistrationNumber: '1082058',
                authority: { id: 'RA000589', name: 'Charity Commission', countryCode: 'GB' },
            });

            // Run enrich on unsupported authority
            const result = await RegistryEnrichmentService.enrich('ref_unsupported_001');

            expect(result.success).toBe(false);
            expect(result.error).toContain('No connector for authority RA000589');

            // Must set status: UNSUPPORTED, and MUST NOT set lastSyncStatus: FAILED
            expect(prisma.registryReference.update).toHaveBeenCalledWith({
                where: { id: 'ref_unsupported_001' },
                data: expect.objectContaining({
                    status: 'UNSUPPORTED',
                    lastSyncStatus: null,
                }),
            });
            expect(prisma.registryReference.update).not.toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        lastSyncStatus: 'FAILED',
                    }),
                })
            );
        });

        it('G2 (/master Page Status): Unsupported Charity Commission (RA000589) does not compute FAILED when GLEIF succeeded', async () => {
            // Note on invariant: gleifFetchedAt is ONLY set upon successful 200 OK GLEIF response
            (prisma.clientLE.findFirst as any).mockResolvedValue({
                id: 'clientLE_charity',
                name: 'Keep Wales Tidy',
                status: 'ACTIVE',
                isDeleted: false,
                legalEntityId: 'le_charity',
                gleifFetchedAt: new Date('2026-08-20T10:00:00Z'),
                registryReferences: [
                    {
                        id: 'ref_ra589',
                        status: 'UNSUPPORTED',
                        lastSyncStatus: null,
                        lastSyncSucceededAt: null,
                        localRegistrationNumber: '1082058',
                        authority: {
                            id: 'RA000589',
                            name: 'Charity Commission for England and Wales',
                        },
                    },
                ],
            });

            const masterData = await getFullMasterData('clientLE_charity');

            expect(masterData.success).toBe(true);
            expect((masterData as any).enrichmentStatus).toBe('ENRICHED');
            expect((masterData as any).enrichmentStatus).not.toBe('FAILED');
        });

        it('G3 (/master Page Status): Unsupported registry without any successful source returns PENDING_LEI, not FAILED', async () => {
            (prisma.clientLE.findFirst as any).mockResolvedValue({
                id: 'clientLE_unsupported_no_source',
                name: 'Unknown Charity',
                status: 'NEW',
                isDeleted: false,
                legalEntityId: null,
                gleifFetchedAt: null,
                registryReferences: [
                    {
                        id: 'ref_ra589',
                        status: 'UNSUPPORTED',
                        lastSyncStatus: null,
                        lastSyncSucceededAt: null,
                        authority: { id: 'RA000589', name: 'Charity Commission' },
                    },
                ],
            });

            const masterData = await getFullMasterData('clientLE_unsupported_no_source');

            expect(masterData.success).toBe(true);
            expect((masterData as any).enrichmentStatus).toBe('PENDING_LEI');
            expect((masterData as any).enrichmentStatus).not.toBe('FAILED');
        });

        it('G4 (GLEIF Attempt Failed Invariant): Failed GLEIF attempt (gleifFetchedAt is null) CANNOT produce enrichmentStatus = ENRICHED', async () => {
            (prisma.clientLE.findFirst as any).mockResolvedValue({
                id: 'clientLE_gleif_failed',
                name: 'Failed Charity',
                status: 'NEW',
                isDeleted: false,
                legalEntityId: 'shared_le_unresolved',
                gleifFetchedAt: null, // GLEIF fetch failed/threw
                registryReferences: [
                    {
                        id: 'ref_ra589',
                        status: 'UNSUPPORTED',
                        lastSyncStatus: null,
                        lastSyncSucceededAt: null,
                        authority: { id: 'RA000589', name: 'Charity Commission' },
                    },
                ],
            });

            const masterData = await getFullMasterData('clientLE_gleif_failed');

            expect((masterData as any).enrichmentStatus).not.toBe('ENRICHED');
            expect((masterData as any).enrichmentStatus).not.toBe('FAILED');
        });
    });

    // ─── SCENARIO H: Companies House RA Routing & Persistent Self-Healing ───
    describe('Scenario H: Companies House RA Routing & Persistent Self-Healing', () => {
        const companiesHouseRAs = ['RA000585', 'RA000586', 'RA000587'];

        companiesHouseRAs.forEach((raId) => {
            it(`H1 (Runtime Routing Defense for ${raId}): canonicalises in-memory to GB_COMPANIES_HOUSE without DB mutation`, async () => {
                (prisma.registryAuthority.findUnique as any).mockResolvedValue({
                    id: raId,
                    registryKey: raId, // stale/unseeded key
                    mappingSourceKey: raId,
                });

                const resolvedKey = await RegistryAuthorityService.getRegistryKey(raId);
                const resolvedSourceKey = await RegistryAuthorityService.getMappingSourceKey(raId);

                expect(resolvedKey).toBe('GB_COMPANIES_HOUSE');
                expect(resolvedSourceKey).toBe('COMPANIES_HOUSE');

                // Pure read-only lookup: must NOT have mutated DB
                expect(prisma.registryAuthority.update).not.toHaveBeenCalled();
            });
        });

        it('H2 (Persistent Self-Healing): Authority upsert path in bootstrapEntity repairs stale DB row to GB_COMPANIES_HOUSE', async () => {
            (prisma.clientLE.findUnique as any).mockResolvedValue({
                id: 'clientLE_bootstrap',
                legalEntityId: 'shared_le_123',
                lei: '213800TEST0000000001',
                gleifData: {
                    attributes: {
                        entity: {
                            registeredAt: { id: 'RA000585' },
                            registeredAs: '12345678',
                        }
                    }
                }
            });

            (prisma.registryAuthority.findUnique as any).mockResolvedValue({
                id: 'RA000585',
                registryKey: 'RA000585', // stale legacy key
                mappingSourceKey: 'RA000585',
                name: 'Companies House',
                countryCode: 'GB',
            });

            // Mock fetch for GLEIF
            global.fetch = vi.fn().mockImplementation(async (url: string) => {
                if (url.includes('registration-authorities')) {
                    return { ok: true, json: async () => ({ data: { attributes: { internationalName: 'Companies House', jurisdiction: 'GB' } } }) };
                }
                return {
                    ok: true,
                    json: async () => ({
                        data: {
                            attributes: {
                                lei: '213800TEST0000000001',
                                registration: {
                                    registrationAuthorityId: 'RA000585',
                                    registeredAs: '12345678',
                                }
                            }
                        }
                    })
                };
            });

            // When bootstrap runs, upsert of RegistryAuthority must repair the row to GB_COMPANIES_HOUSE
            await LegalEntityEnrichmentService.bootstrapEntity('clientLE_bootstrap');

            expect(prisma.registryAuthority.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'RA000585' },
                    update: expect.objectContaining({
                        registryKey: 'GB_COMPANIES_HOUSE',
                        mappingSourceKey: 'COMPANIES_HOUSE',
                    }),
                    create: expect.objectContaining({
                        id: 'RA000585',
                        registryKey: 'GB_COMPANIES_HOUSE',
                        mappingSourceKey: 'COMPANIES_HOUSE',
                    }),
                })
            );
        });
    });

    // ─── RELEASE VERIFICATION SUITE ───
    describe('Release Verification: Combined Unsupported + GLEIF & Non-Trivial Provenance Parity', () => {
        it('Release Check 1: Combined unsupported RA000589 + successful GLEIF lifecycle leaves entity ENRICHED and claims intact', async () => {
            const charityLE = {
                id: 'clientLE_charity_full',
                legalEntityId: 'le_charity_full',
                name: 'Keep Wales Tidy',
                status: 'ACTIVE',
                isDeleted: false,
                lei: '213800CHARITY000001',
                gleifFetchedAt: new Date('2026-08-20T10:00:00Z'),
                gleifData: {
                    attributes: {
                        entity: {
                            legalName: { name: 'Keep Wales Tidy' },
                            registeredAt: { id: 'RA000589' },
                            registeredAs: '1082058',
                        }
                    }
                },
                registryReferences: [
                    {
                        id: 'ref_ra589_full',
                        clientLEId: 'clientLE_charity_full',
                        registryAuthorityId: 'RA000589',
                        localRegistrationNumber: '1082058',
                        status: 'UNSUPPORTED',
                        lastSyncStatus: null,
                        lastSyncSucceededAt: null,
                        authority: {
                            id: 'RA000589',
                            name: 'Charity Commission for England and Wales',
                        }
                    }
                ]
            };

            (prisma.clientLE.findUnique as any).mockResolvedValue(charityLE);
            (prisma.clientLE.findFirst as any).mockResolvedValue(charityLE);
            (prisma.registryReference.findUnique as any).mockResolvedValue(charityLE.registryReferences[0]);
            (prisma.registryReference.upsert as any).mockResolvedValue(charityLE.registryReferences[0]);

            // 1. Run bootstrapEntity on entity with RA000589
            const bootstrapResult = await LegalEntityEnrichmentService.bootstrapEntity('clientLE_charity_full');

            // Must NOT report failure overall: unsupported registry does not poison the operation
            expect(bootstrapResult.success).toBe(true);

            // 2. Reference must be transitioned to UNSUPPORTED with null lastSyncStatus
            expect(prisma.registryReference.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        status: 'UNSUPPORTED',
                        lastSyncStatus: null,
                    })
                })
            );

            // 3. getFullMasterData must return ENRICHED (not FAILED or PENDING_ENRICHMENT)
            const masterData = await getFullMasterData('clientLE_charity_full');
            expect(masterData.success).toBe(true);
            expect((masterData as any).enrichmentStatus).toBe('ENRICHED');
            expect((masterData as any).enrichmentStatus).not.toBe('FAILED');
        });

        it('Release Check 2: Provenance parity on non-trivial mapping with FIRST_ARRAY_ITEM transform', () => {
            const mapping = {
                sourceType: 'COMPANIES_HOUSE',
                sourceReference: 'COMPANIES_HOUSE',
                sourcePath: 'items',
                transformType: 'FIRST_ARRAY_ITEM',
            };

            // Case 2A: Payload has empty array [] -> transform produces null (NO_DATA) -> provenance evaluator MUST agree (NO_DATA)
            const clientLE_empty = {
                gleifFetchedAt: null,
                registryReferences: [
                    {
                        authority: { registryKey: 'GB_COMPANIES_HOUSE', mappingSourceKey: 'COMPANIES_HOUSE' },
                        lastSyncStatus: 'SUCCESS',
                        lastSyncSucceededAt: new Date('2026-08-20T10:00:00Z'),
                    },
                ],
                nationalRegistryData: {
                    items: [] // Empty array in source
                }
            };

            const evalResult_empty = KycStateService.evaluateSyncAttempt(clientLE_empty as any, [mapping]);
            expect(evalResult_empty.evaluationOutcome).toBe('NO_DATA');
            expect(evalResult_empty.hasApplicableEvaluationAttempt).toBe(true);
            expect(evalResult_empty.evaluatedSourceBadge).toBe('COMPANIES_HOUSE');

            const displayState_empty = KycStateService.calculateDisplayState({
                hasValue: false,
                hasApplicableMapping: evalResult_empty.hasApplicableMapping,
                hasApplicableEvaluationAttempt: evalResult_empty.hasApplicableEvaluationAttempt,
            });
            expect(displayState_empty).toBe('CHECKED_NO_DATA');

            // Case 2B: Payload has items ['Active Value'] -> transform produces 'Active Value' (VALUE) -> provenance evaluator MUST agree (VALUE, never Checked: No Data)
            const clientLE_withData = {
                gleifFetchedAt: null,
                registryReferences: [
                    {
                        authority: { registryKey: 'GB_COMPANIES_HOUSE', mappingSourceKey: 'COMPANIES_HOUSE' },
                        lastSyncStatus: 'SUCCESS',
                        lastSyncSucceededAt: new Date('2026-08-20T10:00:00Z'),
                    },
                ],
                nationalRegistryData: {
                    items: ['Active Value']
                }
            };

            const evalResult_withData = KycStateService.evaluateSyncAttempt(clientLE_withData as any, [mapping]);
            expect(evalResult_withData.evaluationOutcome).toBe('VALUE');
            expect(evalResult_withData.hasApplicableEvaluationAttempt).toBe(false);

            const displayState_withData = KycStateService.calculateDisplayState({
                hasValue: false,
                hasApplicableMapping: evalResult_withData.hasApplicableMapping,
                hasApplicableEvaluationAttempt: evalResult_withData.hasApplicableEvaluationAttempt,
            });
            expect(displayState_withData).not.toBe('CHECKED_NO_DATA');
        });
    });
});
