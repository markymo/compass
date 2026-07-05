import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatReleasedValue } from '../formatReleasedValue';

// Mock the action dependencies so tests run fast without DB
vi.mock('@/actions/kyc-query', () => ({
    enrichPartyReferences: vi.fn().mockImplementation(async (arr) => {
        for (const item of arr) {
            if (item.ccPartyId === 'p-mock') {
                item.ccParty = { data: { companyName: 'Enriched Party' } };
            }
        }
    }),
    enrichAddressReferences: vi.fn().mockImplementation(async (arr) => {
        for (const item of arr) {
            if (item.ccAddressId === 'a-mock') {
                item.ccAddress = { data: { addressLines: ['Enriched Address Line'] } };
            }
        }
    })
}));

describe('formatReleasedValue (Legacy Parity Test Harness)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Scalars & Primitives', () => {
        it('handles null, undefined, and empty string', async () => {
            expect(await formatReleasedValue({ value: null })).toBe("");
            expect(await formatReleasedValue({ value: undefined })).toBe("");
            expect(await formatReleasedValue({ value: "" })).toBe("");
        });

        it('handles scalar strings and numbers', async () => {
            expect(await formatReleasedValue({ value: "Hello" })).toBe("Hello");
            expect(await formatReleasedValue({ value: 123 })).toBe("123");
            expect(await formatReleasedValue({ value: 0 })).toBe("0");
        });

        it('handles booleans based on appDataType', async () => {
            // If BOOLEAN datatype is provided
            expect(await formatReleasedValue({ value: true, appDataType: 'BOOLEAN' })).toBe("Yes");
            expect(await formatReleasedValue({ value: false, appDataType: 'BOOLEAN' })).toBe("No");
            expect(await formatReleasedValue({ value: "true", appDataType: 'BOOLEAN' })).toBe("Yes");
            expect(await formatReleasedValue({ value: "false", appDataType: 'BOOLEAN' })).toBe("No");

            // If not provided, it just stringifies
            expect(await formatReleasedValue({ value: true })).toBe("true");
        });
    });

    describe('Explicit States', () => {
        it('handles explicitNone objects', async () => {
            expect(await formatReleasedValue({ value: { explicitNone: true } })).toBe("None");
        });
    });

    describe('PARTY Handling', () => {
        const partyVal = {
            companyName: "Acme Corp",
            registrationNumber: "123456",
            countryOfIncorporation: "UK"
        };

        it('handles PARTY without displayMask using getPartySummary', async () => {
            const res = await formatReleasedValue({ value: partyVal, appDataType: 'PARTY' });
            // getPartySummary apparently returns "Unnamed Individual" for this shape!
            expect(res).toBe("Unnamed Individual");
        });

        it('handles PARTY with displayMask', async () => {
            const res = await formatReleasedValue({
                value: partyVal,
                appDataType: 'PARTY',
                profileConfig: { displayMask: ['companyName', 'registrationNumber'] }
            });
            // Should be comma-separated visible parts
            expect(res).toBe("Acme Corp, 123456");
        });

        it('skips missing fields in displayMask', async () => {
            const res = await formatReleasedValue({
                value: partyVal,
                appDataType: 'PARTY',
                profileConfig: { displayMask: ['companyName', 'nonExistent', 'countryOfIncorporation'] }
            });
            expect(res).toBe("Acme Corp, UK");
        });

        it('handles embedded Address objects within a displayMask', async () => {
            const complexParty = {
                ...partyVal,
                registeredAddress: { addressLines: ["123 Street"], countryCode: "US" }
            };
            const res = await formatReleasedValue({
                value: complexParty,
                appDataType: 'PARTY',
                profileConfig: { displayMask: ['companyName', 'registeredAddress'] }
            });
            // Should call getAddressSummary on the nested address, expanding "US" to "United States"
            expect(res).toBe("Acme Corp, 123 Street, United States");
        });

        it('falls back to getPartySummary if displayMask is empty array', async () => {
            const res = await formatReleasedValue({
                value: partyVal,
                appDataType: 'PARTY',
                profileConfig: { displayMask: [] }
            });
            expect(res).toBe("Unnamed Individual");
        });
    });

    describe('ADDRESS Handling', () => {
        const addrVal = {
            addressLines: ["456 Road"],
            locality: "Town",
            countryCode: "FR"
        };

        it('handles ADDRESS values using getAddressSummary', async () => {
            const res = await formatReleasedValue({ value: addrVal, appDataType: 'ADDRESS' });
            expect(res).toBe("456 Road, Town, France");
        });
    });

    describe('Reference Resolution (PARTY_REF / ADDRESS_REF)', () => {
        it('resolves and formats party references', async () => {
            const res = await formatReleasedValue({ value: { ccPartyId: 'p-mock' } });
            // Mock enriches this with companyName: 'Enriched Party'
            expect(res).toBe("Unnamed Individual");
        });

        it('resolves and formats address references', async () => {
            const res = await formatReleasedValue({ value: { ccAddressId: 'a-mock' } });
            // Mock enriches this with addressLines: ['Enriched Address Line']
            expect(res).toBe("Enriched Address Line");
        });

        it('uses _resolvedData if available to avoid DB queries', async () => {
            const res = await formatReleasedValue({
                value: {
                    ccPartyId: 'ignored-mock',
                    _resolvedData: { ccParty: { data: { companyName: "Prefetched Party" } } }
                }
            });
            expect(res).toBe("Unnamed Individual");
        });
    });

    describe('Collections (Arrays)', () => {
        it('handles scalar collections', async () => {
            const res = await formatReleasedValue({ value: ["A", "B", "C"] });
            expect(res).toBe("A; B; C");
        });

        it('handles party collections', async () => {
            const arr = [
                { companyName: "Party One" },
                { companyName: "Party Two" }
            ];
            const res = await formatReleasedValue({ value: arr, appDataType: 'PARTY' });
            expect(res).toBe("Unnamed Individual; Unnamed Individual");
        });

        it('handles address collections', async () => {
            const arr = [
                { addressLines: ["Address 1"] },
                { addressLines: ["Address 2"] }
            ];
            const res = await formatReleasedValue({ value: arr, appDataType: 'ADDRESS' });
            expect(res).toBe("Address 1; Address 2");
        });
    });

    describe('Legacy Fallbacks & Bugs', () => {
        it('KNOWN LEGACY BUG: renders code lists as [Structured value]', async () => {
            // A typical code list item from MasterRecord
            const codeList = [
                { code: "DIR", label: "Director" },
                { code: "SHR", label: "Shareholder" }
            ];
            const res = await formatReleasedValue({ value: codeList });
            
            // Expected bug behaviour: map over array, each object is unrecognized, 
            // formatReleasedValue returns "[Structured value]" for each, then joins by "; "
            expect(res).toBe("[Structured value]; [Structured value]");
        });

        it('renders unknown objects as [Structured value]', async () => {
            const res = await formatReleasedValue({ value: { someRandomField: 123 } });
            expect(res).toBe("[Structured value]");
        });
        
        it('KNOWN LEGACY BUG: renders nested unknown objects within PARTY mask as [Structured value]', async () => {
            const complexParty = {
                companyName: "Acme",
                someUnknownNestedObject: { foo: "bar" }
            };
            const res = await formatReleasedValue({
                value: complexParty,
                appDataType: 'PARTY',
                profileConfig: { displayMask: ['companyName', 'someUnknownNestedObject'] }
            });
            // expected to hit "[Structured value]" fallback in resolvePath map
            expect(res).toBe("Acme, [Structured value]");
        });
    });
});
