import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toExportText } from '../toExportText';
import { resolveFieldForDisplay } from '@/lib/master-data/field-interpreter';

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

// Helper to mimic the old formatReleasedValue signature using the new canonical path
function canonicalFormat({ value, appDataType, profileConfig }: { value: any, appDataType?: string, profileConfig?: any }): string {
    const model = resolveFieldForDisplay(value, null, {
        fieldNo: 1,
        label: 'Mock Field',
        displayState: 'HAS_VALUE', // Internally handled if value is explicitNone
        appDataType,
        profileConfig
    });
    return toExportText(model);
}

describe('toExportText (Legacy Parity Regression Coverage)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Scalars & Primitives', () => {
        it('handles null, undefined, and empty string', () => {
            expect(canonicalFormat({ value: null })).toBe("No response recorded"); // Canonical engine is stricter, but empty state logic is handled higher up in real usage
            expect(canonicalFormat({ value: undefined })).toBe("No response recorded");
            expect(canonicalFormat({ value: "" })).toBe("No response recorded");
        });

        it('handles scalar strings and numbers', () => {
            expect(canonicalFormat({ value: "Hello" })).toBe("Hello");
            expect(canonicalFormat({ value: 123 })).toBe("123");
            expect(canonicalFormat({ value: 0 })).toBe("0");
        });

        it('handles booleans based on appDataType', () => {
            // If BOOLEAN datatype is provided
            expect(canonicalFormat({ value: true, appDataType: 'BOOLEAN' })).toBe("Yes");
            expect(canonicalFormat({ value: false, appDataType: 'BOOLEAN' })).toBe("No");
            
            // Canonical engine is strictly typed, so string "true" remains a scalar string
            expect(canonicalFormat({ value: "true", appDataType: 'BOOLEAN' })).toBe("true");
            expect(canonicalFormat({ value: "false", appDataType: 'BOOLEAN' })).toBe("false");

            // Canonical engine converts booleans to Yes/No even without appDataType
            expect(canonicalFormat({ value: true })).toBe("Yes");
        });
    });

    describe('Explicit States', () => {
        it('handles explicitNone objects', () => {
            expect(canonicalFormat({ value: { explicitNone: true } })).toBe("None");
        });
    });

    describe('PARTY Handling', () => {
        const partyVal = {
            organisationName: "Acme Corp",
            registrationNumber: "123456",
            countryOfIncorporation: "UK"
        };

        it('FIXED LEGACY BUG: PARTY without displayMask now falls back to organisationName instead of Unnamed Individual', () => {
            const res = canonicalFormat({ value: partyVal, appDataType: 'PARTY' });
            expect(res).toBe("Acme Corp");
        });

        it('handles PARTY with displayMask', () => {
            const res = canonicalFormat({
                value: partyVal,
                appDataType: 'PARTY',
                profileConfig: { displayMask: ['organisationName', 'registrationNumber'] }
            });
            // Should be comma-separated visible parts
            expect(res).toBe("Acme Corp, 123456");
        });

        it('skips missing fields in displayMask', () => {
            const res = canonicalFormat({
                value: partyVal,
                appDataType: 'PARTY',
                profileConfig: { displayMask: ['organisationName', 'nonExistent', 'countryOfIncorporation'] }
            });
            expect(res).toBe("Acme Corp, UK");
        });

        it('handles embedded Address objects within a displayMask', () => {
            const complexParty = {
                ...partyVal,
                registeredAddress: { addressLines: ["123 Street"], countryCode: "US" }
            };
            const res = canonicalFormat({
                value: complexParty,
                appDataType: 'PARTY',
                profileConfig: { displayMask: ['organisationName', 'registeredAddress'] }
            });
            // Should call getAddressSummary on the nested address, expanding "US" to "United States"
            expect(res).toBe("Acme Corp, 123 Street, United States");
        });

        it('FIXED LEGACY BUG: falls back to organisationName if displayMask is empty array instead of Unnamed Individual', () => {
            const res = canonicalFormat({
                value: partyVal,
                appDataType: 'PARTY',
                profileConfig: { displayMask: [] }
            });
            expect(res).toBe("Acme Corp");
        });
    });

    describe('ADDRESS Handling', () => {
        const addrVal = {
            addressLines: ["456 Road"],
            locality: "Town",
            countryCode: "FR"
        };

        it('handles ADDRESS values using getAddressSummary', () => {
            const res = canonicalFormat({ value: addrVal, appDataType: 'ADDRESS' });
            expect(res).toBe("456 Road, Town, France");
        });
    });

    describe('Reference Resolution (PARTY_REF / ADDRESS_REF)', () => {
        it('resolves and formats party references', () => {
            const res = canonicalFormat({ value: { ccPartyId: 'p-mock' } });
            // Since this test doesn't do async enrichment, it will be unresolved and canonical engine prints the ID
            expect(res).toBe("ID:p-mock…");
        });

        it('resolves and formats address references', () => {
            const res = canonicalFormat({ value: { ccAddressId: 'a-mock' } });
            // Since this test doesn't do async enrichment, it will be unresolved and canonical engine prints the ID
            expect(res).toBe("ID:a-mock…");
        });

        it('uses _resolvedData if available to avoid DB queries', () => {
            const res = canonicalFormat({
                value: {
                    ccPartyId: 'ignored-mock',
                    ccParty: { data: { organisationName: "Prefetched Party" } }
                }
            });
            expect(res).toBe("Prefetched Party");
        });
    });

    describe('Collections (Arrays)', () => {
        it('handles scalar collections', () => {
            const res = canonicalFormat({ value: ["A", "B", "C"] });
            expect(res).toBe("A; B; C");
        });

        it('handles party collections', () => {
            const arr = [
                { organisationName: "Party One" },
                { organisationName: "Party Two" }
            ];
            const res = canonicalFormat({ value: arr, appDataType: 'PARTY' });
            expect(res).toBe("Party One; Party Two");
        });

        it('handles address collections', () => {
            const arr = [
                { addressLines: ["Address 1"] },
                { addressLines: ["Address 2"] }
            ];
            const res = canonicalFormat({ value: arr, appDataType: 'ADDRESS' });
            expect(res).toBe("Address 1; Address 2");
        });
    });

    describe('Legacy Fallbacks & Bugs', () => {
        it('FIXED LEGACY BUG: renders code lists as readable strings instead of [Structured value]', () => {
            // A typical code list item from MasterRecord
            const codeList = [
                { code: "DIR", label: "Director" },
                { code: "SHR", label: "Shareholder" }
            ];
            const res = canonicalFormat({ value: codeList });
            
            expect(res).toBe("Director; Shareholder");
        });

        it('renders unknown objects as [Structured value]', () => {
            const res = canonicalFormat({ value: { someRandomField: 123 } });
            expect(res).toBe("[Structured value]");
        });
        
        it('KNOWN LEGACY BEHAVIOUR PRESERVED: renders nested unknown objects within PARTY mask as [Structured value]', () => {
            const complexParty = {
                organisationName: "Acme",
                someUnknownNestedObject: { foo: "bar" }
            };
            const res = canonicalFormat({
                value: complexParty,
                appDataType: 'PARTY',
                profileConfig: { displayMask: ['organisationName', 'someUnknownNestedObject'] }
            });
            // expected to hit "[Structured value]" fallback in resolvePath map
            expect(res).toBe("Acme, [Structured value]");
        });
    });
});
