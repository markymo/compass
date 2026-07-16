import { describe, it, expect } from 'vitest';
import { getPartyLabel } from '../label-helper';
import { NormalisedPartyReadModel } from '../normaliser';

describe('getPartyLabel', () => {
    describe('Individual', () => {
        it('prioritizes formal forenames and surname over knownAs', () => {
            const model = createMockModel({
                partyType: 'INDIVIDUAL',
                forenames: 'John',
                surname: 'Smith',
                knownAs: 'Johnny'
            });
            expect(getPartyLabel(model)).toBe('John Smith');
        });

        it('falls back to surname', () => {
            const model = createMockModel({
                partyType: 'INDIVIDUAL',
                surname: 'Smith',
                knownAs: 'Johnny'
            });
            expect(getPartyLabel(model)).toBe('Smith');
        });

        it('falls back to forenames', () => {
            const model = createMockModel({
                partyType: 'INDIVIDUAL',
                forenames: 'John',
                knownAs: 'Johnny'
            });
            expect(getPartyLabel(model)).toBe('John');
        });

        it('falls back to knownAs', () => {
            const model = createMockModel({
                partyType: 'INDIVIDUAL',
                knownAs: 'Johnny'
            });
            expect(getPartyLabel(model)).toBe('Johnny');
        });

        it('falls back to Unnamed individual', () => {
            const model = createMockModel({
                partyType: 'INDIVIDUAL'
            });
            expect(getPartyLabel(model)).toBe('Unnamed individual');
        });

        it('does not append role title', () => {
            const model = createMockModel({
                partyType: 'INDIVIDUAL',
                forenames: 'John',
                surname: 'Smith',
                roles: [{ roleTitle: 'Director', isActiveRole: true }]
            });
            expect(getPartyLabel(model)).toBe('John Smith'); // No "(Director)"
        });
    });

    describe('Team', () => {
        it('prioritizes teamName over knownAs', () => {
            const model = createMockModel({
                partyType: 'TEAM',
                teamName: 'Alpha Team',
                knownAs: 'The Alphas'
            });
            expect(getPartyLabel(model)).toBe('Alpha Team');
        });

        it('falls back to knownAs', () => {
            const model = createMockModel({
                partyType: 'TEAM',
                knownAs: 'The Alphas'
            });
            expect(getPartyLabel(model)).toBe('The Alphas');
        });

        it('falls back to Unnamed team', () => {
            const model = createMockModel({
                partyType: 'TEAM'
            });
            expect(getPartyLabel(model)).toBe('Unnamed team');
        });
    });

    describe('Organisation', () => {
        it('prioritizes legalName over knownAs', () => {
            const model = createMockModel({
                partyType: 'ORGANISATION',
                legalName: 'Acme Corp Ltd',
                knownAs: 'Acme'
            });
            expect(getPartyLabel(model)).toBe('Acme Corp Ltd');
        });

        it('falls back to knownAs', () => {
            const model = createMockModel({
                partyType: 'ORGANISATION',
                knownAs: 'Acme'
            });
            expect(getPartyLabel(model)).toBe('Acme');
        });

        it('falls back to Unnamed organisation', () => {
            const model = createMockModel({
                partyType: 'ORGANISATION'
            });
            expect(getPartyLabel(model)).toBe('Unnamed organisation');
        });
    });
});

// Helper to quickly build a mocked NormalisedPartyReadModel for tests
function createMockModel(partyOverrides: any): NormalisedPartyReadModel {
    return {
        generation: 'V2',
        party: {
            schemaVersion: 2,
            emails: [],
            phones: [],
            roles: [],
            sourceIdentifiers: [],
            isActiveParty: true,
            ...partyOverrides
        },
        legacy: {},
        diagnostics: []
    } as NormalisedPartyReadModel;
}
