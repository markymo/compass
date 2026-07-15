import { IndividualPartyData, isIndividualPartyData } from './IndividualPartyData';
import { TeamPartyData, isTeamPartyData } from './TeamPartyData';
import { OrganisationPartyData, isOrganisationPartyData } from './OrganisationPartyData';

export type CCPartyData = IndividualPartyData | TeamPartyData | OrganisationPartyData;

export function isCCPartyData(value: any): value is CCPartyData {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    
    // Check shared requirements
    if (value.schemaVersion !== 2) return false;
    if (!Array.isArray(value.emails)) return false;
    if (!Array.isArray(value.phones)) return false;
    if (!Array.isArray(value.roles)) return false;
    if (!Array.isArray(value.sourceIdentifiers)) return false;

    // Let subtype validators handle specific logic
    if (value.partyType === 'INDIVIDUAL') return isIndividualPartyData(value);
    if (value.partyType === 'TEAM') return isTeamPartyData(value);
    if (value.partyType === 'ORGANISATION') return isOrganisationPartyData(value);

    return false;
}
