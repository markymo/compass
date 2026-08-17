import { describe, it, expect } from 'vitest';
import { applyTransform } from '../transforms';
import { formatNatureOfControl } from '@/components/client/fields/PersonOrContactValueViewer';

describe('Field 64 — Persons with Significant Control (PSC) Transformations & Filtering', () => {

    const transformConfig = {
        fullNamePath: 'name',
        roleTitlePath: 'kind',
        appointedOnPath: 'notified_on',
        resignedOnPath: 'ceased_on',
        natureOfControlPath: 'natures_of_control',
        nationalityPath: 'nationality',
        countryOfResidencePath: 'country_of_residence',
        dobYearPath: 'date_of_birth.year',
        dobMonthPath: 'date_of_birth.month',
        sourceIdentifiers: [
            {
                scheme: 'COMPANIES_HOUSE_PERSON_NUMBER',
                valuePath: 'person_number'
            }
        ]
    };

    const filterConfig = {
        includeRoles: [
            { isActiveRole: true }
        ]
    };

    // Helper simulating RegistryMappingEngine's filter layer logic
    function applyEngineFilter(transformedResult: { value: any[]; rowKeys?: string[] }) {
        if (!Array.isArray(transformedResult.value)) return transformedResult;
        
        const filteredValue: any[] = [];
        const filteredRowKeys: string[] = [];

        for (let i = 0; i < transformedResult.value.length; i++) {
            const item = transformedResult.value[i];
            const rowKey = transformedResult.rowKeys?.[i];
            const roles = item.roles || [];

            let matched = false;
            for (const filterRule of filterConfig.includeRoles) {
                const matchRule = roles.some((r: any) => {
                    let rActiveMatch = true;
                    if (filterRule.isActiveRole !== undefined) {
                        rActiveMatch = r.isActiveRole === filterRule.isActiveRole;
                    }
                    return rActiveMatch;
                });
                if (matchRule) {
                    matched = true;
                    break;
                }
            }

            if (matched) {
                filteredValue.push(item);
                if (rowKey !== undefined) filteredRowKeys.push(rowKey);
            }
        }

        return { value: filteredValue, rowKeys: filteredRowKeys };
    }

    it('1. Active PSC -> Included with isActiveRole = true', () => {
        const payload = [
            {
                name: 'MR JOHN SMITH',
                kind: 'individual-person-with-significant-control',
                notified_on: '2016-04-06',
                nationality: 'British',
                country_of_residence: 'England',
                natures_of_control: ['ownership-of-shares-75-to-100-percent']
            }
        ];

        const res = applyTransform(payload, 'TO_PARTY_VALUE_LIST', transformConfig);
        expect(res.value).toHaveLength(1);
        expect(res.value[0].roles[0].isActiveRole).toBe(true);
        expect(res.value[0].roles[0].appointedOn).toBe('2016-04-06');
        expect(res.value[0].roles[0].resignedOn).toBeNull();

        const filtered = applyEngineFilter(res);
        expect(filtered.value).toHaveLength(1);
        expect(filtered.value[0].surname).toBe('Smith');
    });

    it('2. Ceased PSC with ceased_on -> Excluded from active Field 64 canonical candidates', () => {
        const payload = [
            {
                name: 'MR DAVID JONES',
                kind: 'individual-person-with-significant-control',
                notified_on: '2016-04-06',
                ceased_on: '2020-05-15',
                ceased: true,
                natures_of_control: ['voting-rights-25-to-50-percent']
            }
        ];

        const res = applyTransform(payload, 'TO_PARTY_VALUE_LIST', transformConfig);
        expect(res.value).toHaveLength(1);
        expect(res.value[0].roles[0].isActiveRole).toBe(false);
        expect(res.value[0].roles[0].resignedOn).toBe('2020-05-15');

        const filtered = applyEngineFilter(res);
        expect(filtered.value).toHaveLength(0); // Excluded from Field 64 candidate list
    });

    it('3. Multiple active PSCs -> All included in Field 64', () => {
        const payload = [
            {
                name: 'ALPHA CORP LTD',
                kind: 'corporate-entity-person-with-significant-control',
                notified_on: '2018-01-01',
                natures_of_control: ['ownership-of-shares-25-to-50-percent']
            },
            {
                name: 'BETA CORP LTD',
                kind: 'corporate-entity-person-with-significant-control',
                notified_on: '2019-02-01',
                natures_of_control: ['voting-rights-25-to-50-percent']
            }
        ];

        const res = applyTransform(payload, 'TO_PARTY_VALUE_LIST', transformConfig);
        expect(res.value).toHaveLength(2);
        
        const filtered = applyEngineFilter(res);
        expect(filtered.value).toHaveLength(2);
        expect(filtered.value[0].organisationName).toBe('ALPHA CORP LTD');
        expect(filtered.value[1].organisationName).toBe('BETA CORP LTD');
    });

    it('4. natures_of_control -> Propagated correctly to roles[0].natureOfControl and formatted for display', () => {
        const payload = [
            {
                name: 'GAMMA HOLDINGS LIMITED',
                kind: 'corporate-entity-person-with-significant-control',
                notified_on: '2020-01-01',
                natures_of_control: [
                    'ownership-of-shares-75-to-100-percent',
                    'voting-rights-75-to-100-percent',
                    'right-to-appoint-and-remove-directors'
                ]
            }
        ];

        const res = applyTransform(payload, 'TO_PARTY_VALUE_LIST', transformConfig);
        const party = res.value[0];
        const noc = party.roles[0].natureOfControl;

        expect(noc).toEqual([
            'ownership-of-shares-75-to-100-percent',
            'voting-rights-75-to-100-percent',
            'right-to-appoint-and-remove-directors'
        ]);

        expect(formatNatureOfControl(noc[0])).toBe('Ownership of shares — 75% or more');
        expect(formatNatureOfControl(noc[1])).toBe('Ownership of voting rights — 75% or more');
        expect(formatNatureOfControl(noc[2])).toBe('Right to appoint or remove directors');
    });

    it('5. Chirmorie-shaped fixture (company 09171934): 1 active corporate PSC + several ceased PSCs -> Canonical result contains ONLY active PSC', () => {
        const chirmoriePayload = [
            {
                name: 'Egg Power Assetco Limited',
                kind: 'corporate-entity-person-with-significant-control',
                notified_on: '2021-06-30',
                natures_of_control: [
                    'ownership-of-shares-75-to-100-percent',
                    'voting-rights-75-to-100-percent',
                    'right-to-appoint-and-remove-directors'
                ],
                address: {
                    address_line_1: '55 Harborne Road',
                    locality: 'Birmingham',
                    postal_code: 'B15 3DH'
                },
                identification: {
                    registration_number: '12345678',
                    country_registered: 'United Kingdom'
                }
            },
            {
                name: 'HISTORICAL INVESTMENTS LIMITED',
                kind: 'corporate-entity-person-with-significant-control',
                notified_on: '2014-08-15',
                ceased_on: '2021-06-29',
                ceased: true,
                natures_of_control: ['ownership-of-shares-75-to-100-percent']
            },
            {
                name: 'FORMER FOUNDER INDIVIDUAL',
                kind: 'individual-person-with-significant-control',
                notified_on: '2014-08-15',
                ceased_on: '2018-03-31',
                ceased: true,
                natures_of_control: ['voting-rights-50-to-75-percent']
            }
        ];

        const res = applyTransform(chirmoriePayload, 'TO_PARTY_VALUE_LIST', transformConfig);
        expect(res.value).toHaveLength(3);

        const filtered = applyEngineFilter(res);
        expect(filtered.value).toHaveLength(1);

        const activePSC = filtered.value[0];
        expect(activePSC.contactType).toBe('CONTACT');
        expect(activePSC.partyType).toBe('ORGANISATION');
        expect(activePSC.organisationName).toBe('Egg Power Assetco Limited');
        expect(activePSC.roles[0].isActiveRole).toBe(true);
        expect(activePSC.roles[0].natureOfControl).toEqual([
            'ownership-of-shares-75-to-100-percent',
            'voting-rights-75-to-100-percent',
            'right-to-appoint-and-remove-directors'
        ]);

        const formattedLabels = activePSC.roles[0].natureOfControl.map(formatNatureOfControl);
        expect(formattedLabels).toEqual([
            'Ownership of shares — 75% or more',
            'Ownership of voting rights — 75% or more',
            'Right to appoint or remove directors'
        ]);
    });
});
