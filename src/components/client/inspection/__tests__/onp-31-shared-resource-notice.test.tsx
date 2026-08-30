/**
 * @vitest-environment happy-dom
 */
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SharedResourceUsageNotice } from '../SharedResourceUsageNotice';
import * as ccPartyActions from '@/actions/cc-party-actions';
import * as ccAddressActions from '@/actions/cc-address-actions';

vi.mock('@/actions/cc-party-actions', () => ({
    getCCPartyUsage: vi.fn()
}));

vi.mock('@/actions/cc-address-actions', () => ({
    getCCAddressUsage: vi.fn()
}));

describe('Track B: ONP-31 Shared Resource Usage Notice Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('ONP-31 UI-01: Shared party edit notice provides explicit dossier-wide update warning, not vague "may appear elsewhere"', async () => {
        (ccPartyActions.getCCPartyUsage as any).mockResolvedValue({
            'party-alice': [
                { fieldNo: 64, fieldName: 'Significant Beneficial Owners' },
                { fieldNo: 104, fieldName: 'Authorised Signatories' }
            ]
        });

        render(
            <SharedResourceUsageNotice
                resourceType="PARTY"
                displayTypeLabel="person"
                resourceId="party-alice"
                clientLEId="client-le-1"
                currentFieldNo={64}
            />
        );

        await waitFor(() => {
            expect(screen.getByText(/Editing shared person/i)).toBeInTheDocument();
        });

        // 1. Assert required explicit consequence copy
        // Required meaning: "You are editing a saved/shared party. Saving changes will update it everywhere it is currently used in this dossier."
        const warningParagraph = screen.getByText(/You are editing a saved\/shared person\. Saving changes will update it everywhere/i);
        expect(warningParagraph).toBeInTheDocument();

        // 2. Assert that vague copy is NOT present
        const vagueCopy = screen.queryByText(/may appear anywhere/i);
        expect(vagueCopy).toBeNull();

        // 3. Assert active references are listed
        expect(screen.getByText(/Field reference 64/i)).toBeInTheDocument();
        expect(screen.getByText(/Field reference 104/i)).toBeInTheDocument();
        expect(screen.getByText('Current')).toBeInTheDocument();
    });

    it('ONP-31 UI-02: Single-field usage clearly states "Currently only used here"', async () => {
        (ccPartyActions.getCCPartyUsage as any).mockResolvedValue({
            'party-alice': [
                { fieldNo: 64, fieldName: 'Significant Beneficial Owners' }
            ]
        });

        render(
            <SharedResourceUsageNotice
                resourceType="PARTY"
                displayTypeLabel="person"
                resourceId="party-alice"
                clientLEId="client-le-1"
                currentFieldNo={64}
            />
        );

        await waitFor(() => {
            expect(screen.getByText('Currently only used here.')).toBeInTheDocument();
        });
    });
});
