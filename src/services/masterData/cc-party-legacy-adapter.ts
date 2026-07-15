import { CCPartyData, IndividualPartyData, TeamPartyData, OrganisationPartyData, PartyPhone, PartyRole, PartyIdentifier } from "@/lib/master-data/party-v2";

/**
 * Converts a legacy PartyValue manually emitted by the UI into a canonical v2 CCPartyData.
 * Intentionally omits passively round-tripped legacy embedded addresses (natural upgrade behaviour).
 */
export function convertLegacyManualPartyToV2(legacyVal: any): CCPartyData {
    const base = {
        schemaVersion: 2 as const,
        isActiveParty: legacyVal.isActivePersonOrContact ?? true,
        knownAs: legacyVal.displayName || null,
        emails: legacyVal.email ? [legacyVal.email] : [],
        phones: convertPhones(legacyVal.phones),
        roles: convertRoles(legacyVal.roles),
        sourceIdentifiers: convertSourceIdentifiers(legacyVal.sourceIdentifiers)
    };

    const type = legacyVal.partyType || "INDIVIDUAL";

    if (type === "ORGANISATION") {
        const org: OrganisationPartyData = {
            ...base,
            partyType: "ORGANISATION",
            legalName: legacyVal.organisationName || legacyVal.displayName || "Unknown Organisation",
            registeredAddressRef: extractStringRef(legacyVal.registeredAddressRef),
            incorporatedIn: null,
            registrationNumber: null,
            governingLaw: null,
            legalForm: null
        };
        return org;
    }

    if (type === "TEAM") {
        const team: TeamPartyData = {
            ...base,
            partyType: "TEAM",
            teamName: legacyVal.displayName || legacyVal.organisationName || "Unknown Team",
            location: null,
            correspondenceAddressRef: extractStringRef(legacyVal.correspondenceAddressRef)
        };
        return team;
    }

    // Default to INDIVIDUAL
    const ind: IndividualPartyData = {
        ...base,
        partyType: "INDIVIDUAL",
        title: legacyVal.title || null,
        forenames: legacyVal.forenames || null,
        surname: legacyVal.surname || null,
        nationality: legacyVal.nationality || [],
        dateOfBirth: legacyVal.dateOfBirth || null,
        placeOfBirth: legacyVal.placeOfBirth || null,
        homeAddressRef: extractStringRef(legacyVal.homeAddressRef)
    };
    return ind;
}

function convertPhones(phones: any[] | null | undefined): PartyPhone[] {
    if (!Array.isArray(phones)) return [];
    return phones.map(p => ({
        type: p.type === 'MOBILE' || p.type === 'LANDLINE' ? p.type : 'OTHER',
        number: p.number || ''
    }));
}

function convertRoles(roles: any[] | null | undefined): PartyRole[] {
    if (!Array.isArray(roles)) return [];
    return roles.map(r => ({
        roleType: r.roleType || null,
        roleTitle: r.roleTitle || null,
        company: r.company ? {
            onProCompanyId: r.company.onProCompanyId || null,
            externalId: r.company.externalId || null,
            externalIdScheme: r.company.externalIdScheme || null,
            name: r.company.name || null
        } : null,
        isActiveRole: r.isActiveRole ?? true,
        appointedOn: r.appointedOn || null,
        resignedOn: r.resignedOn || null,
        natureOfControl: r.natureOfControl || [],
        correspondenceAddressRef: extractStringRef(r.correspondenceAddressRef)
    }));
}

function convertSourceIdentifiers(identifiers: any[] | null | undefined): PartyIdentifier[] {
    if (!Array.isArray(identifiers)) return [];
    return identifiers.map(si => ({
        scheme: si.scheme || '',
        value: si.value || ''
    }));
}

function extractStringRef(val: any): { ccAddressId: string } | null {
    if (typeof val === 'string' && val.trim() !== '') {
        return { ccAddressId: val };
    }
    return null;
}
