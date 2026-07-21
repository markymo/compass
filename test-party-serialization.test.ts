import { describe, it, expect } from "vitest";
import { isCCPartyData } from "./src/lib/master-data/party-v2/CCPartyData";

describe("isCCPartyData Next.js simulation", () => {
    it("simulates stripped undefineds", () => {
        const rawCandidate = {
            schemaVersion: 2,
            partyType: "INDIVIDUAL",
            knownAs: undefined,
            isActiveParty: undefined,
            emails: [],
            phones: [],
            sourceIdentifiers: [],
            roles: [],
            correspondenceAddressRef: undefined,
            title: undefined,
            forenames: "John",
            surname: undefined,
            nationality: undefined,
            placeOfBirth: undefined,
            dateOfBirth: undefined,
            homeAddressRef: undefined
        };

        // Simulate Next.js JSON serialization (strips undefined)
        const serialized = JSON.parse(JSON.stringify(rawCandidate));

        expect(isCCPartyData(serialized)).toBe(true);
    });
});
