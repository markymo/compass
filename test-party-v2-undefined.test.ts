import { describe, it, expect } from "vitest";
import { isCCPartyData } from "./src/lib/master-data/party-v2/CCPartyData";

describe("isCCPartyData", () => {
    it("should fail when arrays are undefined", () => {
        const payload = {
            schemaVersion: 2,
            partyType: "ORGANISATION",
            // emails: [],
            phones: [],
            roles: [],
            sourceIdentifiers: [],
            legalName: "ACME Corp"
        };
        expect(isCCPartyData(payload)).toBe(false);
    });
});
