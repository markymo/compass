/**
 * @vitest-environment happy-dom
 */
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
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

describe('Track D: ONP-32 Neutral Editing Language', () => {
    beforeEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    it('COPY-01: Ordinary scalar edit uses neutral Save & Notes language, never "Save Override" or "Override Notes"', async () => {
        (kycQuery.getFieldDetail as any).mockResolvedValue({
            fieldNo: 18,
            fieldName: 'Registered number',
            dataType: 'TEXT',
            isRepeating: false,
            isLocked: false,
            current: {
                value: '12345678',
                source: 'USER_INPUT',
                timestamp: new Date().toISOString()
            }
        });

        render(
            <FieldDetailPanel
                open={true}
                onOpenChange={vi.fn()}
                clientLEId="client-le-1"
                fieldNo={18}
                fieldName="Registered number"
            />
        );

        await waitFor(() => {
            expect(screen.getAllByText(/Registered number/i).length).toBeGreaterThan(0);
        });

        // Click Edit Pencil
        const editButton = screen.getByTitle('Edit value');
        fireEvent.click(editButton);

        // 1. Assert Save button is labelled "Save" (NOT "Save Override")
        const saveButton = screen.getByRole('button', { name: /^save$/i });
        expect(saveButton).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /save override/i })).toBeNull();

        // 2. Assert Audit Notes section is neutral
        expect(screen.getByText(/Audit Notes/i)).toBeInTheDocument();
        expect(screen.queryByText(/Override Notes/i)).toBeNull();

        // 3. Assert textarea placeholder is neutral
        const textarea = screen.getByPlaceholderText(/Add notes about this edit \(optional\)\.\.\./i);
        expect(textarea).toBeInTheDocument();
        expect(screen.queryByPlaceholderText(/Add notes about this override/i)).toBeNull();
    });

    it('COPY-02: Source-backed value edit uses neutral Save & Notes language', async () => {
        (kycQuery.getFieldDetail as any).mockResolvedValue({
            fieldNo: 3,
            fieldName: 'Legal name',
            dataType: 'TEXT',
            isRepeating: false,
            isLocked: false,
            current: {
                value: 'ACME CORP LIMITED',
                source: 'COMPANY_REGISTRY',
                timestamp: new Date().toISOString()
            }
        });

        render(
            <FieldDetailPanel
                open={true}
                onOpenChange={vi.fn()}
                clientLEId="client-le-1"
                fieldNo={3}
                fieldName="Legal name"
            />
        );

        await waitFor(() => {
            expect(screen.getAllByText(/Legal name/i).length).toBeGreaterThan(0);
        });

        // Click Edit Pencil (async wait for data to load)
        const editButton = await screen.findByTitle('Edit value');
        fireEvent.click(editButton);

        // 1. Assert neutral Save button
        expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /save override/i })).toBeNull();

        // 2. Assert neutral Notes placeholder
        expect(screen.getByPlaceholderText(/Add notes about this edit \(optional\)\.\.\./i)).toBeInTheDocument();
        expect(screen.queryByPlaceholderText(/override/i)).toBeNull();
    });
});
