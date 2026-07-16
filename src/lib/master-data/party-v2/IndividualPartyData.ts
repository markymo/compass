import { PartyBase, PartyAddressRef, PartialDate } from './PartyBase';

export interface IndividualPartyData extends PartyBase {
    partyType: 'INDIVIDUAL';
    
    // Identity
    title: string | null;
    forenames: string | null;
    surname: string | null;

    // Contact
    homeAddressRef: PartyAddressRef | null;

    // Attributes
    nationality: string[];
    placeOfBirth: string | null;
    dateOfBirth: PartialDate | null;
}

export function isIndividualPartyData(value: any): value is IndividualPartyData {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    if (value.schemaVersion !== 2 || value.partyType !== 'INDIVIDUAL') return false;

    // Validate formal name (either forenames or surname must exist and be non-empty)
    const hasForenames = typeof value.forenames === 'string' && value.forenames.trim().length > 0;
    const hasSurname = typeof value.surname === 'string' && value.surname.trim().length > 0;
    
    if (!hasForenames && !hasSurname) return false;

    return true;
}
