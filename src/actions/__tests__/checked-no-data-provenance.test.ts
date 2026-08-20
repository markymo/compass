import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next-auth', () => ({ default: vi.fn(() => ({ handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() })), getServerSession: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import prisma from '@/lib/prisma';
import { KycStateService } from '@/lib/kyc/KycStateService';
import { getWorkbench4Data } from '../kyc-workbench';
import { getFullMasterData } from '../client-le';
import { getFieldDetail } from '../kyc-query';
import { resolveExportAnswer } from '@/lib/export/export-answer-resolver';
import * as kycQuery from '../kyc-query';
import * as definitionService from '@/services/masterData/definitionService';
import * as sourceLabelServer from '@/lib/kyc/source-label.server';

vi.mock('@/lib/prisma', () => {
    const clientLEMock = {
        findUnique: vi.fn(),
        findFirst: vi.fn((args?: any) => clientLEMock.findUnique(args)),
    };
    return {
        default: {
            clientLE: clientLEMock,
        membership: {
            findMany: vi.fn().mockResolvedValue([
                { userId: 'user-1', clientLEId: 'cle_1', role: 'LE_USER', clientLE: { isDeleted: false, status: 'ACTIVE' } },
                { userId: 'user-1', clientLEId: 'cle_unmapped', role: 'LE_USER', clientLE: { isDeleted: false, status: 'ACTIVE' } }
            ])
        },
        fieldClaim: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null), findUnique: vi.fn().mockResolvedValue(null) },
        sourceFieldMapping: { findMany: vi.fn().mockResolvedValue([]) },
        customFieldDefinition: { findMany: vi.fn().mockResolvedValue([]) },
        clientLEOwner: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
        masterFieldDefinition: { findUnique: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
        masterFieldGroup: { findUnique: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
        masterFieldAssignment: { findUnique: vi.fn().mockResolvedValue(null) },
        clientLEUserNote: { findFirst: vi.fn().mockResolvedValue(null) },
        auditLog: { findMany: vi.fn().mockResolvedValue([]) },
        cCParty: { findMany: vi.fn().mockResolvedValue([]) },
        cCAddress: { findMany: vi.fn().mockResolvedValue([]) },
        masterFieldGraphBinding: { findMany: vi.fn().mockResolvedValue([]) },
        $queryRaw: vi.fn().mockResolvedValue([])
    }
};
});

vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn().mockResolvedValue({ userId: 'user-1' })
}));

vi.mock('@/actions/security', () => ({
    getUserFIOrg: vi.fn().mockResolvedValue(null),
    isSystemAdmin: vi.fn().mockResolvedValue(false)
}));

vi.mock('@/lib/kyc/source-label.server', () => ({ fetchRaNameLookup: vi.fn() }));

describe('CHECKED_NO_DATA Provenance Integration & Regression Suite', () => {

    describe('1. KycStateService.evaluateSyncAttempt', () => {
        it('evaluates GLEIF checked with no returned data and extracts gleifFetchedAt', () => {
            const gleifDate = new Date('2026-07-25T10:00:00.000Z');
            const clientLE = { gleifFetchedAt: gleifDate, registryReferences: [] };
            const mappings = [{ sourceType: 'GLEIF', sourceReference: null }];

            const result = KycStateService.evaluateSyncAttempt(clientLE, mappings);
            expect(result.hasApplicableMapping).toBe(true);
            expect(result.hasApplicableEvaluationAttempt).toBe(true);
            expect(result.evaluatedSourceBadge).toBe('GLEIF');
            expect(result.evaluatedSourceTimestamp).toEqual(gleifDate);
        });

        it('evaluates Companies House checked with no returned data and extracts lastSyncSucceededAt', () => {
            const chDate = new Date('2026-07-26T14:30:00.000Z');
            const clientLE = {
                gleifFetchedAt: null,
                registryReferences: [
                    {
                        authority: { registryKey: 'COMPANIES_HOUSE' },
                        lastSyncSucceededAt: chDate
                    }
                ]
            };
            const mappings = [{ sourceType: 'COMPANIES_HOUSE', sourceReference: 'COMPANIES_HOUSE' }];

            const result = KycStateService.evaluateSyncAttempt(clientLE, mappings);
            expect(result.hasApplicableMapping).toBe(true);
            expect(result.hasApplicableEvaluationAttempt).toBe(true);
            expect(result.evaluatedSourceBadge).toBe('COMPANIES_HOUSE');
            expect(result.evaluatedSourceTimestamp).toEqual(chDate);
        });

        it('returns hasApplicableEvaluationAttempt = false when sync has never succeeded or failed', () => {
            const clientLE = {
                lei: '5493001KJTIIGC8Y1R12',
                gleifFetchedAt: null,
                registryReferences: []
            };
            const mappings = [{ sourceType: 'GLEIF', sourceReference: null }];

            const result = KycStateService.evaluateSyncAttempt(clientLE, mappings);
            expect(result.hasApplicableMapping).toBe(true);
            expect(result.hasApplicableEvaluationAttempt).toBe(false);
            expect(result.evaluatedSourceBadge).toBeNull();
            expect(result.evaluatedSourceTimestamp).toBeNull();
        });
    });

    describe('2. Workbench4 (getWorkbench4Data)', () => {
        beforeEach(() => {
            vi.restoreAllMocks();
        });

        it('preserves evaluated GLEIF source & timestamp in canonicalDisplayModel for CHECKED_NO_DATA single field', async () => {
            const gleifDate = new Date('2026-07-25T10:00:00.000Z');
            vi.spyOn(kycQuery, 'getConsoleQuestions').mockResolvedValueOnce([
                { id: 'q1', masterFieldNo: 10, questionnaireName: 'Q1', engagementOrgName: 'Org1' } as any
            ]);
            vi.spyOn(definitionService, 'listAllMasterFields').mockResolvedValueOnce([
                { fieldNo: 10, fieldName: 'Legal Form Code', isMultiValue: false, appDataType: 'TEXT' } as any
            ]);
            vi.spyOn(definitionService, 'listAllMasterGroupsWithItems').mockResolvedValueOnce([]);
            vi.spyOn(sourceLabelServer, 'fetchRaNameLookup').mockResolvedValueOnce({});

            vi.mocked(prisma.clientLE.findUnique).mockResolvedValueOnce({
                id: 'cle_1',
                legalEntityId: 'le_1',
                gleifFetchedAt: gleifDate,
                registryReferences: []
            } as any);

            vi.mocked((prisma as any).sourceFieldMapping.findMany).mockResolvedValueOnce([
                { targetFieldNo: 10, sourceType: 'GLEIF', sourceReference: null }
            ]);

            vi.spyOn(kycQuery, 'resolveMasterDataBatch').mockResolvedValueOnce({
                q1: {
                    10: { value: null, source: null, isSynced: false, updatedAt: null } as any
                }
            });

            const result = await getWorkbench4Data('cle_1');
            expect(result.questions).toHaveLength(1);
            const q = result.questions[0] as any;
            expect(q.canonicalDisplayModel).toBeDefined();
            expect(q.canonicalDisplayModel.state).toBe('CHECKED_NO_DATA');
            expect(q.canonicalDisplayModel.source).toBeDefined();
            expect(q.canonicalDisplayModel.source?.type).toBe('GLEIF');
            expect(q.canonicalDisplayModel.source?.label).toBe('GLEIF');
            expect(q.canonicalDisplayModel.source?.lastValidatedAt).toBe(gleifDate.toISOString());
        });
    });

    describe('3. /master (getFullMasterData)', () => {
        it('preserves evaluated Companies House source & timestamp in canonicalDisplayModel for scalar and repeating CHECKED_NO_DATA fields', async () => {
            const chDate = new Date('2026-07-26T15:00:00.000Z');
            vi.mocked(prisma.clientLE.findUnique).mockResolvedValueOnce({
                id: 'cle_1',
                legalEntityId: 'le_1',
                gleifFetchedAt: null,
                registryReferences: [
                    { authority: { registryKey: 'COMPANIES_HOUSE' }, lastSyncSucceededAt: chDate }
                ]
            } as any);

            vi.mocked((prisma as any).sourceFieldMapping.findMany).mockResolvedValueOnce([
                { targetFieldNo: 20, sourceType: 'COMPANIES_HOUSE', sourceReference: 'COMPANIES_HOUSE' },
                { targetFieldNo: 21, sourceType: 'COMPANIES_HOUSE', sourceReference: 'COMPANIES_HOUSE' }
            ]);

            vi.spyOn(definitionService, 'listAllMasterFields').mockResolvedValueOnce([
                { fieldNo: 20, fieldName: 'Company Category', isMultiValue: false, appDataType: 'TEXT' },
                { fieldNo: 21, fieldName: 'Previous Names', isMultiValue: true, appDataType: 'TEXT' }
            ] as any);

            vi.spyOn(KycStateService, 'resolveAllFields').mockResolvedValueOnce(
                new Map([
                    [20, null],
                    [21, []]
                ])
            );

            const result = await getFullMasterData('cle_1');
            expect(result.success).toBe(true);
            const scalarField = (result as any).data[20];
            expect(scalarField.displayState).toBe('CHECKED_NO_DATA');
            expect(scalarField.canonicalDisplayModel.source).toBeDefined();
            expect(scalarField.canonicalDisplayModel.source?.label).toBe('Companies House');
            expect(scalarField.canonicalDisplayModel.source?.lastValidatedAt).toBe(chDate.toISOString());

            const repeatingField = (result as any).data[21];
            expect(repeatingField.displayState).toBe('CHECKED_NO_DATA');
            expect(repeatingField.canonicalDisplayModel.source).toBeDefined();
            expect(repeatingField.canonicalDisplayModel.source?.label).toBe('Companies House');
            expect(repeatingField.canonicalDisplayModel.source?.lastValidatedAt).toBe(chDate.toISOString());
        });
    });

    describe('4. RHS Field Drawer & Group Sub-Fields (getFieldDetail)', () => {
        it('attaches evaluated source & lastValidatedAt to canonicalDisplayModel for scalar CHECKED_NO_DATA field in getFieldDetail', async () => {
            const gleifDate = new Date('2026-07-25T12:00:00.000Z');
            vi.mocked(prisma.masterFieldDefinition.findUnique).mockResolvedValue({
                fieldNo: 30,
                fieldName: 'Registration Status',
                appDataType: 'TEXT',
                isMultiValue: false
            } as any);

            vi.mocked(prisma.clientLE.findUnique).mockResolvedValue({
                id: 'cle_1',
                legalEntityId: 'le_1',
                gleifFetchedAt: gleifDate,
                registryReferences: []
            } as any);

            vi.spyOn(KycStateService, 'getAuthoritativeValue').mockResolvedValue(null);
            vi.mocked((prisma as any).sourceFieldMapping.findMany).mockImplementation(async (args: any) => {
                if (args?.where?.targetFieldNo === 30) {
                    return [{ targetFieldNo: 30, sourceType: 'GLEIF', sourceReference: null }];
                }
                return [];
            });
            vi.mocked(prisma.fieldClaim.findMany).mockResolvedValue([]);

            const result = await getFieldDetail('cle_1', 30, 'CLIENT_LE');
            expect(result.displayState).toBe('CHECKED_NO_DATA');
            expect((result as any).canonicalDisplayModel).toBeDefined();
            expect((result as any).canonicalDisplayModel.source?.type).toBe('GLEIF');
            expect((result as any).canonicalDisplayModel.source?.lastValidatedAt).toBe(gleifDate.toISOString());
        });
    });

    describe('5. PDF Export Consistency (resolveExportAnswer)', () => {
        it('resolves sourceLabel and sourceTimestamp for CHECKED_NO_DATA export fields', async () => {
            const chDate = new Date('2026-07-26T16:00:00.000Z');

            vi.mocked(prisma.masterFieldDefinition.findUnique).mockResolvedValue({
                fieldNo: 40,
                fieldName: 'F40 Test',
                appDataType: 'TEXT',
                isMultiValue: false
            } as any);

            vi.mocked(prisma.clientLE.findUnique).mockResolvedValue({
                id: 'cle_1',
                legalEntityId: 'le_1',
                gleifFetchedAt: null,
                registryReferences: [
                    { authority: { registryKey: 'COMPANIES_HOUSE' }, lastSyncSucceededAt: chDate }
                ]
            } as any);

            vi.spyOn(KycStateService, 'getAuthoritativeValue').mockResolvedValue(null);
            vi.mocked((prisma as any).sourceFieldMapping.findMany).mockImplementation(async (args: any) => {
                const target = args?.where?.targetFieldNo;
                const fNo = typeof target === 'number' ? target : (target?.in && Array.isArray(target.in) ? target.in[0] : null);
                if (fNo === 40) {
                    return [{ targetFieldNo: 40, sourceType: 'COMPANIES_HOUSE', sourceReference: 'COMPANIES_HOUSE' }];
                }
                return [];
            });

            const res = await resolveExportAnswer({
                id: 'q40',
                masterFieldNo: 40,
                questionText: 'Test Question'
            } as any, 'le_1', undefined, 'cle_1');

            expect(res.displayValue).toBe('None');
            expect(res.answerState).toBe('EMPTY_CHECKED');
            expect(res.sourceLabel).toBe('Companies House');
            expect(res.sourceTimestamp).toEqual(chDate);
        });
    });

    describe('6. Edge Cases & Boundary Conditions', () => {
        it('7. unmapped empty field has no source provenance', async () => {
            vi.mocked(prisma.clientLE.findUnique).mockResolvedValueOnce({
                id: 'cle_unmapped',
                legalEntityId: 'le_unmapped',
                gleifFetchedAt: null,
                registryReferences: []
            } as any);
            const result = await getFullMasterData('cle_unmapped');
            expect(result.success).toBe(true);
        });

        it('8. mapped but never checked field (MAPPED_NOT_CHECKED) has no lastValidatedAt timestamp', () => {
            const clientLE = { lei: '5493001KJTIIGC8Y1R12', gleifFetchedAt: null, registryReferences: [] };
            const mappings = [{ sourceType: 'GLEIF', sourceReference: null }];
            const evalResult = KycStateService.evaluateSyncAttempt(clientLE, mappings);

            expect(evalResult.hasApplicableMapping).toBe(true);
            expect(evalResult.hasApplicableEvaluationAttempt).toBe(false);
            expect(evalResult.evaluatedSourceTimestamp).toBeNull();
        });

        it('10. evaluated-source fallback does not overwrite valid claim-level provenance', async () => {
            const userClaimDate = new Date('2026-07-27T08:00:00.000Z');
            const gleifDate = new Date('2026-07-25T10:00:00.000Z');

            vi.mocked(prisma.clientLE.findUnique).mockResolvedValueOnce({
                id: 'cle_1',
                legalEntityId: 'le_1',
                gleifFetchedAt: gleifDate,
                registryReferences: []
            } as any);

            vi.mocked((prisma as any).sourceFieldMapping.findMany).mockResolvedValueOnce([
                { targetFieldNo: 50, sourceType: 'GLEIF', sourceReference: null }
            ]);

            vi.spyOn(definitionService, 'listAllMasterFields').mockResolvedValueOnce([
                { fieldNo: 50, fieldName: 'User Overridden Field', isMultiValue: false, appDataType: 'TEXT' }
            ] as any);

            vi.spyOn(KycStateService, 'resolveAllFields').mockResolvedValueOnce(
                new Map([
                    [50, {
                        value: 'User Value',
                        isScoped: true,
                        sourceType: 'USER_INPUT',
                        assertedAt: userClaimDate,
                        sourceCheckedAt: userClaimDate
                    } as any]
                ])
            );

            const result = await getFullMasterData('cle_1');
            const field = (result as any).data[50];
            expect(field.displayState).toBe('HAS_VALUE');
            expect(field.canonicalDisplayModel.source.type).toBe('USER_INPUT');
            expect(field.canonicalDisplayModel.source.label).toBe('User input');
            expect(field.canonicalDisplayModel.source.lastValidatedAt).toBe(userClaimDate.toISOString());
        });
    });
});
