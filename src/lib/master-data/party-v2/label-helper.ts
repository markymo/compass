import { NormalisedPartyReadModel } from './normaliser';
import { isIndividualPartyData, IndividualPartyData } from './IndividualPartyData';
import { isTeamPartyData, TeamPartyData } from './TeamPartyData';
import { isOrganisationPartyData, OrganisationPartyData } from './OrganisationPartyData';

export function getPartyLabel(normalised: NormalisedPartyReadModel): string {
    const party = normalised.party;

    if (party.partyType === 'INDIVIDUAL') {
        return getIndividualLabel(party as IndividualPartyData);
    }
    
    if (party.partyType === 'TEAM') {
        return getTeamLabel(party as TeamPartyData);
    }
    
    if (party.partyType === 'ORGANISATION') {
        return getOrganisationLabel(party as OrganisationPartyData);
    }

    return "Unnamed party";
}

function getIndividualLabel(party: IndividualPartyData): string {
    const hasForenames = typeof party.forenames === 'string' && party.forenames.trim() !== '';
    const hasSurname = typeof party.surname === 'string' && party.surname.trim() !== '';
    const hasKnownAs = typeof party.knownAs === 'string' && party.knownAs.trim() !== '';

    if (hasForenames && hasSurname) {
        return `${party.forenames!.trim()} ${party.surname!.trim()}`;
    }

    if (hasSurname) {
        return party.surname!.trim();
    }

    if (hasForenames) {
        return party.forenames!.trim();
    }

    if (hasKnownAs) {
        return party.knownAs!.trim();
    }

    return "Unnamed individual";
}

function getTeamLabel(party: TeamPartyData): string {
    if (typeof party.teamName === 'string' && party.teamName.trim() !== '') {
        return party.teamName.trim();
    }

    if (typeof party.knownAs === 'string' && party.knownAs.trim() !== '') {
        return party.knownAs.trim();
    }

    return "Unnamed team";
}

function getOrganisationLabel(party: OrganisationPartyData): string {
    if (typeof party.legalName === 'string' && party.legalName.trim() !== '') {
        return party.legalName.trim();
    }

    if (typeof party.knownAs === 'string' && party.knownAs.trim() !== '') {
        return party.knownAs.trim();
    }

    return "Unnamed organisation";
}
