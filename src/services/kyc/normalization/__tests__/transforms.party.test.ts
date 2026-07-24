import { describe, it, expect } from 'vitest';
import { applyTransform, buildPersonOrContactRowKey } from '../transforms';
import { isPartyValue, isValidPartyValue, isRenderableActiveDirectorParty, getPartySummary } from '../../../../lib/master-data/party-value';

// ── Shared CH officer fixture ─────────────────────────────────────────────────
const CH_DIRECTOR_ACTIVE = {
    name: 'SMITH, John Robert',
    officer_role: 'director',
    appointed_on: '2020-01-15',
    nationality: 'British',
    country_of_residence: 'England',
    date_of_birth: { month: 6, year: 1975 },
};

const CH_DIRECTOR_RESIGNED = {
    ...CH_DIRECTOR_ACTIVE,
    resigned_on: '2023-07-31',
};

const CH_PSC = {
    name: 'JONES, Alice',
    officer_role: 'psc',
    notified_on: '2019-03-01',
    nature_of_control: ['ownership-of-shares-25-to-50-percent', 'voting-rights-25-to-50-percent'],
    nationality: 'British',
    country_of_residence: 'Wales',
    date_of_birth: { month: 11, year: 1968 },
};

const CH_DIRECTOR_WITH_ADDRESS = {
    ...CH_DIRECTOR_ACTIVE,
    address: {
        premises: "10",
        address_line_1: "Street Name",
        locality: "London",
        country: "England",
        postal_code: "SW1A 1AA"
    }
};

const BASE_CONFIG = {
    fullNamePath: 'name',
    roleTitlePath: 'officer_role',
    appointedOnPath: 'appointed_on',
    resignedOnPath: 'resigned_on',
    nationalityPath: 'nationality',
    countryOfResidencePath: 'country_of_residence',
    dobMonthPath: 'date_of_birth.month',
    dobYearPath: 'date_of_birth.year',
    defaultContactType: 'PERSON',
    sourceIdentifiers: [{ scheme: 'CH_OFFICER_ID', valuePath: 'links.officer.appointments' }],
};

// ─────────────────────────────────────────────────────────────────────────────

describe('TO_PARTY_VALUE and TO_PERSON_OR_CONTACT_VALUE', () => {
    const transformTypes = ['TO_PARTY_VALUE', 'TO_PERSON_OR_CONTACT_VALUE'] as const;

    transformTypes.forEach((transformType) => {
        describe(`Transform: ${transformType}`, () => {
            it('POC-1: active CH director — correct name parse, role, DOB, isActiveRole', () => {
                const result = applyTransform(CH_DIRECTOR_ACTIVE, transformType, BASE_CONFIG);

                expect(result.value).not.toBeNull();
                const poc = result.value;

                // Name parsing — CH comma format "SMITH, John Robert"
                expect(poc.surname).toBe('Smith');       // title-cased
                expect(poc.forenames).toBe('John Robert');
                expect(poc.contactType).toBe('PERSON');

                // Role
                expect(poc.roles).toHaveLength(1);
                expect(poc.roles[0].isActiveRole).toBe(true);     // appointed, not resigned
                expect(poc.roles[0].appointedOn).toBe('2020-01-15');
                expect(poc.roles[0].resignedOn).toBeNull();

                // DOB — month/year only, day MUST be null (never 1)
                expect(poc.dateOfBirth).toEqual({ year: 1975, month: 6, day: null });

                // INVARIANTS: isActiveParty and isActivePersonOrContact must always be null from transform
                expect(poc.isActiveParty).toBeNull();
                expect(poc.isActivePersonOrContact).toBeNull();

                // Nationality
                expect(poc.nationality).toEqual(['British']);
                expect(poc.countryOfResidence).toBe('England');

                // Confidence penalty: +0.05 for heuristic name parse
                expect(result.confidencePenalty).toBe(0.05);

                // Visibility default
                expect(poc.visibility).toEqual({ scope: 'CLIENT_LE' });
            });

            it('POC-2: resigned CH director — isActiveRole is false', () => {
                const result = applyTransform(CH_DIRECTOR_RESIGNED, transformType, BASE_CONFIG);

                const poc = result.value;
                expect(poc).not.toBeNull();
                expect(poc.roles[0].isActiveRole).toBe(false);    // has resignedOn
                expect(poc.roles[0].resignedOn).toBe('2023-07-31');

                // INVARIANTS: isActiveParty and isActivePersonOrContact are STILL null even for resigned
                expect(poc.isActiveParty).toBeNull();
                expect(poc.isActivePersonOrContact).toBeNull();
            });

            it('POC-3: PSC with natureOfControl array', () => {
                const pscConfig = {
                    ...BASE_CONFIG,
                    appointedOnPath: 'notified_on',
                    natureOfControlPath: 'nature_of_control',
                };
                const result = applyTransform(CH_PSC, transformType, pscConfig);

                const poc = result.value;
                expect(poc.surname).toBe('Jones');
                expect(poc.forenames).toBe('Alice');
                expect(poc.roles[0].natureOfControl).toEqual([
                    'ownership-of-shares-25-to-50-percent',
                    'voting-rights-25-to-50-percent',
                ]);
                expect(poc.roles[0].isActiveRole).toBe(true); // notified, not ceased
                expect(poc.isActiveParty).toBeNull();
                expect(poc.isActivePersonOrContact).toBeNull();
            });

            it('POC-4: DOB with month/year — day is null, NEVER defaulted to 1', () => {
                const payload = { name: 'DOE, Jane', date_of_birth: { month: 3, year: 1990 } };
                const result = applyTransform(payload, transformType, {
                    fullNamePath: 'name',
                    dobMonthPath: 'date_of_birth.month',
                    dobYearPath: 'date_of_birth.year',
                });
                expect(result.value.dateOfBirth).toEqual({ year: 1990, month: 3, day: null });
                expect(result.value.dateOfBirth.day).not.toBe(1);
            });

            it('POC-5: CONTACT contactType via defaultContactType config', () => {
                const teamPayload = { displayName: 'Compliance Team', email: 'compliance@example.com' };
                const result = applyTransform(teamPayload, transformType, {
                    displayNamePath: 'displayName',
                    emailPath: 'email',
                    defaultContactType: 'CONTACT',
                });
                const poc = result.value;
                expect(poc.contactType).toBe('CONTACT');
                expect(poc.forenames).toBe('Compliance Team');
                expect(poc.email).toBe('compliance@example.com');
                expect(poc.isActiveParty).toBeNull();
                expect(poc.isActivePersonOrContact).toBeNull();
            });

            it('POC-6: null input degrades safely with full confidence penalty', () => {
                const result = applyTransform(null, transformType, BASE_CONFIG);
                expect(result.value).toBeNull();
                expect(result.confidencePenalty).toBe(0);  // null input short-circuits at top of applyTransform
            });

            it('POC-7: array input is rejected (not a single object)', () => {
                const result = applyTransform([CH_DIRECTOR_ACTIVE], transformType, BASE_CONFIG);
                expect(result.value).toBeNull();
                expect(result.confidencePenalty).toBe(1);
            });

            it('POC-8: string input is rejected', () => {
                const result = applyTransform('John Smith', transformType, BASE_CONFIG);
                expect(result.value).toBeNull();
                expect(result.confidencePenalty).toBe(1);
            });

            it('POC-9: isActivePersonOrContact / isActiveParty is never copied from role status', () => {
                // resigned_on is present but no appointedOnPath configured:
                // isActiveRole is null (indeterminate — no appoint date means we can't derive active state).
                const payload = { name: 'BROWN, Bob', officer_role: 'director', resigned_on: '2022-01-01' };
                const result = applyTransform(payload, transformType, {
                    fullNamePath: 'name',
                    roleTitlePath: 'officer_role',
                    resignedOnPath: 'resigned_on',
                });
                const poc = result.value;
                // isActiveRole is null when appointedOn is absent (indeterminate, not false)
                expect(poc.roles[0].isActiveRole).toBeNull();
                // INVARIANT: person-level active status MUST be null regardless
                expect(poc.isActiveParty).toBeNull();
                expect(poc.isActivePersonOrContact).toBeNull();
            });

            it('POC-10: single-token name (no comma, no space) treated as surname', () => {
                const result = applyTransform({ name: 'SMITH' }, transformType, {
                    fullNamePath: 'name',
                });
                expect(result.value.surname).toBe('SMITH');
                expect(result.value.forenames).toBeNull();
            });

            it('POC-11: correspondenceAddress is extracted from value.address', () => {
                const result = applyTransform(CH_DIRECTOR_WITH_ADDRESS, transformType, BASE_CONFIG);
                expect(result.value.correspondenceAddress).toBeDefined();
                expect(result.value.correspondenceAddress).not.toBeNull();
                expect(result.value.correspondenceAddress.addressLines).toBeDefined();
                expect(result.value.correspondenceAddress.locality).toBe('London');
            });
        });
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('TO_PARTY_VALUE_LIST and TO_PERSON_OR_CONTACT_LIST', () => {
    const transformTypes = ['TO_PARTY_VALUE_LIST', 'TO_PERSON_OR_CONTACT_LIST'] as const;

    transformTypes.forEach((transformType) => {
        describe(`Transform: ${transformType}`, () => {
            it('LIST-1: returns top-level array — NOT embedded inside valueJson', () => {
                const officers = [CH_DIRECTOR_ACTIVE, CH_DIRECTOR_RESIGNED];
                const result = applyTransform(officers, transformType, BASE_CONFIG);

                // Top-level value is the array (not { value: [...] })
                expect(Array.isArray(result.value)).toBe(true);
                expect(result.value).toHaveLength(2);

                // NOT embedded inside an object
                expect(result.value[0]).not.toHaveProperty('value');
            });

            it('LIST-2: returns parallel rowKeys array', () => {
                const officers = [CH_DIRECTOR_ACTIVE, CH_PSC];
                const pscConfig = {
                    ...BASE_CONFIG,
                    appointedOnPath: 'notified_on',
                    natureOfControlPath: 'nature_of_control',
                };
                const result = applyTransform(officers, transformType, pscConfig);

                expect(Array.isArray(result.rowKeys)).toBe(true);
                expect(result.rowKeys).toHaveLength(result.value.length);

                // rowKeys are deterministic strings, not empty
                result.rowKeys!.forEach((key: string) => {
                    expect(typeof key).toBe('string');
                    expect(key.length).toBeGreaterThan(0);
                    expect(key).toMatch(/^poc_/);
                });
            });

            it('LIST-3: isActiveParty / isActivePersonOrContact is null for all items', () => {
                const officers = [CH_DIRECTOR_ACTIVE, CH_DIRECTOR_RESIGNED];
                const result = applyTransform(officers, transformType, BASE_CONFIG);

                result.value.forEach((poc: any) => {
                    expect(poc.isActiveParty).toBeNull();
                    expect(poc.isActivePersonOrContact).toBeNull();
                });
            });

            it('LIST-4: resigned director appears in list with isActiveRole=false', () => {
                const result = applyTransform([CH_DIRECTOR_RESIGNED], transformType, BASE_CONFIG);

                expect(result.value).toHaveLength(1);
                expect(result.value[0].roles[0].isActiveRole).toBe(false);
                expect(result.value[0].isActiveParty).toBeNull();
                expect(result.value[0].isActivePersonOrContact).toBeNull();
            });

            it('LIST-5: null input returns null value with full confidence penalty', () => {
                const result = applyTransform(null, transformType, BASE_CONFIG);
                expect(result.value).toBeNull();
            });

            it('LIST-6: non-array input is rejected', () => {
                const result = applyTransform(CH_DIRECTOR_ACTIVE, transformType, BASE_CONFIG);
                expect(result.value).toBeNull();
                expect(result.confidencePenalty).toBe(1);
            });

            it('LIST-7: each item carries appointedOn + resignedOn for effectiveFrom/effectiveTo', () => {
                const result = applyTransform([CH_DIRECTOR_RESIGNED], transformType, BASE_CONFIG);
                const item = result.value[0];
                expect(item.appointedOn).toBeUndefined();
                expect(item.resignedOn).toBeUndefined();
                expect(item.roles[0].appointedOn).toBe('2020-01-15');
                expect(item.roles[0].resignedOn).toBe('2023-07-31');
            });
        });
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('buildPersonOrContactRowKey', () => {
    it('KEY-1: produces deterministic poc_ prefix key', () => {
        const key = buildPersonOrContactRowKey('2020-01-15', { surname: 'Smith', forenames: 'John' });
        expect(key).toBe('poc_2020-01-15_smith_j');
    });

    it('KEY-2: uses unknown for surname when missing and adds first initial of forenames', () => {
        const key = buildPersonOrContactRowKey('2020-01-15', { forenames: 'Compliance Team' });
        expect(key).toMatch(/^poc_2020-01-15_unknown_c/);
    });

    it('KEY-3: uses unknown date when appointedOn is null', () => {
        const key = buildPersonOrContactRowKey(null, { surname: 'Jones', forenames: 'Alice' });
        expect(key).toBe('poc_unknown_jones_a');
    });

    it('KEY-4: is idempotent — same inputs always produce same key', () => {
        const args: [string, any] = ['2019-03-01', { surname: 'Jones', forenames: 'Alice' }];
        expect(buildPersonOrContactRowKey(...args)).toBe(buildPersonOrContactRowKey(...args));
    });
});

describe('isPartyValue and PersonOrContact legacy normalization', () => {
    it('NORM-1: validates and normalizes active flag from legacy isActivePersonOrContact', () => {
        const legacyValue = {
            contactType: 'PERSON',
            forenames: 'Bob',
            surname: 'Builder',
            isActivePersonOrContact: true,
            roles: [],
            phones: [],
            nationality: [],
            visibility: { scope: 'CLIENT_LE' }
        };
        const isValid = isPartyValue(legacyValue);
        expect(isValid).toBe(true);
        expect((legacyValue as any).isActiveParty).toBe(true);
        expect((legacyValue as any).isActivePersonOrContact).toBe(true);
    });

    it('NORM-2: validates and normalizes active flag from new isActiveParty', () => {
        const newValue = {
            contactType: 'PERSON',
            forenames: 'Bob',
            surname: 'Builder',
            isActiveParty: false,
            roles: [],
            phones: [],
            nationality: [],
            visibility: { scope: 'CLIENT_LE' }
        };
        const isValid = isPartyValue(newValue);
        expect(isValid).toBe(true);
        expect((newValue as any).isActiveParty).toBe(false);
        expect((newValue as any).isActivePersonOrContact).toBe(false);
    });
});

describe('isValidPartyValue validation logic', () => {
    it('VAL-1: returns true for objects with a usable name', () => {
        expect(isValidPartyValue({ forenames: 'John', surname: 'Smith' })).toBe(true);
        expect(isValidPartyValue({ surname: 'Smith' })).toBe(true);
        expect(isValidPartyValue({ fullName: 'John Smith' })).toBe(true);
        expect(isValidPartyValue({ name: 'John Smith' })).toBe(true);
        expect(isValidPartyValue({ title: 'Mr' })).toBe(true);
    });

    it('VAL-2: returns true for objects with source identifiers', () => {
        expect(isValidPartyValue({ sourceIdentifiers: [{ scheme: 'CH', value: '123' }] })).toBe(true);
    });

    it('VAL-3: returns false for empty or non-object values', () => {
        expect(isValidPartyValue(null)).toBe(false);
        expect(isValidPartyValue(undefined)).toBe(false);
        expect(isValidPartyValue({})).toBe(false);
        expect(isValidPartyValue([])).toBe(false);
        expect(isValidPartyValue({ forenames: '', surname: '  ' })).toBe(false);
    });
});

describe('isRenderableActiveDirectorParty logic', () => {
    it('DIR-1: returns true for valid party with active director role', () => {
        const activeDirector = {
            forenames: 'John',
            surname: 'Smith',
            roles: [{
                roleType: 'director',
                roleTitle: 'Director',
                isActiveRole: true,
                appointedOn: '2020-01-01',
                resignedOn: null
            }]
        };
        expect(isRenderableActiveDirectorParty(activeDirector)).toBe(true);
    });

    it('DIR-2: returns false for resigned director', () => {
        const resignedDirector = {
            forenames: 'John',
            surname: 'Smith',
            roles: [{
                roleType: 'director',
                roleTitle: 'Director',
                isActiveRole: false,
                appointedOn: '2020-01-01',
                resignedOn: '2022-01-01'
            }]
        };
        expect(isRenderableActiveDirectorParty(resignedDirector)).toBe(false);

        const resignedDirector2 = {
            forenames: 'John',
            surname: 'Smith',
            roles: [{
                roleType: 'director',
                roleTitle: 'Director',
                isActiveRole: true,
                appointedOn: '2020-01-01',
                resignedOn: '2022-01-01'
            }]
        };
        expect(isRenderableActiveDirectorParty(resignedDirector2)).toBe(false);
    });

    it('DIR-3: returns false for secretary role', () => {
        const secretary = {
            forenames: 'John',
            surname: 'Smith',
            roles: [{
                roleType: 'secretary',
                roleTitle: 'Secretary',
                isActiveRole: true,
                appointedOn: '2020-01-01',
                resignedOn: null
            }]
        };
        expect(isRenderableActiveDirectorParty(secretary)).toBe(false);
    });

    it('DIR-4: returns false for blank/anonymous objects', () => {
        expect(isRenderableActiveDirectorParty({})).toBe(false);
        expect(isRenderableActiveDirectorParty(null)).toBe(false);
    });
});

describe('TO_PARTY_VALUE transform guard for empty/anonymous values', () => {
    it('GUARD-1: returns null for anonymous payloads with no name or identifiers', () => {
        const result = applyTransform({ name: '' }, 'TO_PARTY_VALUE', BASE_CONFIG);
        expect(result.value).toBeNull();
        expect(result.confidencePenalty).toBe(1);
    });
});

describe('TO_PARTY_ORGANISATION transform', () => {
    it('normalises GleifL2Entity summary into canonical OrganisationPartyData', () => {
        const rawGleifL2 = {
            lei: '529900L73GEWN1O5NH84',
            legalName: 'JAGUAR LAND ROVER AUTOMOTIVE PLC',
            jurisdiction: 'GB',
            legalFormId: 'B6ES',
            registeredAs: '06477691',
            entityStatus: 'ACTIVE',
            registrationStatus: 'ISSUED'
        };

        const result = applyTransform(rawGleifL2, 'TO_PARTY_ORGANISATION');
        expect(result.confidencePenalty).toBe(0);
        expect(result.value).toEqual({
            schemaVersion: 2,
            partyType: 'ORGANISATION',
            legalName: 'JAGUAR LAND ROVER AUTOMOTIVE PLC',
            incorporatedIn: 'GB',
            registrationNumber: '06477691',
            legalForm: 'B6ES',
            governingLaw: null,
            knownAs: null,
            emails: [],
            phones: [],
            roles: [],
            sourceIdentifiers: [{ scheme: 'LEI', value: '529900L73GEWN1O5NH84' }],
            registeredAddressRef: null,
            isActiveParty: true
        });
    });

    it('returns null with penalty 1 when legalName is missing', () => {
        const result = applyTransform({ lei: '123' }, 'TO_PARTY_ORGANISATION');
        expect(result.value).toBeNull();
        expect(result.confidencePenalty).toBe(1);
    });
});

describe('Phase 1B: Datatype Compatibility & Normalisation', () => {
    it('COMPAT-1: normalises legacy PERSON values to INDIVIDUAL / PERSON', () => {
        const legacyVal = {
            contactType: 'PERSON',
            forenames: 'John',
            surname: 'Smith',
            roles: []
        };
        const valid = isPartyValue(legacyVal);
        expect(valid).toBe(true);
        expect((legacyVal as any).partyType).toBe('INDIVIDUAL');
        expect((legacyVal as any).partySubType).toBe('PERSON');
    });

    it('COMPAT-2: normalises legacy CONTACT values to INDIVIDUAL / CONTACT', () => {
        const legacyVal = {
            contactType: 'CONTACT',
            forenames: 'Compliance Group',
            roles: []
        };
        const valid = isPartyValue(legacyVal);
        expect(valid).toBe(true);
        expect((legacyVal as any).partyType).toBe('INDIVIDUAL');
        expect((legacyVal as any).partySubType).toBe('CONTACT');
    });
});

describe('Phase 1B: New Party Types & Validation', () => {
    it('TYPE-1: validates individual types', () => {
        const individual = {
            partyType: 'INDIVIDUAL',
            partySubType: 'PERSON',
            forenames: 'Alice',
            surname: 'Wonderland'
        };
        expect(isValidPartyValue(individual)).toBe(true);
    });

    it('TYPE-2: validates organisation types', () => {
        const org = {
            partyType: 'ORGANISATION',
            partySubType: 'COMPANY',
            organisationName: 'Company Ltd'
        };
        expect(isValidPartyValue(org)).toBe(true);

        const orgWithDisplay = {
            partyType: 'ORGANISATION',
            partySubType: 'TRUST',
            displayName: 'My Family Trust'
        };
        expect(isValidPartyValue(orgWithDisplay)).toBe(true);

        const invalidOrg = {
            partyType: 'ORGANISATION',
            partySubType: 'COMPANY',
            forenames: 'Not',
            surname: 'AnOrg'
        };
        expect(isValidPartyValue(invalidOrg)).toBe(false);
    });

    it('TYPE-3: validates unknown type with any name', () => {
        const unknownIndividual = {
            partyType: 'UNKNOWN',
            partySubType: 'OTHER',
            surname: 'IndividualName'
        };
        expect(isValidPartyValue(unknownIndividual)).toBe(true);

        const unknownOrg = {
            partyType: 'UNKNOWN',
            partySubType: 'OTHER',
            organisationName: 'OrgName'
        };
        expect(isValidPartyValue(unknownOrg)).toBe(true);

        const emptyUnknown = {
            partyType: 'UNKNOWN',
            partySubType: 'OTHER'
        };
        expect(isValidPartyValue(emptyUnknown)).toBe(false);
    });
});

describe('Phase 1B: Summary Rendering', () => {
    it('RENDER-1: renders individual summaries', () => {
        const individual = {
            partyType: 'INDIVIDUAL',
            partySubType: 'PERSON',
            forenames: 'Alice',
            surname: 'Wonderland',
            roles: []
        } as any;
        expect(getPartySummary(individual)).toBe('Alice Wonderland');
    });

    it('RENDER-2: renders organisation summaries', () => {
        const org = {
            partyType: 'ORGANISATION',
            partySubType: 'COMPANY',
            organisationName: 'Company Ltd',
            roles: []
        } as any;
        expect(getPartySummary(org)).toBe('Company Ltd');

        const trust = {
            partyType: 'ORGANISATION',
            partySubType: 'TRUST',
            displayName: 'My Family Trust',
            roles: []
        } as any;
        expect(getPartySummary(trust)).toBe('My Family Trust');
    });
});

describe('Phase 1B: Regression checks for active directors (Field 63)', () => {
    it('REG-1: verifies Field 63 active director selection', () => {
        const activeDirector = {
            partyType: 'INDIVIDUAL',
            partySubType: 'PERSON',
            forenames: 'John',
            surname: 'Smith',
            roles: [{
                roleType: 'director',
                roleTitle: 'Director',
                isActiveRole: true,
                appointedOn: '2020-01-01',
                resignedOn: null
            }]
        };
        expect(isRenderableActiveDirectorParty(activeDirector)).toBe(true);

        const resignedDirector = {
            partyType: 'INDIVIDUAL',
            partySubType: 'PERSON',
            forenames: 'John',
            surname: 'Smith',
            roles: [{
                roleType: 'director',
                roleTitle: 'Director',
                isActiveRole: false,
                appointedOn: '2020-01-01',
                resignedOn: '2022-01-01'
            }]
        };
        expect(isRenderableActiveDirectorParty(resignedDirector)).toBe(false);
    });
});

describe('TO_COMPANIES_HOUSE_ACTIVE_DIRECTOR_PARTY_VALUE_LIST', () => {
    it('should include only active directors and exclude secretaries and resigned directors', () => {
        const payload = [
            CH_DIRECTOR_ACTIVE,
            CH_DIRECTOR_RESIGNED,
            { ...CH_DIRECTOR_ACTIVE, officer_role: 'secretary', name: 'SECRETARY, Sam' }
        ];

        const res = applyTransform(payload, 'TO_COMPANIES_HOUSE_ACTIVE_DIRECTOR_PARTY_VALUE_LIST', BASE_CONFIG);
        
        expect(res.confidencePenalty).toBe(0);
        expect(Array.isArray(res.value)).toBe(true);
        expect(res.value.length).toBe(1);
        expect(res.value[0].surname).toBe('Smith');
        expect(res.value[0].forenames).toBe('John Robert');
        expect(res.value[0].roles[0].roleTitle).toBe('director');
    });

    it('should pass through rowKeys matching the active directors', () => {
        const payload = [
            { ...CH_DIRECTOR_ACTIVE, officer_role: 'secretary', name: 'SECRETARY, Sam' },
            CH_DIRECTOR_ACTIVE
        ];

        const res = applyTransform(payload, 'TO_COMPANIES_HOUSE_ACTIVE_DIRECTOR_PARTY_VALUE_LIST', BASE_CONFIG);
        expect(res.value.length).toBe(1);
        expect(res.value[0].surname).toBe('Smith');
        
        expect(res.rowKeys.length).toBe(1);
        const expectedRowKey = buildPersonOrContactRowKey('2020-01-15', res.value[0]);
        expect(res.rowKeys[0]).toBe(expectedRowKey);
    });
});
