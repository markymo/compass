import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveExportAnswer } from '@/lib/export/export-answer-resolver';
import { KycStateService } from '@/lib/kyc/KycStateService';
import * as kycQuery from '@/actions/kyc-query';
import * as defService from '@/services/masterData/definitionService';

// Contract: QB-01 — Mapped person/party Master data flows to Question Bank/Workbench
// Linear: ONP-61

vi.mock('@/lib/kyc/KycStateService', () => ({
    KycStateService: {
        getAuthoritativeValue: vi.fn(),
        getAuthoritativeCollection: vi.fn(),
        resolveAllAttachments: vi.fn(),
    }
}));

vi.mock('@/actions/kyc-query', () => ({
    getFieldDetail: vi.fn(),
    getCCAddresses: vi.fn().mockResolvedValue([]),
    enrichPartyReferences: vi.fn().mockResolvedValue(undefined),
    enrichAddressReferences: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/services/masterData/definitionService', () => ({
    getMasterFieldDefinition: vi.fn(),
    getMasterFieldGroup: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
    default: {
        fieldClaim: {
            findUnique: vi.fn().mockResolvedValue({
                id: 'claim-1',
                verifiedBy: { name: 'Alice Admin', email: 'alice@example.com' }
            }),
            findMany: vi.fn().mockResolvedValue([])
        },
        submissionAnswer: {
            findFirst: vi.fn().mockResolvedValue(null)
        },
        cCParty: {
            findMany: vi.fn().mockResolvedValue([])
        },
        cCAddress: {
            findMany: vi.fn().mockResolvedValue([])
        }
    }
}));

describe('QB-01 / ONP-61 — Mapped Person/Party Master Data Flow to Question Bank/Workbench', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(KycStateService.resolveAllAttachments).mockResolvedValue(new Map());
    });

    it('1. Mapped single party field (e.g. F104 Key Contact) flows canonical Master data (name, role, email) to question answer', async () => {
        const question = {
            id: 'q-104',
            text: 'Who is the Primary Contact Person?',
            masterFieldNo: 104,
            status: 'OPEN'
        };

        const mockPartyValue = {
            contactType: 'PERSON',
            partyType: 'INDIVIDUAL',
            forenames: 'Eleanor Jane',
            surname: 'Vance',
            email: 'eleanor.vance@hillhouse.example',
            roles: [{ roleType: 'CONTACT', roleTitle: 'Primary Compliance Contact' }],
            correspondenceAddress: { line1: '42 Hillcrest Ave', city: 'Bath', postalCode: 'BA1 1AA', country: 'GB' }
        };

        vi.mocked(defService.getMasterFieldDefinition).mockResolvedValue({
            fieldNo: 104,
            name: 'Key Contact Person',
            appDataType: 'PARTY',
            isMultiValue: false,
            profileConfig: { displayMask: ['forenames', 'surname', 'email', 'roles'] }
        } as any);

        vi.mocked(kycQuery.getFieldDetail).mockResolvedValue({
            fieldNo: 104,
            dataType: 'PARTY',
            isRepeating: false,
            profileConfig: { displayMask: ['forenames', 'surname', 'email', 'roles'] },
            current: {
                value: mockPartyValue,
                source: 'USER_INPUT',
                sourceReference: 'MANUAL_ENTRY',
                assertedAt: new Date('2026-08-01T10:00:00Z'),
                claimId: 'claim-1'
            }
        } as any);

        vi.mocked(KycStateService.getAuthoritativeValue).mockResolvedValue({
            value: mockPartyValue,
            sourceType: 'USER_INPUT',
            sourceReference: 'MANUAL_ENTRY',
            assertedAt: new Date('2026-08-01T10:00:00Z'),
            claimId: 'claim-1'
        } as any);

        const res = await resolveExportAnswer(question, 'le-123', 'scope-123', 'entity-123');

        expect(res.answerState).toBe('HAS_VALUE');
        expect(res.displayValue).toContain('Eleanor Jane Vance');
        expect(res.displayValue).toContain('eleanor.vance@hillhouse.example');
        expect(res.sourceCategory).toBe('USER');
    });

    it('2. Mapped multi-party collection (e.g. F63 Directors) flows all canonical Director parties to question answer', async () => {
        const question = {
            id: 'q-63',
            text: 'List all Directors of the Legal Entity',
            masterFieldNo: 63,
            status: 'OPEN'
        };

        const mockDirectorsCollection = [
            {
                contactType: 'PERSON',
                partyType: 'INDIVIDUAL',
                forenames: 'David',
                surname: 'Murray',
                roles: [{ roleType: 'DIRECTOR', roleTitle: 'Executive Director' }]
            },
            {
                contactType: 'PERSON',
                partyType: 'INDIVIDUAL',
                forenames: 'Sarah',
                surname: 'Jenkins',
                roles: [{ roleType: 'DIRECTOR', roleTitle: 'Non-Executive Director' }]
            }
        ];

        vi.mocked(defService.getMasterFieldDefinition).mockResolvedValue({
            fieldNo: 63,
            name: 'Company Directors',
            appDataType: 'PARTY',
            isMultiValue: true,
            profileConfig: { displayMask: ['forenames', 'surname', 'roles'] }
        } as any);

        vi.mocked(kycQuery.getFieldDetail).mockResolvedValue({
            fieldNo: 63,
            dataType: 'PARTY',
            isRepeating: true,
            profileConfig: { displayMask: ['forenames', 'surname', 'roles'] },
            current: {
                value: mockDirectorsCollection,
                source: 'REGISTRATION_AUTHORITY',
                sourceReference: 'COMPANIES_HOUSE',
                assertedAt: new Date('2026-08-01T10:00:00Z'),
                claimId: 'claim-63'
            }
        } as any);

        vi.mocked(KycStateService.getAuthoritativeCollection).mockResolvedValue(
            mockDirectorsCollection.map((dir, i) => ({
                value: dir,
                sourceType: 'REGISTRATION_AUTHORITY',
                sourceReference: 'COMPANIES_HOUSE',
                assertedAt: new Date('2026-08-01T10:00:00Z'),
                instanceId: `inst-${i}`
            })) as any
        );

        const res = await resolveExportAnswer(question, 'le-123', 'scope-123', 'entity-123');

        expect(res.answerState).toBe('HAS_VALUE');
        expect(res.displayValue).toContain('David Murray');
        expect(res.displayValue).toContain('Sarah Jenkins');
    });

    it('3. Unmapped question cleanly resolves to NO_RESPONSE without error or misdiagnosed data-flow failure', async () => {
        const unmappedQuestion = {
            id: 'q-unmapped',
            text: 'Historical Question Without Mapping',
            masterFieldNo: null,
            status: 'OPEN'
        };

        const res = await resolveExportAnswer(unmappedQuestion, 'le-123', 'scope-123', 'entity-123');

        expect(res.answerState).toBe('NO_RESPONSE');
        expect(res.displayValue).toBe('No response recorded');
        expect(res.sourceCategory).toBe('NO_RESPONSE');
    });
});
