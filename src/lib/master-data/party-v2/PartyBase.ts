export interface PartyPhone {
    type: 'LANDLINE' | 'MOBILE' | 'OTHER';
    number: string;
}

export interface PartyRole {
    roleTitle: string | null;
    roleType: string | null;
    company: {
        onProCompanyId: string | null;
        externalId: string | null;
        externalIdScheme: string | null;
        name: string | null;
    } | null;
    isActiveRole: boolean | null;
    appointedOn: string | null;
    resignedOn: string | null;
    natureOfControl: string[];
    correspondenceAddressRef?: PartyAddressRef | null;
}

export interface PartyIdentifier {
    scheme: string;
    value: string;
}

export interface PartialDate {
    year: number | null;
    month: number | null;
    day: number | null;
}

export interface PartyAddressRef {
    ccAddressId: string;
}

export interface PartyBase {
    schemaVersion: 2;
    partyType: 'INDIVIDUAL' | 'TEAM' | 'ORGANISATION';
    knownAs: string | null;
    emails: string[];
    phones: PartyPhone[];
    roles: PartyRole[];
    sourceIdentifiers: PartyIdentifier[];
    isActiveParty: boolean | null;
    visibility: {
        scope: 'CLIENT_LE';
    };
}
