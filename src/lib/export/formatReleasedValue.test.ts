import { describe, it, expect, vi } from 'vitest';
import { formatReleasedValue } from './formatReleasedValue';
import * as kycQuery from '@/actions/kyc-query';

// Mock the query actions to prevent real DB calls in unit tests
vi.mock('@/actions/kyc-query', () => ({
    enrichPartyReferences: vi.fn(async (arr: any[]) => {
        for (const item of arr) {
            if (item.ccPartyId === 'party-1') {
                item.ccParty = {
                    data: {
                        contactType: 'PERSON',
                        forenames: 'Resolved',
                        surname: 'Party',
                        dateOfBirth: '1990-01-01',
                    }
                };
            }
        }
    }),
    enrichAddressReferences: vi.fn(async (arr: any[]) => {
        for (const item of arr) {
            if (item.ccAddressId === 'addr-1') {
                item.ccAddress = {
                    data: {
                        addressLines: ['Resolved Street'],
                        locality: 'Resolved City',
                        countryCode: 'US'
                    }
                };
            }
        }
    })
}));

describe('formatReleasedValue', () => {
    it('returns scalar strings unchanged', async () => {
        expect(await formatReleasedValue({ value: 'hello' })).toBe('hello');
        expect(await formatReleasedValue({ value: '' })).toBe('');
    });

    it('returns numbers and booleans safely as strings', async () => {
        expect(await formatReleasedValue({ value: 123 })).toBe('123');
        expect(await formatReleasedValue({ value: true })).toBe('true');
        expect(await formatReleasedValue({ value: false })).toBe('false');
    });

    it('formats array by joining formatted items securely', async () => {
        const value = ['hello', 123, { explicitNone: true }];
        expect(await formatReleasedValue({ value })).toBe('hello; 123; None');
    });

    it('returns [Structured value] for unknown objects', async () => {
        const unknownObj = { foo: 'bar', baz: 123 };
        expect(await formatReleasedValue({ value: unknownObj })).toBe('[Structured value]');
    });

    describe('PARTY formatting', () => {
        const partyBase = {
            contactType: 'PERSON',
            forenames: 'John',
            surname: 'Doe',
            dateOfBirth: '1980-01-01',
            sourceIdentifiers: [{ scheme: 'passport', value: '123' }]
        };

        it('returns only fields in displayMask', async () => {
            const res = await formatReleasedValue({
                value: partyBase,
                appDataType: 'PARTY',
                profileConfig: { displayMask: ['forenames', 'surname'] }
            });
            expect(res).toBe('John, Doe');
            expect(res).not.toContain('1980-01-01');
            expect(res).not.toContain('passport');
        });

        it('supports dotted paths like dateOfBirth.year', async () => {
            const partyWithNested = {
                forenames: 'John',
                surname: 'Doe',
                dateOfBirth: { year: 1980, month: 5, day: 15 },
            };
            const res = await formatReleasedValue({
                value: partyWithNested,
                appDataType: 'PARTY',
                profileConfig: { displayMask: ['forenames', 'surname', 'dateOfBirth.year'] }
            });
            expect(res).toBe('John, Doe, 1980');
            expect(res).not.toContain('15');
        });

        it('safely formats embedded address objects in displayMask without dumping JSON', async () => {
            const partyWithAddress = {
                forenames: 'John',
                surname: 'Doe',
                correspondenceAddress: {
                    addressLines: ['123 Main St'],
                    locality: 'Cityville',
                    countryCode: 'US'
                }
            };
            const res = await formatReleasedValue({
                value: partyWithAddress,
                appDataType: 'PARTY',
                profileConfig: { displayMask: ['forenames', 'surname', 'correspondenceAddress'] }
            });
            expect(res).toBe('John, Doe, 123 Main St, Cityville, United States');
        });

        it('returns [Structured value] for unknown objects in displayMask', async () => {
            const partyWithUnknown = {
                forenames: 'John',
                surname: 'Doe',
                unknownObject: { foo: 'bar' }
            };
            const res = await formatReleasedValue({
                value: partyWithUnknown,
                appDataType: 'PARTY',
                profileConfig: { displayMask: ['forenames', 'surname', 'unknownObject'] }
            });
            expect(res).toBe('John, Doe, [Structured value]');
        });

        it('does not expose DOB or sourceIdentifiers when mask is not provided, uses safe summary', async () => {
            const res = await formatReleasedValue({
                value: partyBase,
                appDataType: 'PARTY'
            });
            expect(res).toBe('John Doe'); // safe summary output
            expect(res).not.toContain('1980-01-01');
            expect(res).not.toContain('passport');
        });

        it('resolves PARTY_REF and formats safely without exposing ccPartyId', async () => {
            const res = await formatReleasedValue({
                value: { ccPartyId: 'party-1' },
                appDataType: 'PARTY_REF',
                profileConfig: { displayMask: ['forenames', 'surname'] }
            });
            expect(res).toBe('Resolved, Party');
            expect(res).not.toContain('party-1');
            expect(res).not.toContain('1990-01-01');
        });

        it('resolves PARTY_REF and formats safely with summary if no mask', async () => {
            const res = await formatReleasedValue({
                value: { ccPartyId: 'party-1' },
                appDataType: 'PARTY_REF'
            });
            expect(res).toBe('Resolved Party');
            expect(res).not.toContain('party-1');
            expect(res).not.toContain('1990-01-01');
        });
    });

    describe('ADDRESS formatting', () => {
        const addrBase = {
            addressLines: ['123 Main St'],
            locality: 'Cityville',
            postalCode: '12345',
            countryCode: 'US'
        };

        it('formats embedded ADDRESS safely', async () => {
            const res = await formatReleasedValue({
                value: addrBase,
                appDataType: 'ADDRESS'
            });
            expect(res).toBe('123 Main St, Cityville, 12345, United States');
        });

        it('resolves ADDRESS_REF and formats safely without exposing ccAddressId', async () => {
            const res = await formatReleasedValue({
                value: { ccAddressId: 'addr-1' },
                appDataType: 'ADDRESS_REF'
            });
            expect(res).toBe('Resolved Street, Resolved City, United States');
            expect(res).not.toContain('addr-1');
        });
    });
});
