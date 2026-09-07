import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next-auth', () => ({
    default: vi.fn(() => ({ handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() })),
    getServerSession: vi.fn()
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { getWorkbench4Data, mapQuestionToField } from '@/actions/kyc-workbench';
import { toExportText } from '@/lib/export/toExportText';
import { resolveFieldForDisplay, getCompactCanonicalSummary } from '@/lib/master-data/field-interpreter';
import { getPartyDisplayProjection } from '@/lib/master-data/party-value';
import prisma from '@/lib/prisma';
import * as kycQuery from '@/actions/kyc-query';
import * as definitionService from '@/services/masterData/definitionService';
import * as sourceLabelServer from '@/lib/kyc/source-label.server';
import { KycStateService } from '@/lib/kyc/KycStateService';
import * as auth from '@/lib/auth';
import * as permissions from '@/lib/auth/permissions';

vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn().mockResolvedValue({ userId: 'user-1' })
}));
vi.mock('@/lib/auth/permissions', () => ({
    can: vi.fn().mockResolvedValue(true),
    Action: { LE_VIEW_MASTER_DATA: 'le:view_master_data', LE_EDIT_MASTER_DATA: 'le:edit_master_data' }
}));

vi.mock('@/lib/prisma', () => ({
    default: {
        membership: { findMany: vi.fn().mockResolvedValue([]) },
        clientLE: { findUnique: vi.fn() },
        fieldClaim: { findMany: vi.fn().mockResolvedValue([]) },
        sourceFieldMapping: { findMany: vi.fn().mockResolvedValue([]) },
        customFieldDefinition: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn() },
        clientLEOwner: { findFirst: vi.fn().mockResolvedValue({ partyId: 'org1' }) },
        masterFieldDefinition: { findUnique: vi.fn() },
        question: {
            findUnique: vi.fn().mockResolvedValue({ questionnaireId: 'q-wf-1' }),
            update: vi.fn().mockResolvedValue({})
        },
        questionnaire: {
            findUnique: vi.fn().mockResolvedValue({ kind: 'QUESTIONNAIRE' })
        }
    }
}));

vi.mock('@/actions/questionnaire', () => ({
    ensureQuestionNotReferenceSnapshot: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('@/actions/kyc-query', () => ({
    getConsoleQuestions: vi.fn(),
    resolveMasterDataBatch: vi.fn(),
    resolveMasterData: vi.fn()
}));
vi.mock('@/lib/kyc/source-label.server', () => ({ fetchRaNameLookup: vi.fn().mockResolvedValue({}) }));
vi.mock('@/lib/kyc/KycStateService', () => ({
    KycStateService: {
        resolveScopeId: vi.fn().mockResolvedValue('scope-1'),
        resolveAllFields: vi.fn().mockResolvedValue([]),
        resolveAllAttachments: vi.fn().mockResolvedValue(new Map()),
        evaluateSyncAttempt: vi.fn().mockReturnValue({ hasApplicableMapping: true, hasApplicableEvaluationAttempt: true }),
        calculateDisplayState: vi.fn().mockReturnValue('HAS_VALUE')
    }
}));
vi.mock('@/services/masterData/definitionService', () => ({
    listAllMasterFields: vi.fn(),
    listAllMasterGroupsWithItems: vi.fn().mockResolvedValue([])
}));

describe('ONP-61 — Canonical Mask & Display Regression Tests (Field 201 Phone Mask)', () => {
    const mockPartyWithAllDetails = {
        contactType: 'PERSON',
        partyType: 'INDIVIDUAL',
        forenames: 'Xuejie',
        surname: 'Li',
        displayName: 'Xuejie Li',
        phones: [{ number: '+44 7123 456789', type: 'MOBILE', isPrimary: true }],
        email: 'xuejie.li@example.com',
        roles: [{ roleTitle: 'Finance Director', roleType: 'DIRECTOR', isActiveRole: true }],
        correspondenceAddress: { line1: '100 Bishopsgate', city: 'London', postalCode: 'EC2N 4AG', country: 'GB' },
        dateOfBirth: { year: 1982, month: 8, day: 15 }
    };

    const field201Definition = {
        fieldNo: 201,
        fieldName: 'Financing contact tel (incl IDD +xx)',
        appDataType: 'PARTY',
        isMultiValue: false,
        profileConfig: {
            displayMask: ['contact.phones']
        }
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── Suite 1: Workbench4 / Question Bank (getWorkbench4Data) ───────────────
    describe('1. Workbench4 / Question Bank canonical answer (getWorkbench4Data)', () => {
        it('propagates profileConfig.displayMask to canonicalDisplayModel so phone is preserved and unpermitted PII is masked out', async () => {
            vi.mocked(kycQuery.getConsoleQuestions).mockResolvedValueOnce([
                {
                    id: 'q-201',
                    masterFieldNo: 201,
                    text: 'FINANCING CONTACT TEL (INCL IDD +XX)',
                    questionnaireName: 'Finance WF',
                    engagementOrgName: 'Test Org'
                } as any
            ]);

            vi.mocked(definitionService.listAllMasterFields).mockResolvedValueOnce([field201Definition as any]);
            vi.mocked(prisma.clientLE.findUnique).mockResolvedValueOnce({
                id: 'le-1',
                legalEntityId: 'le-subject-1',
                customData: {}
            } as any);

            // Batch resolver returns the full party value
            vi.mocked(kycQuery.resolveMasterDataBatch).mockResolvedValueOnce({
                'q-201': {
                    '201': {
                        value: mockPartyWithAllDetails,
                        source: 'USER_INPUT',
                        sourceReference: 'MANUAL',
                        updatedAt: new Date('2026-09-01T12:00:00Z'),
                        sourceCheckedAt: new Date('2026-09-01T12:00:00Z'),
                        isSynced: true,
                        attachments: []
                    } as any
                }
            });

            const result = await getWorkbench4Data('le-1');
            expect(result).not.toBeNull();
            const q = result!.questions.find(item => item.id === 'q-201') as any;

            expect(q.canonicalDisplayModel).toBeDefined();
            expect(q.canonicalDisplayModel.fieldNo).toBe(201);

            // The canonical display model MUST reflect the displayMask from field201Definition.profileConfig
            const modelValue = q.canonicalDisplayModel.value;
            expect(modelValue.kind).toBe('party');
            expect(modelValue.displayMask).toEqual(['contact.phones']);

            // Verify masked projection on the party data:
            const partyData = modelValue.data;
            // 1. Phone MUST be preserved
            expect(partyData.phones).toHaveLength(1);
            expect(partyData.phones[0].number).toBe('+44 7123 456789');

            // 2. Identifier MUST remain available
            expect(modelValue.partyLabel || partyData.displayName).toContain('Xuejie Li');

            // 3. Excluded properties MUST be stripped
            expect(partyData.email).toBeNull();
            expect(partyData.roles).toEqual([]);
            expect(partyData.correspondenceAddress).toBeNull();
            expect(partyData.dateOfBirth).toBeNull();
        });
    });

    // ── Suite 2: Workbench dynamic/remapping path (mapQuestionToField) ─────────
    describe('2. Workbench dynamic remapping path (mapQuestionToField)', () => {
        it('propagates master field profileConfig.displayMask into newCanonicalDisplayModel when remapped', async () => {
            vi.mocked(prisma.masterFieldDefinition.findUnique).mockResolvedValueOnce(field201Definition as any);
            
            // Mock resolveMasterData batch lookup
            vi.mocked(kycQuery.resolveMasterData).mockResolvedValueOnce({
                'q-201': {
                    '201': {
                        value: mockPartyWithAllDetails,
                        source: 'USER_INPUT',
                        sourceReference: 'MANUAL',
                        updatedAt: new Date('2026-09-01T12:00:00Z'),
                        sourceCheckedAt: new Date('2026-09-01T12:00:00Z'),
                        isSynced: true
                    } as any
                }
            });

            const result = await mapQuestionToField('le-1', 'q-201', { fieldNo: 201 });
            expect(result.success).toBe(true);
            expect(result.newCanonicalDisplayModel).toBeDefined();

            const modelValue = result.newCanonicalDisplayModel.value;
            expect(modelValue.kind).toBe('party');
            expect(modelValue.displayMask).toEqual(['contact.phones']);

            // Assert phone preserved, excluded fields masked
            expect(modelValue.data.phones).toHaveLength(1);
            expect(modelValue.data.phones[0].number).toBe('+44 7123 456789');
            expect(modelValue.data.email).toBeNull();
            expect(modelValue.data.roles).toEqual([]);
        });
    });

    // ── Suite 3: PDF / Export text (toExportText & getPartyDisplayProjection) ──
    describe('3. PDF / Export text (toExportText & getPartyDisplayProjection)', () => {
        it('projects telephone numbers into secondaryParts when mask permits phones', () => {
            const proj = getPartyDisplayProjection(mockPartyWithAllDetails, ['contact.phones'], 'Xuejie Li');

            // Identifier always present
            expect(proj.primaryText).toBe('Xuejie Li');

            // Phone MUST be present in secondaryParts
            const phoneStr = proj.secondaryParts.find(p => p.includes('7123 456789'));
            expect(phoneStr).toBeDefined();
            expect(phoneStr).toContain('+44 7123 456789');

            // Excluded properties MUST NOT appear in secondaryParts or addressText
            expect(proj.secondaryParts.some(p => p.includes('xuejie.li@example.com'))).toBe(false);
            expect(proj.secondaryParts.some(p => p.includes('Finance Director'))).toBe(false);
            expect(proj.secondaryParts.some(p => p.includes('1982'))).toBe(false);
            expect(proj.addressText).toBe('');
        });

        it('toExportText includes telephone number and identifier while omitting excluded properties', () => {
            const model = resolveFieldForDisplay(
                mockPartyWithAllDetails,
                { type: 'USER_INPUT', reference: 'MANUAL' },
                {
                    fieldNo: 201,
                    label: 'Financing contact tel (incl IDD +xx)',
                    appDataType: 'PARTY',
                    displayState: 'HAS_VALUE',
                    profileConfig: { displayMask: ['contact.phones'] }
                }
            );

            const exportText = toExportText(model);

            // Phone and identifier MUST be present
            expect(exportText).toContain('Xuejie Li');
            expect(exportText).toContain('+44 7123 456789');

            // Excluded properties MUST be absent
            expect(exportText).not.toContain('xuejie.li@example.com');
            expect(exportText).not.toContain('Finance Director');
            expect(exportText).not.toContain('100 Bishopsgate');
            expect(exportText).not.toContain('1982');
        });

        it('NEGATIVE TEST: does NOT include phone when displayMask excludes phones', () => {
            // Mask only allows email
            const proj = getPartyDisplayProjection(mockPartyWithAllDetails, ['contact.email'], 'Xuejie Li');

            expect(proj.primaryText).toBe('Xuejie Li');
            expect(proj.secondaryParts).toContain('xuejie.li@example.com');

            // Phone MUST NOT appear
            expect(proj.secondaryParts.some(p => p.includes('7123 456789'))).toBe(false);

            const model = resolveFieldForDisplay(
                mockPartyWithAllDetails,
                null,
                {
                    fieldNo: 200,
                    label: 'Financing contact email',
                    appDataType: 'PARTY',
                    displayState: 'HAS_VALUE',
                    profileConfig: { displayMask: ['contact.email'] }
                }
            );
            const exportText = toExportText(model);
            expect(exportText).toContain('xuejie.li@example.com');
            expect(exportText).not.toContain('7123 456789');
        });
    });

    // ── Suite 4: SuperFieldSelector / Field Mapping preview ───────────────────
    describe('4. SuperFieldSelector / Field Mapping preview', () => {
        it('includes profileConfig in masterFields returned from kyc-workbench', async () => {
            vi.mocked(kycQuery.getConsoleQuestions).mockResolvedValueOnce([]);
            vi.mocked(definitionService.listAllMasterFields).mockResolvedValueOnce([field201Definition as any]);
            vi.mocked(prisma.clientLE.findUnique).mockResolvedValueOnce({
                id: 'le-1',
                legalEntityId: 'le-subject-1',
                customData: {}
            } as any);
            vi.mocked(kycQuery.resolveMasterDataBatch).mockResolvedValueOnce({});

            const result = await getWorkbench4Data('le-1');
            const f201 = result!.masterFields.find((f: any) => f.fieldNo === 201) as any;
            expect(f201).toBeDefined();
            // masterFields returned to the frontend MUST carry profileConfig
            expect(f201.profileConfig).toBeDefined();
            expect(f201.profileConfig.displayMask).toEqual(['contact.phones']);
        });

        it('getCompactCanonicalSummary respects displayMask for PARTY and formats phone when permitted', () => {
            const model = resolveFieldForDisplay(
                mockPartyWithAllDetails,
                null,
                {
                    fieldNo: 201,
                    label: 'Financing contact tel (incl IDD +xx)',
                    appDataType: 'PARTY',
                    displayState: 'HAS_VALUE',
                    profileConfig: { displayMask: ['contact.phones'] }
                }
            );

            const summary = getCompactCanonicalSummary(model, {
                label: 'Financing contact tel (incl IDD +xx)',
                appDataType: 'PARTY'
            });

            // Summary preview MUST show identifier + phone, and MUST NOT leak unpermitted email or role
            expect(summary).toContain('Xuejie Li');
            expect(summary).toContain('+44 7123 456789');
            expect(summary).not.toContain('Finance Director');
            expect(summary).not.toContain('xuejie.li@example.com');
        });
    });
});
