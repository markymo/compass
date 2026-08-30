/**
 * @vitest-environment happy-dom
 */
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { FieldDetailPanel } from '../field-detail-panel';
import * as kycQuery from '@/actions/kyc-query';
import * as clientLe from '@/actions/client-le';

vi.mock('@/actions/kyc-query', () => ({
    getFieldDetail: vi.fn(),
    getPartyDisplayAudit: vi.fn().mockResolvedValue({ success: true, changes: [] }),
    searchUnboundGraphNodes: vi.fn().mockResolvedValue({ success: true, nodes: [] })
}));

vi.mock('@/actions/client-le', () => ({
    getFieldUsageDetails: vi.fn()
}));

vi.mock('@/actions/kyc-manual-update', () => ({
    updateFieldManually: vi.fn().mockResolvedValue({ success: true }),
    applyCandidate: vi.fn().mockResolvedValue({ success: true }),
    updateCustomFieldManually: vi.fn().mockResolvedValue({ success: true }),
    addMultiValueEntry: vi.fn().mockResolvedValue({ success: true }),
    removeMultiValueEntry: vi.fn().mockResolvedValue({ success: true }),
    clearSingleValueEntry: vi.fn().mockResolvedValue({ success: true }),
    applyBulkOverride: vi.fn().mockResolvedValue({ success: true }),
    promoteClaim: vi.fn().mockResolvedValue({ success: true }),
    releaseFieldDefault: vi.fn().mockResolvedValue({ success: true }),
    releaseFieldAbsence: vi.fn().mockResolvedValue({ success: true }),
    restoreSourceValue: vi.fn().mockResolvedValue({ success: true })
}));

vi.mock('@/actions/cc-party-actions', () => ({
    getCCPartyUsage: vi.fn().mockResolvedValue({}),
    searchCCParties: vi.fn().mockResolvedValue([]),
    savePartyForReuse: vi.fn().mockResolvedValue({ success: true }),
    upsertCCParty: vi.fn().mockResolvedValue({ success: true })
}));

vi.mock('@/actions/cc-address-actions', () => ({
    getCCAddressUsage: vi.fn().mockResolvedValue({}),
    searchCCAddresses: vi.fn().mockResolvedValue([]),
    saveAddressForReuse: vi.fn().mockResolvedValue({ success: true }),
    upsertCCAddress: vi.fn().mockResolvedValue({ success: true })
}));

vi.mock('@/actions/master-data-notes', () => ({
    saveMasterFieldNote: vi.fn().mockResolvedValue({ success: true })
}));

vi.mock('@/actions/kanban-actions', () => ({
    getLETeamMembers: vi.fn().mockResolvedValue({ success: true, members: [] })
}));

vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn().mockResolvedValue({ userId: 'test-user', role: 'LE_ADMIN', orgId: 'org-test' }),
}));

vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: vi.fn(),
        replace: vi.fn(),
        prefetch: vi.fn(),
        refresh: vi.fn(),
    }),
}));

vi.mock('next-auth/react', () => ({
    useSession: () => ({
        data: { user: { id: 'usr-test', role: 'LE_ADMIN', orgId: 'org-test' } },
        status: 'authenticated'
    })
}));

describe('Track B: ONP-40 Downstream Master Field Usage in Drawer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('ONP-40: Master drawer displays consuming relationships, questionnaires, and questions with Question Bank links', async () => {
        (kycQuery.getFieldDetail as any).mockResolvedValue({
            fieldNo: 27,
            fieldName: 'Principal Place of Business',
            dataType: 'ADDRESS',
            isRepeating: false,
            isLocked: false,
            current: {
                value: { addressLines: ['100 Oxford Street'], city: 'London', postalCode: 'W1D 1LL', country: 'GB' },
                source: 'USER_INPUT',
                timestamp: new Date().toISOString()
            },
            canonicalDisplayModel: {
                isRepeating: false,
                value: {
                    kind: 'address',
                    data: { addressLines: ['100 Oxford Street'], city: 'London', postalCode: 'W1D 1LL', country: 'GB' }
                }
            }
        });

        (clientLe.getFieldUsageDetails as any).mockResolvedValue({
            totalQuestions: 2,
            totalQuestionnaires: 1,
            totalSuppliers: 1,
            relationships: [
                {
                    supplierId: 'sup-barclays-1',
                    supplierName: 'Barclays International',
                    supplierCode: 'BARC',
                    questionnaires: [
                        {
                            questionnaireId: 'qn-standard-kyc',
                            questionnaireName: 'Institutional Onboarding Questionnaire',
                            questions: [
                                { id: 'q-101', text: 'Please specify the main operating address of the fund.' },
                                { id: 'q-102', text: 'Provide physical address for executive team correspondence.' }
                            ]
                        }
                    ]
                }
            ]
        });

        render(
            <FieldDetailPanel
                open={true}
                onOpenChange={vi.fn()}
                clientLEId="client-le-1"
                fieldNo={27}
                fieldName="Principal Place of Business"
                mappingStats={{
                    questions: 2,
                    questionnaires: 1,
                    suppliers: 1
                }}
            />
        );

        // Wait for usage details to load
        await waitFor(() => {
            expect(screen.getByText('Barclays International')).toBeInTheDocument();
        });

        // 1. Verify Level 1: Supplier / Relationship
        const relHeader = await screen.findByText('Barclays International');
        expect(relHeader).toBeInTheDocument();
        expect(screen.getByText('BARC')).toBeInTheDocument();

        // 2. Verify Level 2: Questionnaire
        const qnTitle = await screen.findByText('Institutional Onboarding Questionnaire');
        expect(qnTitle).toBeInTheDocument();
        expect(screen.getByText('2 Qs')).toBeInTheDocument();

        // 3. Verify Level 3: Mapped Questions
        const q1Text = await screen.findByText(/"Please specify the main operating address of the fund\."/i);
        const q2Text = await screen.findByText(/"Provide physical address for executive team correspondence\."/i);
        expect(q1Text).toBeInTheDocument();
        expect(q2Text).toBeInTheDocument();

        // 4. Verify links to Question Bank (/workbench4)
        expect(relHeader.closest('a')?.getAttribute('href')).toContain('/workbench4?rel=Barclays%20International');
        expect(qnTitle.closest('a')?.getAttribute('href')).toContain('/workbench4?q=Institutional%20Onboarding%20Questionnaire');
        expect(q1Text.closest('a')?.getAttribute('href')).toContain('/workbench4?s=Please%20specify%20the%20main%20operating%20address%20of%20the%20fund.');
    });
});
