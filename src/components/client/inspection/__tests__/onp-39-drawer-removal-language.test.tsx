/**
 * @vitest-environment happy-dom
 */
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { FieldDetailPanel } from '../field-detail-panel';
import * as kycQuery from '@/actions/kyc-query';

vi.mock('@/actions/kyc-query', () => ({
    getFieldDetail: vi.fn(),
    getPartyDisplayAudit: vi.fn().mockResolvedValue({ success: true, changes: [] }),
    searchUnboundGraphNodes: vi.fn().mockResolvedValue({ success: true, nodes: [] })
}));

vi.mock('@/actions/client-le', () => ({
    getFieldUsageDetails: vi.fn().mockResolvedValue({ success: true, relationships: [] })
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

vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: vi.fn(),
        replace: vi.fn(),
        prefetch: vi.fn(),
        refresh: vi.fn(),
    }),
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

vi.mock('next-auth/react', () => ({
    useSession: () => ({
        data: { user: { id: 'usr-test', role: 'LE_ADMIN', orgId: 'org-test' } },
        status: 'authenticated'
    })
}));

describe('Track A: ONP-39 Drawer Removal Language (REF-04)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('REF-04: Master drawer removal interaction uses neutral "Remove from this field" / "Remove" and NEVER "Delete" or "Break link" jargon', async () => {
        // Mock Field 64 (repeating party field with a saved party reference)
        (kycQuery.getFieldDetail as any).mockResolvedValue({
            fieldNo: 64,
            fieldName: 'Significant Beneficial Owners',
            dataType: 'PARTY_REF',
            isRepeating: true,
            isLocked: false,
            current: {
                value: { ccPartyId: 'party-alice-123' },
                source: 'USER_INPUT',
                timestamp: new Date().toISOString()
            },
            rows: [
                {
                    id: 'claim-alice-1',
                    instanceId: 'inst-alice-1',
                    value: { ccPartyId: 'party-alice-123' },
                    label: 'Alice Smith',
                    isUserValue: true,
                    data: {
                        partyType: 'INDIVIDUAL',
                        individual: { givenName: 'Alice', familyName: 'Smith' },
                        resolvedSummary: 'Alice Smith'
                    }
                }
            ],
            canonicalDisplayModel: {
                isRepeating: true,
                values: [
                    {
                        claimId: 'claim-alice-1',
                        party: {
                            partyType: 'INDIVIDUAL',
                            individual: { givenName: 'Alice', familyName: 'Smith' }
                        }
                    }
                ]
            }
        });

        render(
            <FieldDetailPanel
                open={true}
                onOpenChange={vi.fn()}
                clientLEId="client-le-test"
                fieldNo={64}
                fieldName="Significant Beneficial Owners"
            />
        );

        // Wait for drawer to render
        await waitFor(() => {
            expect(screen.getAllByText(/Significant Beneficial Owners/i).length).toBeGreaterThan(0);
        });

        // 1. Assert the reference removal action is NEVER labelled "Delete" anywhere
        expect(screen.queryByTitle(/delete/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/delete/i)).not.toBeInTheDocument();

        // 2. Trigger button must NOT use "Break link" jargon
        const breakLinkTrigger = screen.queryByTitle(/break link/i);
        const removeTrigger = screen.queryByTitle(/remove/i);
        expect(breakLinkTrigger).toBeNull();
        expect(removeTrigger).not.toBeNull();

        // 3. Activate the removal control to open the confirmation UI
        const triggerToClick = removeTrigger || breakLinkTrigger;
        if (triggerToClick) {
            fireEvent.click(triggerToClick);
        }

        // 4. Assert the confirmation UI renders
        // The confirmation prompt must use neutral removal language (e.g. Remove Alice Smith from this field?)
        // and must NEVER say "Break link to..." or "Delete..."
        const confirmationBreakLinkText = screen.queryByText(/break link/i);
        expect(confirmationBreakLinkText).toBeNull();

        // 5. Assert the confirmation action button uses neutral removal language (e.g. "Yes, remove" or "Remove", NEVER "Yes, break link")
        const confirmBreakLinkBtn = screen.queryByRole('button', { name: /break link/i });
        const confirmRemoveBtn = screen.queryByRole('button', { name: /remove/i });
        expect(confirmBreakLinkBtn).toBeNull();
        expect(confirmRemoveBtn).not.toBeNull();
    });
});
