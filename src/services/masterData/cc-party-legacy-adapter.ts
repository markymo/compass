import { CCPartyData, IndividualPartyData, TeamPartyData, OrganisationPartyData, PartyPhone, PartyRole, PartyIdentifier } from "@/lib/master-data/party-v2";

/**
 * Converts a legacy PartyValue manually emitted by the UI into a canonical v2 CCPartyData.
 * Intentionally omits passively round-tripped legacy embedded addresses (natural upgrade behaviour).
 */
export function convertLegacyManualPartyToV2(
    legacyVal: any,
    context?: { clientLEId?: string; clientLEName?: string }
): CCPartyData {
    const base = {
        schemaVersion: 2 as const,
        isActiveParty: legacyVal.isActivePersonOrContact ?? true,
        knownAs: legacyVal.displayName || null,
        emails: legacyVal.email ? [legacyVal.email] : (Array.isArray(legacyVal.emails) ? legacyVal.emails : []),
        phones: convertPhones(legacyVal.phones),
        roles: convertRoles(legacyVal.roles, context),
        sourceIdentifiers: convertSourceIdentifiers(legacyVal.sourceIdentifiers)
    };

    const type = legacyVal.partyType || (legacyVal.contactType === 'CONTACT' ? "ORGANISATION" : "INDIVIDUAL");

    if (type === "ORGANISATION") {
        const org: OrganisationPartyData = {
            ...base,
            partyType: "ORGANISATION",
            legalName: legacyVal.organisationName || legacyVal.displayName || legacyVal.legalName || legacyVal.name || "Unknown Organisation",
            registeredAddressRef: extractStringRef(legacyVal.registeredAddressRef),
            incorporatedIn: legacyVal.incorporatedIn || legacyVal.identification?.country_registered || legacyVal.countryOfIncorporation || null,
            registrationNumber: legacyVal.registrationNumber || legacyVal.identification?.registration_number || legacyVal.company_number || null,
            governingLaw: legacyVal.governingLaw || null,
            legalForm: legacyVal.legalForm || legacyVal.identification?.legal_form || null
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

function convertRoles(roles: any[] | null | undefined, context?: { clientLEId?: string; clientLEName?: string }): PartyRole[] {
    if (!Array.isArray(roles)) return [];
    return roles.map(r => {
        const onProCompanyId = r.company?.onProCompanyId || context?.clientLEId || null;
        const companyName = r.company?.name || context?.clientLEName || null;
        const roleType = r.roleType || (Array.isArray(r.natureOfControl) && r.natureOfControl.length > 0 ? "PSC" : (Array.isArray(r.natures_of_control) && r.natures_of_control.length > 0 ? "PSC" : null));
        const noc = Array.isArray(r.natureOfControl) ? r.natureOfControl : (Array.isArray(r.natures_of_control) ? r.natures_of_control : []);

        return {
            roleType,
            roleTitle: r.roleTitle || null,
            company: (onProCompanyId || companyName || r.company) ? {
                onProCompanyId,
                externalId: r.company?.externalId || null,
                externalIdScheme: r.company?.externalIdScheme || null,
                name: companyName
            } : null,
            isActiveRole: r.isActiveRole ?? true,
            appointedOn: r.appointedOn || r.notified_on || null,
            resignedOn: r.resignedOn || r.ceased_on || null,
            natureOfControl: noc,
            correspondenceAddressRef: extractStringRef(r.correspondenceAddressRef)
        };
    });
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
