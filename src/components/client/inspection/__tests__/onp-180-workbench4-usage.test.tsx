/**
 * @vitest-environment happy-dom
 */
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
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

vi.mock('@/actions/system', () => ({
    getRegistryAuthorityNamesMap: vi.fn().mockResolvedValue({})
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

describe('ONP-180: Field Detail Panel Usage Details when mappingStats is omitted (Workbench4 path)', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        (kycQuery.getFieldDetail as any).mockResolvedValue({
            fieldNo: 15,
            fieldName: 'ORGANISATION CHART',
            dataType: 'DOCUMENT',
            isRepeating: false,
            isLocked: false,
            current: {
                value: null,
                source: 'NONE',
                timestamp: new Date().toISOString()
            },
            canonicalDisplayModel: {
                isRepeating: false,
                value: null
            }
        });
    });

    afterEach(() => {
        cleanup();
        document.body.innerHTML = '';
    });

    it('1. Workbench4 mapped field (mappingStats omitted) fetches usage details and DOES NOT show false "Not currently used" message', async () => {
        (clientLe.getFieldUsageDetails as any).mockResolvedValue({
            totalQuestions: 1,
            totalQuestionnaires: 1,
            totalSuppliers: 1,
            relationships: [
                {
                    supplierId: 'sup-barclays-1',
                    supplierName: 'Barclays',
                    supplierCode: 'BARC',
                    questionnaires: [
                        {
                            questionnaireId: 'qn-fmsb-1',
                            questionnaireName: 'FMSB Standard Questionnaire',
                            questions: [
                                { id: 'q-org-chart', text: 'ORGANISATION CHART' }
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
                clientLEId="le-barclays-1"
                fieldNo={15}
                fieldName="ORGANISATION CHART"
                // mappingStats is intentionally omitted (undefined), mimicking cross-questionnaire-mapper / Workbench4
            />
        );

        // Expect getFieldUsageDetails to have been called
        await waitFor(() => {
            expect(clientLe.getFieldUsageDetails).toHaveBeenCalledWith('le-barclays-1', 15, undefined);
        });

        // Usage relationship name should be rendered
        const relHeader = await screen.findByText('Barclays');
        expect(relHeader).toBeInTheDocument();

        // The false "Not currently used by any relationships or questionnaires." message MUST NOT be present
        expect(screen.queryByText(/Not currently used by any relationships or questionnaires/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/This field can still be completed as part of the Master Record/i)).not.toBeInTheDocument();
    });

    it('2. Genuine zero-usage field (mappingStats omitted) shows "Not currently used" ONLY after loading completes', async () => {
        (clientLe.getFieldUsageDetails as any).mockResolvedValue({
            totalQuestions: 0,
            totalQuestionnaires: 0,
            totalSuppliers: 0,
            relationships: []
        });

        render(
            <FieldDetailPanel
                open={true}
                onOpenChange={vi.fn()}
                clientLEId="le-barclays-1"
                fieldNo={15}
                fieldName="ORGANISATION CHART"
            />
        );

        await waitFor(() => {
            expect(clientLe.getFieldUsageDetails).toHaveBeenCalledWith('le-barclays-1', 15, undefined);
        });

        // After loading completes with zero usage, the notice should be rendered
        const notUsedMsg = await screen.findByText(/Not currently used by any relationships or questionnaires/i);
        expect(notUsedMsg).toBeInTheDocument();
    });

    it('3. Existing /master behavior (mappingStats supplied) continues to render usage details correctly', async () => {
        (clientLe.getFieldUsageDetails as any).mockResolvedValue({
            totalQuestions: 1,
            totalQuestionnaires: 1,
            totalSuppliers: 1,
            relationships: [
                {
                    supplierId: 'sup-barclays-1',
                    supplierName: 'Barclays',
                    supplierCode: 'BARC',
                    questionnaires: [
                        {
                            questionnaireId: 'qn-fmsb-1',
                            questionnaireName: 'FMSB Standard Questionnaire',
                            questions: [
                                { id: 'q-org-chart', text: 'ORGANISATION CHART' }
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
                clientLEId="le-barclays-1"
                fieldNo={15}
                fieldName="ORGANISATION CHART"
                mappingStats={{
                    questions: 1,
                    questionnaires: 1,
                    suppliers: 1
                }}
            />
        );

        await waitFor(() => {
            expect(screen.getByText('Barclays')).toBeInTheDocument();
        });

        expect(screen.queryByText(/Not currently used by any relationships or questionnaires/i)).not.toBeInTheDocument();
    });

    it('4. Does not flash "Not currently used" while usage details are loading', async () => {
        let resolveUsage: any;
        (clientLe.getFieldUsageDetails as any).mockImplementation(() => new Promise((resolve) => {
            resolveUsage = resolve;
        }));

        render(
            <FieldDetailPanel
                open={true}
                onOpenChange={vi.fn()}
                clientLEId="le-barclays-1"
                fieldNo={15}
                fieldName="ORGANISATION CHART"
            />
        );

        // While pending, should NOT show "Not currently used"
        expect(screen.queryByText(/Not currently used by any relationships or questionnaires/i)).not.toBeInTheDocument();

        // Resolve with zero usage
        resolveUsage({
            totalQuestions: 0,
            totalQuestionnaires: 0,
            totalSuppliers: 0,
            relationships: []
        });

        // Now after resolving zero usage, it should appear
        await waitFor(() => {
            expect(screen.getByText(/Not currently used by any relationships or questionnaires/i)).toBeInTheDocument();
        });
    });
});
