import { describe, it, expect } from 'vitest';
import {
    PARTY_DISPLAY_CATALOGUE,
    getDisplayFieldsForPartyTypes,
    normalizeMaskKeysToCanonical,
    isFieldPermittedByCatalogue
} from '../party-display-catalogue';

describe('Party Display Catalogue & Permission Evaluation', () => {

    describe('Catalogue Filtering by allowedPartyTypes', () => {
        it('returns all catalogue items when allowedPartyTypes is undefined', () => {
            const fields = getDisplayFieldsForPartyTypes(undefined);
            expect(fields.length).toBe(PARTY_DISPLAY_CATALOGUE.length);
        });

        it('returns empty array when allowedPartyTypes is strictly []', () => {
            const fields = getDisplayFieldsForPartyTypes([]);
            expect(fields).toEqual([]);
        });

        it('returns only INDIVIDUAL and shared fields for INDIVIDUAL party type', () => {
            const fields = getDisplayFieldsForPartyTypes(['INDIVIDUAL']);
            const keys = fields.map(f => f.key);

            expect(keys).toContain('individual.forenames');
            expect(keys).toContain('individual.surname');
            expect(keys).toContain('individual.nationality');
            expect(keys).toContain('individual.dateOfBirth.year');
            expect(keys).toContain('contact.email');
            expect(keys).toContain('role.roleTitle');

            expect(keys).not.toContain('organisation.legalName');
            expect(keys).not.toContain('organisation.legalForm');
            expect(keys).not.toContain('team.teamName');
        });

        it('returns only ORGANISATION and shared fields for ORGANISATION party type', () => {
            const fields = getDisplayFieldsForPartyTypes(['ORGANISATION']);
            const keys = fields.map(f => f.key);

            expect(keys).toContain('organisation.legalName');
            expect(keys).toContain('contact.email');
            expect(keys).toContain('role.roleTitle');

            expect(keys).not.toContain('individual.forenames');
            expect(keys).not.toContain('individual.surname');
            expect(keys).not.toContain('individual.dateOfBirth.year');
            expect(keys).not.toContain('team.teamName');
        });

        it('returns only TEAM and shared fields for TEAM party type', () => {
            const fields = getDisplayFieldsForPartyTypes(['TEAM']);
            const keys = fields.map(f => f.key);

            expect(keys).toContain('team.teamName');
            expect(keys).toContain('contact.email');

            expect(keys).not.toContain('individual.forenames');
            expect(keys).not.toContain('organisation.legalName');
            expect(keys).not.toContain('role.roleTitle');
        });
    });

    describe('Ambiguous organisationName Legacy Key Expansion', () => {
        it('expands organisationName to organisation.legalName when allowedPartyTypes includes ORGANISATION', () => {
            const { canonicalKeys } = normalizeMaskKeysToCanonical(['organisationName'], ['ORGANISATION']);
            expect(Array.from(canonicalKeys)).toEqual(['organisation.legalName']);
        });

        it('expands organisationName to team.teamName when allowedPartyTypes includes TEAM', () => {
            const { canonicalKeys } = normalizeMaskKeysToCanonical(['organisationName'], ['TEAM']);
            expect(Array.from(canonicalKeys)).toEqual(['team.teamName']);
        });

        it('expands organisationName to both when allowedPartyTypes includes both', () => {
            const { canonicalKeys } = normalizeMaskKeysToCanonical(['organisationName'], ['ORGANISATION', 'TEAM']);
            expect(Array.from(canonicalKeys)).toContain('organisation.legalName');
            expect(Array.from(canonicalKeys)).toContain('team.teamName');
        });
    });

    describe('Mask Evaluation (isFieldPermittedByCatalogue)', () => {
        it('allows all fields when displayMask is undefined or empty', () => {
            expect(isFieldPermittedByCatalogue('forenames', undefined)).toBe(true);
            expect(isFieldPermittedByCatalogue('forenames', [])).toBe(true);
        });

        it('DENIES all fields when displayMask is non-empty BUT contains zero recognized keys', () => {
            expect(isFieldPermittedByCatalogue('forenames', ['invalid_junk_key'])).toBe(false);
            expect(isFieldPermittedByCatalogue('organisationName', ['random_nonexistent_field'])).toBe(false);
        });

        it('permits recognized keys and denies unlisted keys', () => {
            const mask = ['forenames', 'surname'];
            expect(isFieldPermittedByCatalogue('forenames', mask)).toBe(true);
            expect(isFieldPermittedByCatalogue('surname', mask)).toBe(true);
            expect(isFieldPermittedByCatalogue('email', mask)).toBe(false);
        });

        it('handles de-indexed roles correctly across multiple role array items', () => {
            const mask = ['roles[0].roleTitle'];
            expect(isFieldPermittedByCatalogue('roles[0].roleTitle', mask)).toBe(true);
            expect(isFieldPermittedByCatalogue('roles[1].roleTitle', mask)).toBe(true);
            expect(isFieldPermittedByCatalogue('roles.roleTitle', mask)).toBe(true);

            expect(isFieldPermittedByCatalogue('roles[0].appointedOn', mask)).toBe(false);
        });

        it('handles canonical v2 keys correctly', () => {
            const mask = ['individual.forenames', 'contact.email'];
            expect(isFieldPermittedByCatalogue('forenames', mask)).toBe(true);
            expect(isFieldPermittedByCatalogue('email', mask)).toBe(true);
            expect(isFieldPermittedByCatalogue('surname', mask)).toBe(false);
        });
    });

});
