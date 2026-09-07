/**
 * @vitest-environment happy-dom
 */
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Rdd1QuestionCard } from '../rdd1/rdd1-question-card';
import { Rdd1MasterValueDisplay } from '../rdd1/rdd1-master-value-display';
import { ConsoleQuestion } from '@/actions/kyc-query';
import { resolveFieldForDisplay } from '@/lib/master-data/field-interpreter';
import { toExportText } from '@/lib/export/toExportText';
import { FieldValueRenderer } from '@/components/client/fields/FieldValueRenderer';

vi.mock('next-auth/react', () => ({
    useSession: () => ({ data: { user: { role: 'LE_ADMIN' } }, status: 'authenticated' })
}));

describe('ONP-61 — Workbench4 RDD1 Main Card Canonical Mask Enforcement', () => {
    afterEach(() => {
        cleanup();
    });
    const mockPartyWithAllDetails = {
        contactType: 'PERSON',
        partyType: 'INDIVIDUAL',
        forenames: 'Xuejie',
        surname: 'Li',
        displayName: 'Xuejie Li',
        phones: [{ number: '+44 7123 456789', type: 'TEL', isPrimary: true }],
        email: 'Xuejie_TEST@TEST_EMAIL.com',
        roles: [{ roleTitle: 'director', roleType: 'DIRECTOR', appointedOn: '2026-08-07', isActiveRole: true }],
        correspondenceAddress: { line1: '123 Test Street', city: 'London', postalCode: 'EC1A 1BB', country: 'GB' },
        dateOfBirth: { year: 1988, month: 1 }
    };

    const field201ProfileConfig = {
        displayMask: ['contact.phones']
    };

    const field201CanonicalModel = resolveFieldForDisplay(
        mockPartyWithAllDetails,
        { type: 'USER_INPUT', reference: 'MANUAL' } as any,
        {
            fieldNo: 201,
            label: 'FINANCING CONTACT TEL (INCL IDD +XX)',
            appDataType: 'PARTY',
            isMultiValue: false,
            profileConfig: field201ProfileConfig
        }
    );

    const mockQuestion201: ConsoleQuestion = {
        id: 'q-201',
        masterFieldNo: 201,
        text: 'FINANCING CONTACT TEL (INCL IDD +XX)',
        questionnaireName: 'Credit Assessment',
        engagementOrgName: 'RiskBridge Capital',
        status: 'DRAFT',
        canonicalDisplayModel: field201CanonicalModel,
        masterDataValue: mockPartyWithAllDetails as any
    } as any;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('1. RDD1 Question Card (Main View) — Field 201 Phone Mask', () => {
        it('renders permitted party identifier and phone while strictly omitting unpermitted role, DOB, email, and address', () => {
            render(
                <Rdd1QuestionCard
                    question={mockQuestion201}
                    leId="le-1"
                    masterFields={[{ fieldNo: 201, label: 'FINANCING CONTACT TEL (INCL IDD +XX)' }]}
                    masterGroups={[]}
                    customFields={[]}
                    raNameLookup={{}}
                    onInspectMapping={vi.fn()}
                />
            );

            // 1. Permitted properties MUST be visible
            expect(screen.getByText(/Xuejie Li/i)).toBeInTheDocument();
            expect(screen.getByText(/\+44 7123 456789/i)).toBeInTheDocument();

            // 2. Excluded properties MUST NOT be visible (no data leakage)
            expect(screen.queryByText(/director/i)).not.toBeInTheDocument();
            expect(screen.queryByText(/1988/i)).not.toBeInTheDocument();
            expect(screen.queryByText(/Xuejie_TEST@TEST_EMAIL\.com/i)).not.toBeInTheDocument();
            expect(screen.queryByText(/Test Street/i)).not.toBeInTheDocument();
        });

        it('Rdd1MasterValueDisplay renders permitted party identifier and phone while strictly omitting unpermitted fields', () => {
            render(
                <Rdd1MasterValueDisplay
                    question={mockQuestion201}
                    leId="le-1"
                    isMapped={true}
                    raNameLookup={{}}
                />
            );

            // Permitted
            expect(screen.getByText(/Xuejie Li/i)).toBeInTheDocument();
            expect(screen.getByText(/\+44 7123 456789/i)).toBeInTheDocument();

            // Excluded
            expect(screen.queryByText(/director/i)).not.toBeInTheDocument();
            expect(screen.queryByText(/1988/i)).not.toBeInTheDocument();
            expect(screen.queryByText(/Xuejie_TEST@TEST_EMAIL\.com/i)).not.toBeInTheDocument();
            expect(screen.queryByText(/Test Street/i)).not.toBeInTheDocument();
        });
    });

    describe('2. Multi-Mode Workbench4 Parity (Compact, Classic, Flow)', () => {
        it('Compact / Row mode (FieldValueRenderer) renders Xuejie Li + phone without leaking role/DOB/email/address', () => {
            const { container } = render(
                <FieldValueRenderer field={field201CanonicalModel} layout="compact" />
            );

            expect(container.textContent).toContain('Xuejie Li');
            expect(container.textContent).toContain('+44 7123 456789');
            expect(container.textContent).not.toContain('director');
            expect(container.textContent).not.toContain('1988');
            expect(container.textContent).not.toContain('Xuejie_TEST@TEST_EMAIL.com');
            expect(container.textContent).not.toContain('Test Street');
        });

        it('Row mode (FieldValueRenderer layout="row") renders Xuejie Li + phone without leaking role/DOB/email/address', () => {
            const { container } = render(
                <FieldValueRenderer field={field201CanonicalModel} layout="row" />
            );

            expect(container.textContent).toContain('Xuejie Li');
            expect(container.textContent).toContain('+44 7123 456789');
            expect(container.textContent).not.toContain('director');
            expect(container.textContent).not.toContain('1988');
            expect(container.textContent).not.toContain('Xuejie_TEST@TEST_EMAIL.com');
            expect(container.textContent).not.toContain('Test Street');
        });
    });

    describe('3. Negative Regression Controls', () => {
        it('Unmasked Party Field (control): renders role, DOB, email when displayMask is absent', () => {
            const unmaskedModel = resolveFieldForDisplay(
                mockPartyWithAllDetails,
                null,
                {
                    fieldNo: 100,
                    label: 'KEY CONTACT',
                    appDataType: 'PARTY',
                    isMultiValue: false,
                    profileConfig: undefined // no mask
                }
            );

            const { container } = render(
                <FieldValueRenderer field={unmaskedModel} layout="row" />
            );

            // Unmasked party includes full secondary details
            expect(container.textContent).toContain('Xuejie Li');
            expect(container.textContent).toContain('director');
            expect(container.textContent).toContain('1988');
            expect(container.textContent).toContain('Xuejie_TEST@TEST_EMAIL.com');
        });

        it('Differently Masked Field — Role-only mask: renders role but strictly hides phone, DOB, email', () => {
            const roleOnlyModel = resolveFieldForDisplay(
                mockPartyWithAllDetails,
                null,
                {
                    fieldNo: 101,
                    label: 'OFFICER ROLE',
                    appDataType: 'PARTY',
                    isMultiValue: false,
                    profileConfig: { displayMask: ['roles'] }
                }
            );

            const { container } = render(
                <FieldValueRenderer field={roleOnlyModel} layout="row" />
            );

            expect(container.textContent).toContain('Xuejie Li');
            expect(container.textContent).toContain('director');
            expect(container.textContent).not.toContain('+44 7123 456789');
            expect(container.textContent).not.toContain('1988');
            expect(container.textContent).not.toContain('Xuejie_TEST@TEST_EMAIL.com');
        });

        it('Differently Masked Field — DOB-only mask: renders DOB but strictly hides phone, role, email', () => {
            const dobOnlyModel = resolveFieldForDisplay(
                mockPartyWithAllDetails,
                null,
                {
                    fieldNo: 102,
                    label: 'DIRECTOR DOB',
                    appDataType: 'PARTY',
                    isMultiValue: false,
                    profileConfig: { displayMask: ['dateOfBirth'] }
                }
            );

            const { container } = render(
                <FieldValueRenderer field={dobOnlyModel} layout="row" />
            );

            expect(container.textContent).toContain('Xuejie Li');
            expect(container.textContent).toContain('1988');
            expect(container.textContent).not.toContain('+44 7123 456789');
            expect(container.textContent).not.toContain('director');
            expect(container.textContent).not.toContain('Xuejie_TEST@TEST_EMAIL.com');
        });
    });

    describe('4. Export & PDF Parity (toExportText)', () => {
        it('exports Field 201 with Xuejie Li and phone, strictly omitting unpermitted fields', () => {
            const exportText = toExportText(field201CanonicalModel);

            expect(exportText).toContain('Xuejie Li');
            expect(exportText).toContain('+44 7123 456789');
            expect(exportText).not.toContain('director');
            expect(exportText).not.toContain('1988');
            expect(exportText).not.toContain('Xuejie_TEST@TEST_EMAIL.com');
            expect(exportText).not.toContain('Test Street');
        });
    });
});
