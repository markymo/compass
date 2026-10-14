/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { FieldDetailPanel } from '../field-detail-panel';
import * as kycQuery from '@/actions/kyc-query';

vi.mock('@/actions/kyc-query', () => ({
    getFieldDetail: vi.fn(),
}));

vi.mock('@/actions/kyc-manual-update', () => ({
    updateFieldManually: vi.fn().mockResolvedValue({ success: true }),
    removeMultiValueEntry: vi.fn().mockResolvedValue({ success: true }),
    addMultiValueEntry: vi.fn().mockResolvedValue({ success: true }),
    clearSingleValueEntry: vi.fn().mockResolvedValue({ success: true }),
    addCodeListEntry: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/actions/system', () => ({
    getRegistryAuthorityNamesMap: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/actions/kanban-actions', () => ({
    getLETeamMembers: vi.fn().mockResolvedValue({ success: true, members: [] }),
}));

vi.mock('@/actions/client-le', () => ({
    getFieldUsageDetails: vi.fn().mockResolvedValue({
        totalQuestions: 1,
        totalQuestionnaires: 1,
        totalSuppliers: 1,
        relationships: [],
        questions: [{ id: 'q1', text: 'Senior Managing Official question', questionnaireId: 'qn1' }],
        questionnaires: [{ id: 'qn1', name: 'KYC Questionnaire' }],
        suppliers: [{ id: 's1', name: 'Standard Chartered' }],
    }),
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
    useSession: () => ({ data: { user: { name: 'Test User' } }, status: 'authenticated' }),
}));

vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn().mockResolvedValue({ userId: 'test-user' }),
}));

// Mock the child picker & editor components with data-testid to verify routing
vi.mock('@/components/client/fields/UnifiedPartyPicker', () => ({
    UnifiedPartyPicker: (props: any) => (
        <div
            data-testid="mock-unified-party-picker"
            data-field-no={props.fieldNo}
            data-allowed-types={JSON.stringify(props.allowedPartyTypes)}
            data-allowed-subtypes={JSON.stringify(props.allowedPartySubTypes)}
            data-population-policy={props.partyPopulationPolicy}
        >
            {props.trigger || <button onClick={props.onSuccess}>Mock Party Picker</button>}
        </div>
    ),
}));

vi.mock('@/components/client/fields/UnifiedAddressPicker', () => ({
    UnifiedAddressPicker: (props: any) => (
        <div
            data-testid="mock-unified-address-picker"
            data-field-no={props.fieldNo}
            data-population-policy={props.partyPopulationPolicy}
        >
            {props.trigger || <button onClick={props.onSuccess}>Mock Address Picker</button>}
        </div>
    ),
}));

vi.mock('@/components/client/fields/CanonicalScalarEditor', () => ({
    CanonicalScalarEditor: (props: any) => (
        <div
            data-testid="mock-canonical-scalar-editor"
            data-datatype={props.dataType}
            data-field-name={props.fieldName}
        >
            Mock Scalar Editor
        </div>
    ),
}));

vi.mock('@/components/client/fields/FieldAttachments', () => ({
    FieldAttachments: () => <div data-testid="mock-attachments" />,
}));

vi.mock('lucide-react', async (importOriginal) => {
    const mod = await importOriginal<any>();
    return {
        ...mod,
        Loader2: () => <span>Loader</span>,
        Pencil: () => <span>Pencil</span>,
        Plus: () => <span>Plus</span>,
        Check: () => <span>Check</span>,
    };
});

describe('FieldDetailPanel - R25 Editor Routing for Single-Value Fields', () => {
    beforeEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    it('routes empty single-value PARTY field (F155) to UnifiedPartyPicker, NOT CanonicalScalarEditor', async () => {
        vi.mocked(kycQuery.getFieldDetail).mockResolvedValue({
            fieldNo: 155,
            fieldName: 'Senior Managing Official',
            dataType: 'PARTY',
            isRepeating: false,
            defaultResponse: 'Not applicable',
            displayState: 'DEFAULT_RESPONSE',
            current: null,
            profileConfig: {
                allowedPartyTypes: ['INDIVIDUAL'],
                allowedPartySubTypes: ['PERSON'],
                partyPopulationPolicy: 'SYSTEM_AND_CURATED',
            },
        } as any);

        render(
            <FieldDetailPanel
                open={true}
                onOpenChange={vi.fn()}
                clientLEId="le-123"
                fieldNo={155}
                fieldName="Senior Managing Official"
            />
        );

        await waitFor(() => {
            expect(screen.getByText('Senior Managing Official')).toBeDefined();
        });

        // Must render UnifiedPartyPicker with configured types and policy
        const picker = screen.getByTestId('mock-unified-party-picker');
        expect(picker).toBeDefined();
        expect(picker.getAttribute('data-allowed-types')).toBe(JSON.stringify(['INDIVIDUAL']));
        expect(picker.getAttribute('data-allowed-subtypes')).toBe(JSON.stringify(['PERSON']));
        expect(picker.getAttribute('data-population-policy')).toBe('SYSTEM_AND_CURATED');

        // MUST NOT render CanonicalScalarEditor or its error message
        expect(screen.queryByTestId('mock-canonical-scalar-editor')).toBeNull();
        expect(screen.queryByText(/Editing is not supported for field type/)).toBeNull();
    });

    it('routes empty single-value ADDRESS field (F138) to UnifiedAddressPicker, NOT CanonicalScalarEditor', async () => {
        vi.mocked(kycQuery.getFieldDetail).mockResolvedValue({
            fieldNo: 138,
            fieldName: 'Registered Address',
            dataType: 'ADDRESS',
            isRepeating: false,
            current: null,
            profileConfig: {
                partyPopulationPolicy: 'SYSTEM_AND_CURATED',
            },
        } as any);

        render(
            <FieldDetailPanel
                open={true}
                onOpenChange={vi.fn()}
                clientLEId="le-123"
                fieldNo={138}
                fieldName="Registered Address"
            />
        );

        await waitFor(() => {
            expect(screen.getByText('Registered Address')).toBeDefined();
        });

        // Must render UnifiedAddressPicker
        const picker = screen.getByTestId('mock-unified-address-picker');
        expect(picker).toBeDefined();

        // MUST NOT render CanonicalScalarEditor
        expect(screen.queryByTestId('mock-canonical-scalar-editor')).toBeNull();
    });

    it('routes empty single-value TEXT field (F9) to CanonicalScalarEditor', async () => {
        vi.mocked(kycQuery.getFieldDetail).mockResolvedValue({
            fieldNo: 9,
            fieldName: 'Registered address country',
            dataType: 'TEXT',
            isRepeating: false,
            current: null,
        } as any);

        render(
            <FieldDetailPanel
                open={true}
                onOpenChange={vi.fn()}
                clientLEId="le-123"
                fieldNo={9}
                fieldName="Registered address country"
            />
        );

        await waitFor(() => {
            expect(screen.getByText('Registered address country')).toBeDefined();
        });

        // Click Add value button to enter edit mode
        const addBtn = screen.getByTitle('Add value');
        fireEvent.click(addBtn);

        // Must render CanonicalScalarEditor for scalar text
        const editor = screen.getByTestId('mock-canonical-scalar-editor');
        expect(editor).toBeDefined();
        expect(editor.getAttribute('data-datatype')).toBe('TEXT');

        // Click Cancel to exit edit mode without mutations
        const cancelBtn = screen.getByText('Cancel');
        fireEvent.click(cancelBtn);

        expect(screen.queryByTestId('mock-canonical-scalar-editor')).toBeNull();
    });

    it('suppresses curation triggers when partyPopulationPolicy is SYSTEM_ONLY', async () => {
        vi.mocked(kycQuery.getFieldDetail).mockResolvedValue({
            fieldNo: 156,
            fieldName: 'Authoritative Only Party',
            dataType: 'PARTY',
            isRepeating: false,
            current: null,
            profileConfig: {
                partyPopulationPolicy: 'SYSTEM_ONLY',
            },
        } as any);

        render(
            <FieldDetailPanel
                open={true}
                onOpenChange={vi.fn()}
                clientLEId="le-123"
                fieldNo={156}
                fieldName="Authoritative Only Party"
            />
        );

        await waitFor(() => {
            expect(screen.getByText('Authoritative Only Party')).toBeDefined();
        });

        // Curation triggers must NOT be rendered
        expect(screen.queryByTitle('Add value')).toBeNull();
        expect(screen.queryByTestId('mock-unified-party-picker')).toBeNull();
        expect(screen.getByText('Field is locked to authoritative sources. Manual curation is disabled.')).toBeDefined();
    });

    it('suppresses curation triggers when address field is SYSTEM_ONLY', async () => {
        vi.mocked(kycQuery.getFieldDetail).mockResolvedValue({
            fieldNo: 139,
            fieldName: 'Authoritative Only Address',
            dataType: 'ADDRESS',
            isRepeating: false,
            current: null,
            profileConfig: {
                partyPopulationPolicy: 'SYSTEM_ONLY',
            },
        } as any);

        render(
            <FieldDetailPanel
                open={true}
                onOpenChange={vi.fn()}
                clientLEId="le-123"
                fieldNo={139}
                fieldName="Authoritative Only Address"
            />
        );

        await waitFor(() => {
            expect(screen.getByText('Authoritative Only Address')).toBeDefined();
        });

        // Curation triggers must NOT be rendered
        expect(screen.queryByTitle('Add value')).toBeNull();
        expect(screen.queryByTestId('mock-unified-address-picker')).toBeNull();
        expect(screen.getByText('Field is locked to authoritative sources. Manual curation is disabled.')).toBeDefined();
    });
});
