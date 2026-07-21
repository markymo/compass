import { isCCPartyData } from "./src/lib/master-data/party-v2/CCPartyData";

const payload = {
    schemaVersion: 2,
    partyType: "ORGANISATION",
    emails: [],
    phones: [],
    roles: [],
    sourceIdentifiers: [],
    legalName: "ACME Corp"
};

console.log("Is valid?", isCCPartyData(payload));
