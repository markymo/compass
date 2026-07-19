import { CCPartyData, isCCPartyData } from './CCPartyData';
import { PartyBase, PartyPhone, PartyRole, PartyIdentifier } from './PartyBase';
import { IndividualPartyData } from './IndividualPartyData';
import { TeamPartyData } from './TeamPartyData';
import { OrganisationPartyData } from './OrganisationPartyData';
import { PartyValue, isPartyValue } from '../party-value';
import { AddressValue } from '../address-value';

export type PartyNormalisationDiagnostic = {
    type: 'INFO' | 'WARN' | 'ERROR';
    code: string;
    message: string;
    path?: string;
};

export type NormalisedPartyReadModel = {
    generation: "LEGACY" | "V2";
    party: CCPartyData;
    legacy: {
        embeddedHomeAddress?: AddressValue | null;
        embeddedCorrespondenceAddress?: AddressValue | null;
        roleEmbeddedAddresses?: Array<{
            roleIndex: number;
            address: AddressValue;
        }>;
    };
    diagnostics: PartyNormalisationDiagnostic[];
};

export function normaliseCCPartyData(source: any): NormalisedPartyReadModel | null {
    if (!source || typeof source !== 'object') {
        return null;
    }

    // Clone source to prevent mutation
    const src = JSON.parse(JSON.stringify(source));
    const diagnostics: PartyNormalisationDiagnostic[] = [];

    // V2 FAST PATH
    if (isCCPartyData(src)) {
        return {
            generation: "V2",
            party: src,
            legacy: {},
            diagnostics
        };
    }

    // LEGACY ADAPTATION
    // Allow partial shapes that have at least some name fields, since legacy DB records might lack contactType
    if (!isPartyValue(src) && !src.organisationName && !src.legalName && !src.displayName && !src.companyName && !src.name && !src.forenames && !src.firstName && !src.surname && !src.lastName) {
        diagnostics.push({
            type: 'ERROR',
            code: 'UNSUPPORTED_SHAPE',
            message: 'Input is neither valid V2 nor valid legacy PartyValue.'
        });
        return null; // Must not invent a valid party
    }

    const legacyVal = src as any;

    // Normalise basic arrays and fields
    const emails: string[] = [];
    if (legacyVal.email && typeof legacyVal.email === 'string' && legacyVal.email.trim() !== '') {
        emails.push(legacyVal.email.trim());
        diagnostics.push({ type: 'INFO', code: 'EMAIL_CONVERTED_TO_ARRAY', message: 'Legacy single email converted to emails array.' });
    }

    const phones: PartyPhone[] = Array.isArray(legacyVal.phones) ? legacyVal.phones.filter((p: any) => p && p.number) : [];
    const sourceIdentifiers: PartyIdentifier[] = Array.isArray(legacyVal.sourceIdentifiers) ? legacyVal.sourceIdentifiers.filter((s: any) => s && s.scheme && s.value) : [];
    
    // Normalise roles
    const roles: PartyRole[] = [];
    if (Array.isArray(legacyVal.roles)) {
        legacyVal.roles.forEach((r: any) => {
            if (r) {
                roles.push({
                    roleTitle: r.roleTitle ?? null,
                    roleType: r.roleType ?? null,
                    company: r.company ? {
                        onProCompanyId: r.company.onProCompanyId ?? null,
                        externalId: r.company.externalId ?? null,
                        externalIdScheme: r.company.externalIdScheme ?? null,
                        name: r.company.name ?? null
                    } : null,
                    isActiveRole: r.isActiveRole ?? null,
                    appointedOn: r.appointedOn ?? null,
                    resignedOn: r.resignedOn ?? null,
                    natureOfControl: Array.isArray(r.natureOfControl) ? r.natureOfControl : []
                });
            }
        });
    }

    // Determine derived partyType
    let derivedType = legacyVal.partyType;
    if (!source.partyType) {
        if (legacyVal.organisationName || legacyVal.companyName || legacyVal.legalName) derivedType = 'ORGANISATION';
        else if (legacyVal.contactType === 'PERSON') derivedType = 'INDIVIDUAL';
        else if (legacyVal.contactType === 'CONTACT') derivedType = 'INDIVIDUAL';
        else derivedType = 'UNKNOWN';
        diagnostics.push({ type: 'INFO', code: 'INFERRED_PARTY_TYPE', message: `Inferred partyType ${derivedType} from context` });
    }

    const baseParty = {
        schemaVersion: 2 as const,
        knownAs: null, // Legacy doesn't have knownAs, leave null
        emails,
        phones,
        roles,
        sourceIdentifiers,
        isActiveParty: legacyVal.isActiveParty ?? null
    };

    const legacyInfo: NormalisedPartyReadModel['legacy'] = {};
    if (legacyVal.correspondenceAddress) {
        legacyInfo.embeddedCorrespondenceAddress = legacyVal.correspondenceAddress;
        diagnostics.push({ type: 'INFO', code: 'LEGACY_ADDRESS_RETAINED', message: 'Embedded correspondence address retained as legacy.' });
    }

    let party: CCPartyData | null = null;

    if (derivedType === 'ORGANISATION') {
        const legalName = legacyVal.organisationName || legacyVal.displayName || (legacyVal as any).companyName || (legacyVal as any).name || '';
        
        if (legalName.trim() === '') {
            diagnostics.push({ type: 'ERROR', code: 'MISSING_LEGAL_NAME', message: 'Organisation has no legal name.' });
            return null;
        }

        party = {
            ...baseParty,
            partyType: 'ORGANISATION',
            legalName: legalName,
            registeredAddressRef: null,
            incorporatedIn: null,
            registrationNumber: null,
            governingLaw: null,
            legalForm: null
        } as OrganisationPartyData;
    } else if ((derivedType as string) === 'TEAM') {
        // Since legacy didn't explicitly model TEAM as a top-level typed entity,
        // we extract whatever looks like the team name
        const teamName = legacyVal.organisationName || legacyVal.displayName || '';
        
        if (teamName.trim() === '') {
            diagnostics.push({ type: 'ERROR', code: 'MISSING_TEAM_NAME', message: 'Team has no team name.' });
            return null;
        }

        party = {
            ...baseParty,
            partyType: 'TEAM',
            teamName: teamName,
            location: null,
            correspondenceAddressRef: null
        } as TeamPartyData;
    } else {
        // Treat INDIVIDUAL or UNKNOWN as Individual
        const hasForenames = typeof legacyVal.forenames === 'string' && legacyVal.forenames.trim().length > 0;
        const hasSurname = typeof legacyVal.surname === 'string' && legacyVal.surname.trim().length > 0;
        
        // Legacy fallback extraction for non-standard UI outputs
        const altFirstName = (legacyVal as any).firstName;
        const altLastName = (legacyVal as any).lastName;
        const resolvedForenames = hasForenames ? legacyVal.forenames : (typeof altFirstName === 'string' && altFirstName.trim().length > 0 ? altFirstName : null);
        const resolvedSurname = hasSurname ? legacyVal.surname : (typeof altLastName === 'string' && altLastName.trim().length > 0 ? altLastName : null);

        if (!resolvedForenames && !resolvedSurname) {
            diagnostics.push({ type: 'ERROR', code: 'MISSING_FORMAL_NAME', message: 'Individual lacks adequate formal name (forenames or surname required).' });
            return null;
        }

        party = {
            ...baseParty,
            partyType: 'INDIVIDUAL',
            title: legacyVal.title ?? null,
            forenames: resolvedForenames,
            surname: resolvedSurname,
            homeAddressRef: null,
            nationality: Array.isArray(legacyVal.nationality) ? legacyVal.nationality : [],
            placeOfBirth: legacyVal.placeOfBirth ?? null,
            dateOfBirth: legacyVal.dateOfBirth ? {
                year: legacyVal.dateOfBirth.year ?? null,
                month: legacyVal.dateOfBirth.month ?? null,
                day: legacyVal.dateOfBirth.day ?? null
            } : null
        } as IndividualPartyData;
    }

    if (!party) {
        return null;
    }

    return {
        generation: "LEGACY",
        party,
        legacy: legacyInfo,
        diagnostics
    };
}
