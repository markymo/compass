import { PartyBase, PartyAddressRef } from './PartyBase';

export interface OrganisationPartyData extends PartyBase {
    partyType: 'ORGANISATION';

    // Identity
    legalName: string;

    // Contact
    registeredAddressRef: PartyAddressRef | null;

    // Incorporation
    incorporatedIn: string | null;
    registrationNumber: string | null;
    governingLaw: string | null;
    legalForm: string | null;
}

export function isOrganisationPartyData(value: any): value is OrganisationPartyData {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    if (value.schemaVersion !== 2 || value.partyType !== 'ORGANISATION') return false;

    if (typeof value.legalName !== 'string' || value.legalName.trim().length === 0) return false;

    return true;
}
