import { describe, it, expect } from 'vitest';
import { initialiseCanonicalPartyForm, buildCCPartyDataFromForm } from "../state-mappers";
import { NormalisedPartyReadModel } from "@/lib/master-data/party-v2/normaliser";

describe("state-mappers", () => {
    it("initialises form state correctly from V2 data", () => {
        const readModel: NormalisedPartyReadModel = {
            generation: "V2",
            party: {
                schemaVersion: 2,
                partyType: "INDIVIDUAL",
                forenames: "John",
                surname: "Doe",
                isActiveParty: true
            } as any,
            legacy: {},
            diagnostics: []
        };

        const formState = initialiseCanonicalPartyForm(readModel);
        expect(formState.partyType).toBe("INDIVIDUAL");
        expect(formState.identity.forenames).toBe("John");
        expect(formState.identity.surname).toBe("Doe");
        expect(formState.isActiveParty).toBe(true);
        expect(formState.roles).toEqual([]);
    });

    it("initialises form state correctly with legacy diagnostics", () => {
        const readModel: NormalisedPartyReadModel = {
            generation: "LEGACY",
            party: {
                schemaVersion: 2,
                partyType: "ORGANISATION",
                legalName: "Acme Corp"
            } as any,
            legacy: {
                embeddedHomeAddress: { addressLine1: "123 Main St" } as any,
                embeddedCorrespondenceAddress: { addressLine1: "PO Box 1" } as any
            },
            diagnostics: []
        };

        const formState = initialiseCanonicalPartyForm(readModel);
        expect(formState.legacyTopLevelAddressDiagnostics).toContain("homeAddress");
        expect(formState.legacyTopLevelAddressDiagnostics).toContain("correspondenceAddress");
    });

    it("builds valid data from form state and captures destructive omissions", () => {
        const readModel: NormalisedPartyReadModel = {
            generation: "LEGACY",
            party: {
                schemaVersion: 2,
                partyType: "INDIVIDUAL",
                roles: [{
                    roleType: "director"
                }]
            } as any,
            legacy: {
                embeddedHomeAddress: { addressLine1: "123 Main St" } as any,
                roleEmbeddedAddresses: [{
                    roleIndex: 0,
                    address: { addressLine1: "Role Addr" } as any
                }]
            },
            diagnostics: []
        };

        const formState = initialiseCanonicalPartyForm(readModel);
        formState.identity.forenames = "Jane";
        formState.identity.surname = "Smith";

        const candidate = buildCCPartyDataFromForm(formState, readModel);
        
        expect(candidate.isValid).toBe(true);
        expect(candidate.data?.partyType).toBe("INDIVIDUAL");
        expect((candidate.data as any).forenames).toBe("Jane");
        
        expect(candidate.destructiveOmissions).toHaveLength(2);
        
        const topLevel = candidate.destructiveOmissions.find(o => o.level === 'TOP_LEVEL');
        expect(topLevel?.addressRole).toBe("homeAddress");

        const roleLevel = candidate.destructiveOmissions.find(o => o.level === 'ROLE_LEVEL');
        expect(roleLevel?.addressRole).toBe("correspondenceAddress");
    });

    it("returns invalid candidate if required fields are missing", () => {
        const readModel: NormalisedPartyReadModel = {
            generation: "V2",
            party: {
                schemaVersion: 2,
                partyType: "INDIVIDUAL",
            } as any,
            legacy: {},
            diagnostics: []
        };

        const formState = initialiseCanonicalPartyForm(readModel);
        const candidate = buildCCPartyDataFromForm(formState);
        expect(candidate.isValid).toBe(false);
        expect(candidate.data).toBeNull();
    });

    it("collapses empty company objects in roles", () => {
        const readModel: NormalisedPartyReadModel = {
            generation: "V2",
            party: {
                schemaVersion: 2,
                partyType: "INDIVIDUAL",
                forenames: "Jane",
                roles: [{
                    roleType: "director",
                    company: { name: "", externalId: "", externalIdScheme: "", onProCompanyId: "" }
                }]
            } as any,
            legacy: {},
            diagnostics: []
        };

        const formState = initialiseCanonicalPartyForm(readModel);
        // User didn't type anything into company fields
        
        const candidate = buildCCPartyDataFromForm(formState);
        expect(candidate.isValid).toBe(true);
        expect(candidate.data?.roles![0].company).toBeUndefined();
    });

    describe("Date of Birth validation", () => {
        const getBaseForm = () => initialiseCanonicalPartyForm({
            generation: "V2",
            party: { schemaVersion: 2, partyType: "INDIVIDUAL", forenames: "A", surname: "B" } as any,
            legacy: {}, diagnostics: []
        });

        it("accepts valid full dates, leap years, and partial dates", () => {
            const validCases = [
                { y: "1990", m: "12", d: "31" },
                { y: "2024", m: "2", d: "29" }, // leap year
                { y: "2023", m: "4", d: "30" }, // 30 days
                { y: "1980", m: "5", d: "" }, // year and month
                { y: "1975", m: "", d: "" }, // year only
                { y: "", m: "", d: "" }, // blank
            ];

            for (const c of validCases) {
                const form = getBaseForm();
                form.identity.dateOfBirth = { year: c.y, month: c.m, day: c.d };
                const res = buildCCPartyDataFromForm(form);
                expect(res.isValid, `Should accept ${JSON.stringify(c)}`).toBe(true);
            }
        });

        it("rejects invalid date combinations", () => {
            const invalidCases = [
                { y: "1990", m: "13", d: "1" }, // invalid month
                { y: "1990", m: "4", d: "31" }, // 31 April
                { y: "2023", m: "2", d: "29" }, // non-leap year Feb 29
                { y: "", m: "5", d: "10" }, // month and day without year
                { y: "1990", m: "", d: "10" }, // day without month
                { y: "", m: "5", d: "" }, // month without year
                { y: "", m: "", d: "10" }, // day only
            ];

            for (const c of invalidCases) {
                const form = getBaseForm();
                form.identity.dateOfBirth = { year: c.y, month: c.m, day: c.d };
                const res = buildCCPartyDataFromForm(form);
                expect(res.isValid, `Should reject ${JSON.stringify(c)}`).toBe(false);
            }
        });
    });

    describe("Payload fidelity and strict type bounding", () => {
        it("emits strict INDIVIDUAL payload that passes isCCPartyData and lacks other party fields", async () => {
            const form = initialiseCanonicalPartyForm({
                generation: "V2",
                party: { schemaVersion: 2, partyType: "INDIVIDUAL", forenames: "A", surname: "B" } as any,
                legacy: {}, diagnostics: []
            });
            const res = buildCCPartyDataFromForm(form);
            expect(res.isValid).toBe(true);
            const data = res.data as any;
            
            // Should pass the runtime schema validator dynamically imported for tests
            const { isCCPartyData } = await import('@/lib/master-data/party-v2/CCPartyData');
            expect(isCCPartyData(data)).toBe(true);

            expect(data).not.toHaveProperty('teamName');
            expect(data).not.toHaveProperty('legalName');
        });

        it("emits strict TEAM payload that passes isCCPartyData and lacks other party fields", async () => {
            const form = initialiseCanonicalPartyForm({
                generation: "V2",
                party: { schemaVersion: 2, partyType: "TEAM", teamName: "Alpha" } as any,
                legacy: {}, diagnostics: []
            });
            const res = buildCCPartyDataFromForm(form);
            expect(res.isValid).toBe(true);
            const data = res.data as any;

            const { isCCPartyData } = await import('@/lib/master-data/party-v2/CCPartyData');
            expect(isCCPartyData(data)).toBe(true);

            expect(data).not.toHaveProperty('forenames');
            expect(data).not.toHaveProperty('legalName');
        });

        it("emits strict ORGANISATION payload that passes isCCPartyData and lacks other party fields", async () => {
            const form = initialiseCanonicalPartyForm({
                generation: "V2",
                party: { schemaVersion: 2, partyType: "ORGANISATION", legalName: "Corp" } as any,
                legacy: {}, diagnostics: []
            });
            const res = buildCCPartyDataFromForm(form);
            expect(res.isValid).toBe(true);
            const data = res.data as any;

            const { isCCPartyData } = await import('@/lib/master-data/party-v2/CCPartyData');
            expect(isCCPartyData(data)).toBe(true);

            expect(data).not.toHaveProperty('forenames');
            expect(data).not.toHaveProperty('teamName');
        });
    });
});
