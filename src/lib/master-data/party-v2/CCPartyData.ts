import { IndividualPartyData, isIndividualPartyData } from './IndividualPartyData';
import { TeamPartyData, isTeamPartyData } from './TeamPartyData';
import { OrganisationPartyData, isOrganisationPartyData } from './OrganisationPartyData';

export type CCPartyData = IndividualPartyData | TeamPartyData | OrganisationPartyData;
export type V2PartyType = CCPartyData['partyType'];

export function isCCPartyData(value: any): value is CCPartyData {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        console.error("isCCPartyData: value is not an object", typeof value);
        return false;
    }
    
    // Check shared requirements
    if (value.schemaVersion !== 2) {
        console.error("isCCPartyData: invalid schemaVersion", value.schemaVersion);
        return false;
    }
    if (!Array.isArray(value.emails)) {
        console.error("isCCPartyData: emails is not an array", value.emails);
        return false;
    }
    if (!Array.isArray(value.phones)) {
        console.error("isCCPartyData: phones is not an array", value.phones);
        return false;
    }
    if (!Array.isArray(value.roles)) {
        console.error("isCCPartyData: roles is not an array", value.roles);
        return false;
    }
    if (!Array.isArray(value.sourceIdentifiers)) {
        console.error("isCCPartyData: sourceIdentifiers is not an array", value.sourceIdentifiers);
        return false;
    }

    // Let subtype validators handle specific logic
    if (value.partyType === 'INDIVIDUAL') {
        const ok = isIndividualPartyData(value);
        if (!ok) console.error("isCCPartyData: isIndividualPartyData failed", JSON.stringify(value));
        return ok;
    }
    if (value.partyType === 'TEAM') {
        const ok = isTeamPartyData(value);
        if (!ok) console.error("isCCPartyData: isTeamPartyData failed", JSON.stringify(value));
        return ok;
    }
    if (value.partyType === 'ORGANISATION') {
        const ok = isOrganisationPartyData(value);
        if (!ok) console.error("isCCPartyData: isOrganisationPartyData failed", JSON.stringify(value));
        return ok;
    }

    console.error("isCCPartyData: invalid partyType", value.partyType);
    return false;
}
