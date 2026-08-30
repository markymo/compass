/**
 * @vitest-environment happy-dom
 */
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { PersonOrContactValueViewer } from '../PersonOrContactValueViewer';
import { AddressValueViewer } from '../AddressValueViewer';
import { FieldDetailPanel } from '../../inspection/field-detail-panel';
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

describe('Track C: ONP-42 & ONP-45 Save for Reuse State Machine', () => {
    beforeEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    const embeddedParty = {
        partyType: 'INDIVIDUAL' as const,
        contactType: 'PERSON' as const,
        forenames: 'Eleanor',
        surname: 'Vance',
        roles: ['Director'],
        isActivePersonOrContact: true
    };

    it('REUSE-01: State A (Embedded unpromoted) renders exactly ONE actionable "Save for reuse" button', () => {
        const onSaveForReuse = vi.fn();

        const { rerender } = render(
            <PersonOrContactValueViewer
                value={embeddedParty}
                claimId="claim-embedded-1"
                isPromotedToCCC={false}
                onSaveForReuse={onSaveForReuse}
                layout="compact"
            />
        );

        // Compact layout
        let actionButtons = screen.getAllByRole('button', { name: /save for reuse/i });
        expect(actionButtons).toHaveLength(1);
        expect(screen.queryByText(/saved for reuse/i)).toBeNull();

        // Row layout
        rerender(
            <PersonOrContactValueViewer
                value={embeddedParty}
                claimId="claim-embedded-1"
                isPromotedToCCC={false}
                onSaveForReuse={onSaveForReuse}
                layout="row"
            />
        );
        actionButtons = screen.getAllByRole('button', { name: /save for reuse/i });
        expect(actionButtons).toHaveLength(1);
        expect(screen.queryByText(/saved for reuse/i)).toBeNull();

        // Detailed layout
        rerender(
            <PersonOrContactValueViewer
                value={embeddedParty}
                claimId="claim-embedded-1"
                isPromotedToCCC={false}
                onSaveForReuse={onSaveForReuse}
                layout="detailed"
            />
        );
        actionButtons = screen.getAllByRole('button', { name: /save for reuse/i });
        expect(actionButtons).toHaveLength(1);
        expect(screen.queryByText(/saved for reuse/i)).toBeNull();
    });

    it('REUSE-02: State B (Already reusable / CCParty) renders ZERO actionable buttons and at most ONE "Saved for reuse" badge', () => {
        const onSaveForReuse = vi.fn();

        const { rerender } = render(
            <PersonOrContactValueViewer
                value={embeddedParty}
                claimId="claim-promoted-1"
                isPromotedToCCC={true}
                onSaveForReuse={onSaveForReuse}
                layout="compact"
            />
        );

        // Compact layout
        expect(screen.queryByRole('button', { name: /save for reuse/i })).toBeNull();
        expect(screen.getAllByText(/saved for reuse/i)).toHaveLength(1);

        // Row layout
        rerender(
            <PersonOrContactValueViewer
                value={embeddedParty}
                claimId="claim-promoted-1"
                isPromotedToCCC={true}
                onSaveForReuse={onSaveForReuse}
                layout="row"
            />
        );
        expect(screen.queryByRole('button', { name: /save for reuse/i })).toBeNull();
        expect(screen.getAllByText(/saved for reuse/i)).toHaveLength(1);

        // Detailed layout
        rerender(
            <PersonOrContactValueViewer
                value={embeddedParty}
                claimId="claim-promoted-1"
                isPromotedToCCC={true}
                onSaveForReuse={onSaveForReuse}
                layout="detailed"
            />
        );
        expect(screen.queryByRole('button', { name: /save for reuse/i })).toBeNull();
        expect(screen.getAllByText(/saved for reuse/i)).toHaveLength(1);
    });

    it('REUSE-03: State C (Promotion lifecycle) transitions from Save for reuse -> Saved for reuse without duplicate controls', async () => {
        let isPromoted = false;
        const handleSave = vi.fn(() => {
            isPromoted = true;
        });

        const { rerender } = render(
            <PersonOrContactValueViewer
                value={embeddedParty}
                claimId="claim-dyn-1"
                isPromotedToCCC={isPromoted}
                onSaveForReuse={handleSave}
                layout="row"
            />
        );

        const btn = screen.getByRole('button', { name: /save for reuse/i });
        fireEvent.click(btn);
        expect(handleSave).toHaveBeenCalledTimes(1);

        // Re-render with promoted state
        rerender(
            <PersonOrContactValueViewer
                value={embeddedParty}
                claimId="claim-dyn-1"
                isPromotedToCCC={true}
                onSaveForReuse={handleSave}
                layout="row"
            />
        );

        expect(screen.queryByRole('button', { name: /save for reuse/i })).toBeNull();
        expect(screen.getAllByText(/saved for reuse/i)).toHaveLength(1);
    });

    it('REUSE-04: Drawer rendering for F64 / F274 never produces duplicate Save for reuse controls for the same entity', async () => {
        (kycQuery.getFieldDetail as any).mockResolvedValue({
            fieldNo: 64,
            fieldName: 'Significant Beneficial Owners',
            dataType: 'PARTY',
            isRepeating: true,
            isLocked: false,
            current: {
                value: { forenames: 'Arthur', surname: 'Dent', partyType: 'INDIVIDUAL' },
                source: 'COMPANY_REGISTRY',
                timestamp: new Date().toISOString()
            },
            rows: [
                {
                    id: 'claim-f64-row-1',
                    instanceId: 'inst-f64-1',
                    value: { forenames: 'Arthur', surname: 'Dent', partyType: 'INDIVIDUAL' },
                    label: 'Arthur Dent',
                    isUserValue: false,
                    data: {
                        partyType: 'INDIVIDUAL',
                        individual: { givenName: 'Arthur', familyName: 'Dent' },
                        resolvedSummary: 'Arthur Dent'
                    }
                }
            ],
            canonicalDisplayModel: {
                isRepeating: true,
                values: [
                    {
                        claimId: 'claim-f64-row-1',
                        isPromotedToCCC: false,
                        party: {
                            partyType: 'INDIVIDUAL',
                            individual: { givenName: 'Arthur', familyName: 'Dent' }
                        }
                    }
                ]
            }
        });

        render(
            <FieldDetailPanel
                open={true}
                onOpenChange={vi.fn()}
                clientLEId="client-le-1"
                fieldNo={64}
                fieldName="Significant Beneficial Owners"
            />
        );

        await waitFor(() => {
            expect(screen.getAllByText(/Significant Beneficial Owners/i).length).toBeGreaterThan(0);
        });

        // Assert exactly 1 "Save for reuse" control appears for Arthur Dent (never 2 duplicate badges)
        const saveControls = screen.queryAllByText(/save for reuse/i);
        expect(saveControls.length).toBe(1);
    });

    it('REUSE-05: Address state parity — unpromoted Address has 1 Save for reuse; promoted CCAddress has 0 buttons and 1 Saved badge', () => {
        const onSaveForReuse = vi.fn();
        const addressData = {
            addressLines: ['10 Downing Street'],
            city: 'London',
            postalCode: 'SW1A 2AA',
            country: 'GB'
        };

        // State A: Unpromoted address
        const { rerender } = render(
            <AddressValueViewer
                value={addressData}
                claimId="claim-addr-1"
                isPromotedToCCC={false}
                onSaveForReuse={onSaveForReuse}
            />
        );

        expect(screen.getAllByRole('button', { name: /save for reuse/i })).toHaveLength(1);
        expect(screen.queryByText(/saved for reuse/i)).toBeNull();

        // State B: Promoted address
        rerender(
            <AddressValueViewer
                value={addressData}
                claimId="claim-addr-1"
                isPromotedToCCC={true}
                onSaveForReuse={onSaveForReuse}
            />
        );

        expect(screen.queryByRole('button', { name: /save for reuse/i })).toBeNull();
        expect(screen.getAllByText(/saved for reuse/i)).toHaveLength(1);
    });
});
