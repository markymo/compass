import { PartyBase, PartyAddressRef } from './PartyBase';

export interface TeamPartyData extends PartyBase {
    partyType: 'TEAM';

    // Identity
    teamName: string;

    // Contact
    location: string | null;
    correspondenceAddressRef: PartyAddressRef | null;
}

export function isTeamPartyData(value: any): value is TeamPartyData {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    if (value.schemaVersion !== 2 || value.partyType !== 'TEAM') return false;

    if (typeof value.teamName !== 'string' || value.teamName.trim().length === 0) return false;

    return true;
}
