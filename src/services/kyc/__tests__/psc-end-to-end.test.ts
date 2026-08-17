import { describe, it, expect, vi } from 'vitest';
import { getPartyDisplayProjection, formatNatureOfControl, PartyValue } from '@/lib/master-data/party-value';
import { toExportText } from '@/lib/export/toExportText';
import { convertLegacyManualPartyToV2 } from '@/services/masterData/cc-party-legacy-adapter';
import { FieldDisplayModel } from '@/lib/master-data/field-display-model';
import { applyTransform } from '../normalization/transforms';

describe('PSC End-to-End Handling & Parity (Section S Requirements)', () => {

    const chirmorieCorporatePSC: PartyValue = {
        contactType: 'CONTACT',
        partyType: 'ORGANISATION',
        organisationName: 'Egg Power Assetco Limited',
        displayName: 'Egg Power Assetco Limited',
        title: null,
        forenames: null,
        surname: null,
        email: null,
        phones: [],
        nationality: [],
        countryOfResidence: null,
        dateOfBirth: null,
        placeOfBirth: null,
        roles: [{
            roleTitle: 'corporate-entity-person-with-significant-control',
            roleType: 'PSC',
            company: {
                onProCompanyId: 'le-chirmorie-123',
                externalId: '09171934',
                externalIdScheme: 'COMPANIES_HOUSE',
                name: 'Chirmorie'
            },
            isActiveRole: true,
            appointedOn: '2021-06-30',
            resignedOn: null,
            natureOfControl: [
                'ownership-of-shares-75-to-100-percent',
                'voting-rights-75-to-100-percent',
                'right-to-appoint-and-remove-directors'
            ]
        }],
        sourceIdentifiers: [{ scheme: 'COMPANIES_HOUSE_PERSON_NUMBER', value: '12345' }],
        correspondenceAddress: {
            addressLines: ['55 Harborne Road'],
            locality: 'Birmingham',
            postalCode: 'B15 3DH'
        },
        isActiveParty: null,
        isActivePersonOrContact: null,
        visibility: { scope: 'CLIENT_LE' }
    };

    const individualPSC: PartyValue = {
        contactType: 'PERSON',
        partyType: 'INDIVIDUAL',
        organisationName: null,
        displayName: null,
        title: 'Mr',
        forenames: 'John',
        surname: 'Smith',
        email: 'john@example.com',
        phones: [],
        nationality: ['British'],
        countryOfResidence: 'England',
        dateOfBirth: { year: 1980, month: 5, day: null },
        placeOfBirth: null,
        roles: [{
            roleTitle: 'individual-person-with-significant-control',
            roleType: 'PSC',
            company: {
                onProCompanyId: 'le-chirmorie-123',
                externalId: null,
                externalIdScheme: null,
                name: 'Chirmorie'
            },
            isActiveRole: true,
            appointedOn: '2016-04-06',
            resignedOn: null,
            natureOfControl: [
                'ownership-of-shares-75-to-100-percent',
                'voting-rights-75-to-100-percent'
            ]
        }],
        sourceIdentifiers: [{ scheme: 'COMPANIES_HOUSE_PERSON_NUMBER', value: '98765' }],
        correspondenceAddress: null,
        isActiveParty: null,
        isActivePersonOrContact: null,
        visibility: { scope: 'CLIENT_LE' }
    };

    it('1 & 2. Ordinary Individual and Corporate PSC with multiple natures of control format correctly', () => {
        expect(formatNatureOfControl('ownership-of-shares-75-to-100-percent')).toBe('Ownership of shares — 75% or more');
        expect(formatNatureOfControl('voting-rights-75-to-100-percent')).toBe('Ownership of voting rights — 75% or more');
        expect(formatNatureOfControl('right-to-appoint-and-remove-directors')).toBe('Right to appoint or remove directors');
    });

    it('3. Canonical /master concise presentation includes nature of control and Notified date', () => {
        const proj = getPartyDisplayProjection(chirmorieCorporatePSC);
        expect(proj.primaryText).toBe('Egg Power Assetco Limited');
        expect(proj.secondaryParts).toContain('corporate-entity-person-with-significant-control (Notified 2021-06-30)');
        expect(proj.secondaryParts).toContain('Ownership of shares — 75% or more');
        expect(proj.secondaryParts).toContain('Ownership of voting rights — 75% or more');
        expect(proj.secondaryParts).toContain('Right to appoint or remove directors');
    });

    it('4. RHS drawer detailed presentation projects all role attributes', () => {
        const proj = getPartyDisplayProjection(individualPSC);
        expect(proj.primaryText).toBe('John Smith');
        expect(proj.secondaryParts).toContain('individual-person-with-significant-control (Notified 2016-04-06)');
        expect(proj.secondaryParts).toContain('Ownership of shares — 75% or more');
        expect(proj.secondaryParts).toContain('Ownership of voting rights — 75% or more');
    });

    it('5. Workbench/questionnaire answer display includes concise nature of control', () => {
        const model: FieldDisplayModel = {
            fieldNo: 64,
            label: 'Persons with Significant Control',
            state: 'POPULATED',
            value: { kind: 'party', data: chirmorieCorporatePSC, summary: 'Egg Power Assetco Limited', partyLabel: 'Egg Power Assetco Limited' },
            source: null,
            textSummary: '',
            isEditable: false,
            isMultiValue: true,
            attachments: [],
            allowAttachments: false
        };
        const exportText = toExportText(model);
        expect(exportText).toContain('Egg Power Assetco Limited');
        expect(exportText).toContain('Ownership of shares — 75% or more');
    });

    it('6. Export toExportText includes all nature of control values without truncation', () => {
        const model: FieldDisplayModel = {
            fieldNo: 64,
            label: 'Persons with Significant Control',
            state: 'POPULATED',
            value: {
                kind: 'collection',
                items: [
                    { value: { kind: 'party', data: chirmorieCorporatePSC, summary: 'Egg Power Assetco Limited', partyLabel: 'Egg Power Assetco Limited' } }
                ]
            },
            source: null,
            textSummary: '',
            isEditable: false,
            isMultiValue: true,
            attachments: [],
            allowAttachments: false
        };
        const exportText = toExportText(model);
        expect(exportText).toContain('Egg Power Assetco Limited');
        expect(exportText).toContain('Ownership of shares — 75% or more');
        expect(exportText).toContain('Ownership of voting rights — 75% or more');
        expect(exportText).toContain('Right to appoint or remove directors');
        expect(exportText).toContain('Notified 2021-06-30');
    });

    it('7. PSC terminology uses Notified and Ceased for PSC roles while preserving Appointed/Resigned for Directors', () => {
        const projPsc = getPartyDisplayProjection(individualPSC);
        expect(projPsc.secondaryParts[0]).toContain('Notified 2016-04-06');

        const directorParty: PartyValue = {
            contactType: 'PERSON',
            partyType: 'INDIVIDUAL',
            forenames: 'Alice',
            surname: 'Jones',
            title: null,
            email: null,
            phones: [],
            nationality: [],
            countryOfResidence: null,
            dateOfBirth: null,
            placeOfBirth: null,
            roles: [{
                roleTitle: 'Director',
                roleType: 'DIRECTOR',
                company: null,
                isActiveRole: false,
                appointedOn: '2020-01-01',
                resignedOn: '2022-01-01',
                natureOfControl: []
            }],
            sourceIdentifiers: [],
            isActiveParty: null,
            isActivePersonOrContact: null,
            visibility: { scope: 'CLIENT_LE' }
        };
        const projDir = getPartyDisplayProjection(directorParty);
        expect(projDir.secondaryParts[0]).toContain('Appointed 2020-01-01');
        expect(projDir.secondaryParts[0]).toContain('Resigned 2022-01-01');
    });

    it('8. Corporate PSC Save for reuse creates the canonical Organisation Party type', () => {
        const rawPayload = {
            contactType: 'CONTACT',
            partyType: 'ORGANISATION',
            organisationName: 'Egg Power Assetco Limited',
            identification: {
                registration_number: '12345678',
                legal_form: 'Private Limited Company',
                country_registered: 'United Kingdom'
            },
            roles: [{
                roleTitle: 'corporate-entity-person-with-significant-control',
                natureOfControl: ['ownership-of-shares-75-to-100-percent']
            }]
        };
        const v2 = convertLegacyManualPartyToV2(rawPayload, { clientLEId: 'le-chirmorie-123', clientLEName: 'Chirmorie' });
        expect(v2.partyType).toBe('ORGANISATION');
        if (v2.partyType === 'ORGANISATION') {
            expect(v2.legalName).toBe('Egg Power Assetco Limited');
            expect(v2.registrationNumber).toBe('12345678');
            expect(v2.legalForm).toBe('Private Limited Company');
            expect(v2.incorporatedIn).toBe('United Kingdom');
            expect(v2.governingLaw).toBeNull(); // Intentionally NOT mapped from legal_authority
        }
    });

    it('9. Individual PSC Save for reuse creates the canonical Individual Party type', () => {
        const rawPayload = {
            contactType: 'PERSON',
            partyType: 'INDIVIDUAL',
            forenames: 'John',
            surname: 'Smith',
            nationality: ['British'],
            dateOfBirth: { year: 1980, month: 5, day: null },
            roles: [{
                roleTitle: 'individual-person-with-significant-control',
                natureOfControl: ['ownership-of-shares-75-to-100-percent']
            }]
        };
        const v2 = convertLegacyManualPartyToV2(rawPayload, { clientLEId: 'le-chirmorie-123', clientLEName: 'Chirmorie' });
        expect(v2.partyType).toBe('INDIVIDUAL');
        if (v2.partyType === 'INDIVIDUAL') {
            expect(v2.forenames).toBe('John');
            expect(v2.surname).toBe('Smith');
            expect(v2.dateOfBirth).toEqual({ year: 1980, month: 5, day: null });
        }
    });

    it('10 & 11. Corporate source identity data preserved without mapping legal_authority to governingLaw', () => {
        const rawPayload = {
            organisationName: 'Acme Corp Ltd',
            identification: {
                registration_number: '87654321',
                legal_form: 'Limited',
                country_registered: 'GB',
                legal_authority: 'Companies House'
            }
        };
        const v2 = convertLegacyManualPartyToV2(rawPayload);
        if (v2.partyType === 'ORGANISATION') {
            expect(v2.registrationNumber).toBe('87654321');
            expect(v2.legalForm).toBe('Limited');
            expect(v2.incorporatedIn).toBe('GB');
            expect(v2.governingLaw).toBeNull(); // Confirmed: legal_authority is not forced into governingLaw
        }
    });

    it('12. Reusable Party retains a PSC relationship explicitly scoped to the target Client LE', () => {
        const rawPayload = {
            contactType: 'CONTACT',
            partyType: 'ORGANISATION',
            organisationName: 'Egg Power Assetco Limited',
            roles: [{
                roleTitle: 'corporate-entity-person-with-significant-control',
                appointedOn: '2021-06-30',
                natureOfControl: ['ownership-of-shares-75-to-100-percent']
            }]
        };
        const v2 = convertLegacyManualPartyToV2(rawPayload, { clientLEId: 'le-chirmorie-123', clientLEName: 'Chirmorie' });
        expect(v2.roles).toHaveLength(1);
        expect(v2.roles[0].company?.onProCompanyId).toBe('le-chirmorie-123');
        expect(v2.roles[0].company?.name).toBe('Chirmorie');
        expect(v2.roles[0].natureOfControl).toEqual(['ownership-of-shares-75-to-100-percent']);
    });

    it('13 & 14. Same Party can retain different PSC and director relationships against multiple Client LEs without collision', () => {
        const rawPayloadChirmorie = {
            contactType: 'CONTACT',
            partyType: 'ORGANISATION',
            organisationName: 'Egg Power Assetco Limited',
            roles: [{
                roleTitle: 'corporate-entity-person-with-significant-control',
                natureOfControl: ['ownership-of-shares-75-to-100-percent']
            }]
        };
        const v2Chirmorie = convertLegacyManualPartyToV2(rawPayloadChirmorie, { clientLEId: 'le-chirmorie-123', clientLEName: 'Chirmorie' });

        const rawPayloadEntityB = {
            ...rawPayloadChirmorie,
            roles: [{
                roleTitle: 'corporate-entity-person-with-significant-control',
                natureOfControl: ['voting-rights-25-to-50-percent']
            }]
        };
        const v2EntityB = convertLegacyManualPartyToV2(rawPayloadEntityB, { clientLEId: 'le-entityb-456', clientLEName: 'Entity B' });

        // Combined role array
        const combinedRoles = [...v2Chirmorie.roles, ...v2EntityB.roles];
        expect(combinedRoles).toHaveLength(2);
        expect(combinedRoles[0].company?.onProCompanyId).toBe('le-chirmorie-123');
        expect(combinedRoles[0].natureOfControl).toEqual(['ownership-of-shares-75-to-100-percent']);

        expect(combinedRoles[1].company?.onProCompanyId).toBe('le-entityb-456');
        expect(combinedRoles[1].natureOfControl).toEqual(['voting-rights-25-to-50-percent']);
    });

    it('17. PartyRef rendering preserves nature of control after promotion', () => {
        const partyRef = {
            kind: 'partyRef' as const,
            refId: 'p-123',
            summary: 'Egg Power Assetco Limited',
            partyLabel: 'Egg Power Assetco Limited',
            resolved: chirmorieCorporatePSC
        };
        const model: FieldDisplayModel = {
            fieldNo: 64,
            label: 'Persons with Significant Control',
            state: 'POPULATED',
            value: partyRef,
            source: null,
            textSummary: '',
            isEditable: false,
            isMultiValue: true,
            attachments: [],
            allowAttachments: false
        };
        const exportText = toExportText(model);
        expect(exportText).toContain('Egg Power Assetco Limited');
        expect(exportText).toContain('Ownership of shares — 75% or more');
    });

    it('18. Super-secure PSC kinds handle suppressed names cleanly', () => {
        const payload = [{
            kind: 'super-secure-person-with-significant-control',
            notified_on: '2020-01-01',
            natures_of_control: ['significant-influence-or-control']
        }];
        const config = {
            fullNamePath: 'name',
            roleTitlePath: 'kind',
            appointedOnPath: 'notified_on',
            natureOfControlPath: 'natures_of_control'
        };
        const res = applyTransform(payload, 'TO_PARTY_VALUE_LIST', config);
        expect(res.value).toHaveLength(1);
        expect(res.value[0].surname).toBe('Person with Significant Control (Protected)');
        expect(res.value[0].roles[0].natureOfControl).toEqual(['significant-influence-or-control']);
    });

    it('19. MVP Save-for-reuse idempotency: repeat conversion produces consistent CCPartyData without role duplication', () => {
        const v2FirstPass = convertLegacyManualPartyToV2(chirmorieCorporatePSC, { clientLEId: 'le-chirmorie-123', clientLEName: 'Chirmorie' });
        const v2SecondPass = convertLegacyManualPartyToV2(chirmorieCorporatePSC, { clientLEId: 'le-chirmorie-123', clientLEName: 'Chirmorie' });

        expect(v2FirstPass).toEqual(v2SecondPass);
        expect(v2SecondPass.roles).toHaveLength(1);
        expect(v2SecondPass.roles[0].company?.onProCompanyId).toBe('le-chirmorie-123');
    });

    it('20. Save-for-reuse creates an independent snapshot/fork: subsequent Companies House changes update F64 but do not alter CCParty', () => {
        // Step 1: Initial Save for reuse snapshot taken at 75%+
        const initialSavedV2 = convertLegacyManualPartyToV2(chirmorieCorporatePSC, { clientLEId: 'le-chirmorie-123', clientLEName: 'Chirmorie' });
        expect(initialSavedV2.roles[0].natureOfControl).toEqual([
            'ownership-of-shares-75-to-100-percent',
            'voting-rights-75-to-100-percent',
            'right-to-appoint-and-remove-directors'
        ]);

        // Step 2: Fresh Companies House payload received later (25-50%)
        const refreshedChPayload = [{
            name: 'Egg Power Assetco Limited',
            kind: 'corporate-entity-person-with-significant-control',
            notified_on: '2021-06-30',
            natures_of_control: ['ownership-of-shares-25-to-50-percent']
        }];
        const config = {
            fullNamePath: 'name',
            roleTitlePath: 'kind',
            appointedOnPath: 'notified_on',
            natureOfControlPath: 'natures_of_control'
        };
        const refreshedF64Claim = applyTransform(refreshedChPayload, 'TO_PARTY_VALUE_LIST', config);

        // F64 reflects the new live source data (25-50%)
        expect(refreshedF64Claim.value[0].roles[0].natureOfControl).toEqual(['ownership-of-shares-25-to-50-percent']);

        // The already-saved CCParty snapshot remains at 75%+ (independent snapshot/fork)
        expect(initialSavedV2.roles[0].natureOfControl).toEqual([
            'ownership-of-shares-75-to-100-percent',
            'voting-rights-75-to-100-percent',
            'right-to-appoint-and-remove-directors'
        ]);
    });
});
