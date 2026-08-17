import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { PersonOrContactValueViewer } from '../PersonOrContactValueViewer';
import { resolveFieldForDisplay, resolveFieldCollectionForDisplay } from '@/lib/master-data/field-interpreter';
import { getPartyDisplayProjection, getPartySummary } from '@/lib/master-data/party-value';
import { renderToString } from 'react-dom/server';

describe('Canonical Party Rendering Parity', () => {

    const individualPartyPayload = {
        contactType: 'PERSON',
        partyType: 'INDIVIDUAL',
        title: 'Mr',
        forenames: 'David Charles',
        surname: 'Murray',
        nationality: ['British'],
        dateOfBirth: { month: 5, year: 1965 },
        roles: [{ roleType: 'DIRECTOR', roleTitle: 'Director', appointedOn: '2015-06-01' }]
    };

    const organisationPartyPayload = {
        contactType: 'CONTACT',
        partyType: 'ORGANISATION',
        organisationName: 'Egg Power Assetco Limited',
        companyName: 'Egg Power Assetco Limited',
        sourceIdentifiers: [{ scheme: 'COMPANIES_HOUSE_COMPANY_NUMBER', value: '12345678' }],
        roles: [{ roleType: 'PSC', roleTitle: 'Person with Significant Control', natureOfControl: ['ownership-of-shares-75-to-100-percent'] }]
    };

    const trustOrgPartyPayload = {
        contactType: 'CONTACT',
        partyType: 'ORGANISATION',
        legalName: 'Womble Bond Dickinson (Trust Corporation) Limited',
        roles: [{ roleType: 'DIRECTOR', roleTitle: 'Corporate Director' }]
    };

    const partyRefPayload = {
        ccPartyId: 'party-cc-001',
        _resolvedData: {
            ccParty: {
                id: 'party-cc-001',
                data: {
                    contactType: 'PERSON',
                    partyType: 'INDIVIDUAL',
                    title: 'Mr',
                    forenames: 'Harold Edward',
                    surname: 'Malyon'
                }
            }
        }
    };

    describe('1. Individual & Organisation Canonical Label Projection', () => {
        it('projects source-derived individual Party name correctly', () => {
            const proj = getPartyDisplayProjection(individualPartyPayload);
            expect(proj.primaryText).toContain('David Charles Murray');
        });

        it('projects source-derived organisation Party name correctly', () => {
            const proj = getPartyDisplayProjection(organisationPartyPayload);
            expect(proj.primaryText).toBe('Egg Power Assetco Limited');
        });

        it('projects organisation Party with legalName correctly', () => {
            const proj = getPartyDisplayProjection(trustOrgPartyPayload);
            expect(proj.primaryText).toBe('Womble Bond Dickinson (Trust Corporation) Limited');
        });

        it('projects promoted PartyRef value correctly', () => {
            const resolvedParty = partyRefPayload._resolvedData.ccParty.data;
            const proj = getPartyDisplayProjection(resolvedParty);
            expect(proj.primaryText).toContain('Harold Edward Malyon');
        });
    });

    describe('2. Master Record Main List vs RHS Drawer Parity', () => {
        it('renders identical label for Individual Party in main list path and RHS drawer path', () => {
            const metadata = {
                fieldNo: 63,
                label: 'Company Directors',
                appDataType: 'PARTY',
                isMultiValue: true
            };

            // Main List resolution path (resolveFieldCollectionForDisplay / resolveFieldForDisplay)
            const canonicalModel = resolveFieldForDisplay([individualPartyPayload], null, metadata);
            expect(canonicalModel.value.kind).toBe('collection');

            const item = (canonicalModel.value as any).items[0];
            const mainListPartyLabel = item.value.partyLabel;

            // Render in main list format
            const mainListHtml = renderToString(
                <PersonOrContactValueViewer
                    value={item.value.kind === 'partyRef' ? item.value.resolved : item.value.data}
                    partyLabel={mainListPartyLabel}
                    layout="row"
                />
            );

            // Drawer resolution path (using row.canonicalDisplayModel attached by getFieldDetail)
            const rowCanonicalModel = resolveFieldForDisplay(individualPartyPayload, null, { ...metadata, isMultiValue: false });
            const drawerPartyLabel = rowCanonicalModel.value.partyLabel;

            const drawerHtml = renderToString(
                <PersonOrContactValueViewer
                    value={rowCanonicalModel.value.kind === 'partyRef' ? rowCanonicalModel.value.resolved : rowCanonicalModel.value.data}
                    partyLabel={drawerPartyLabel}
                    layout="row"
                />
            );

            expect(mainListPartyLabel).toBe(drawerPartyLabel);
            expect(mainListHtml).toContain('David Charles Murray');
            expect(drawerHtml).toContain('David Charles Murray');
        });

        it('renders identical label for Organisation Party (PSC/UBO) in main list path and RHS drawer path', () => {
            const metadata = {
                fieldNo: 62,
                label: 'Persons with Significant Control',
                appDataType: 'PARTY',
                isMultiValue: true
            };

            const canonicalModel = resolveFieldForDisplay([organisationPartyPayload], null, metadata);
            const item = (canonicalModel.value as any).items[0];
            const mainListPartyLabel = item.value.partyLabel;

            const mainListHtml = renderToString(
                <PersonOrContactValueViewer
                    value={item.value.data}
                    partyLabel={mainListPartyLabel}
                    layout="row"
                />
            );

            const rowCanonicalModel = resolveFieldForDisplay(organisationPartyPayload, null, { ...metadata, isMultiValue: false });
            const drawerPartyLabel = rowCanonicalModel.value.partyLabel;

            const drawerHtml = renderToString(
                <PersonOrContactValueViewer
                    value={rowCanonicalModel.value.data}
                    partyLabel={drawerPartyLabel}
                    layout="row"
                />
            );

            expect(mainListPartyLabel).toBe('Egg Power Assetco Limited');
            expect(drawerPartyLabel).toBe('Egg Power Assetco Limited');
            expect(mainListHtml).toContain('Egg Power Assetco Limited');
            expect(drawerHtml).toContain('Egg Power Assetco Limited');
        });
    });

    describe('3. Save For Reuse & Role Metadata Integrity', () => {
        it('preserves Save for reuse button and role metadata when rendering in drawer layout', () => {
            const onSave = vi.fn();

            const html = renderToString(
                <PersonOrContactValueViewer
                    value={individualPartyPayload}
                    layout="row"
                    claimId="claim-123"
                    isPromotedToCCC={false}
                    onSaveForReuse={onSave}
                />
            );

            expect(html).toContain('Save for reuse');
            expect(html).toContain('David Charles Murray');
            expect(html).toContain('Director');
        });

        it('displays "Saved for reuse" badge when already promoted', () => {
            const html = renderToString(
                <PersonOrContactValueViewer
                    value={individualPartyPayload}
                    layout="row"
                    claimId="claim-123"
                    isPromotedToCCC={true}
                />
            );

            expect(html).toContain('Saved for reuse');
        });
    });

    describe('4. Fallback Behaviour when canonicalDisplayModel is Absent', () => {
        it('falls back to canonical normalization in PersonOrContactValueViewer when partyLabel prop is omitted', () => {
            const html = renderToString(
                <PersonOrContactValueViewer
                    value={organisationPartyPayload}
                    layout="row"
                />
            );

            expect(html).toContain('Egg Power Assetco Limited');
        });
    });
});
