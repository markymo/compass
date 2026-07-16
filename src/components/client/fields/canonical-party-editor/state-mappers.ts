import { CCPartyData } from "@/lib/master-data/party-v2/CCPartyData";
import { NormalisedPartyReadModel } from "@/lib/master-data/party-v2/normaliser";
import { PartyIdentifier } from "@/lib/master-data/party-v2/PartyBase";
import { IndividualPartyData } from "@/lib/master-data/party-v2/IndividualPartyData";
import { OrganisationPartyData } from "@/lib/master-data/party-v2/OrganisationPartyData";
import { TeamPartyData } from "@/lib/master-data/party-v2/TeamPartyData";

export type CanonicalPartyFormState = {
    // Editable Core
    partyType: 'INDIVIDUAL' | 'TEAM' | 'ORGANISATION';
    knownAs: string | null;
    isActiveParty: boolean | null; // Tri-state: Active, Inactive, Not Specified
    
    // Dynamic Identity
    identity: {
        title: string | null;
        forenames: string | null;
        surname: string | null;
        legalName: string | null;
        teamName: string | null;
        location: string | null;
        nationality: string[];
        placeOfBirth: string | null;
        dateOfBirth: { year: string; month: string; day: string };
    };

    // Arrays
    emails: Array<{ rowId: string; value: string }>;
    phones: Array<{ rowId: string; type: string; number: string }>;

    // Roles
    roles: Array<{
        rowId: string;
        // Editable
        roleType: string | null;
        roleTitle: string | null;
        isActiveRole: boolean | null;
        appointedOn: string | null;
        resignedOn: string | null;
        company: { name: string | null; externalId: string | null; externalIdScheme: string | null; onProCompanyId: string | null };
        // Preserved Canonical
        natureOfControl: string[]; 
        correspondenceAddressRef: { ccAddressId: string } | null;
        // Diagnostics
        legacyEmbeddedAddressDiagnostic: string | null;
        legacyEmbeddedAddressRaw: any | null;
    }>;

    // Top-Level Preserved Canonical
    sourceIdentifiers: PartyIdentifier[];
    homeAddressRef: { ccAddressId: string } | null;
    registeredAddressRef: { ccAddressId: string } | null;
    correspondenceAddressRef: { ccAddressId: string } | null;

    // Top-Level Diagnostics
    legacyTopLevelAddressDiagnostics: string[];
};

export type EditorSubmissionCandidate = {
    isValid: boolean;
    data: CCPartyData | null;
    destructiveOmissions: Array<{
        level: 'TOP_LEVEL' | 'ROLE_LEVEL';
        addressRole: string;
        roleRowId?: string;
        displayValue: string;
        rawAddress: any;
    }>;
};

function generateRowId() {
    return crypto.randomUUID();
}

export function initialiseCanonicalPartyForm(
    readModel: NormalisedPartyReadModel
): CanonicalPartyFormState {
    const party = readModel.party;
    const isIndiv = party.partyType === 'INDIVIDUAL';
    const isTeam = party.partyType === 'TEAM';
    const isOrg = party.partyType === 'ORGANISATION';

    const indiv = party as IndividualPartyData;
    const org = party as OrganisationPartyData;
    const team = party as TeamPartyData;

    const legacy = readModel.legacy || {};
    const legacyTopLevelAddressDiagnostics: string[] = [];
    
    if (legacy.embeddedHomeAddress) {
        legacyTopLevelAddressDiagnostics.push("homeAddress");
    }
    if (legacy.embeddedCorrespondenceAddress) {
        legacyTopLevelAddressDiagnostics.push("correspondenceAddress");
    }

    const roles = (party.roles || []).map((r, index) => {
        const roleEmbedded = legacy.roleEmbeddedAddresses?.find(rEA => rEA.roleIndex === index);
        return {
            rowId: generateRowId(),
            roleType: r.roleType ?? null,
            roleTitle: r.roleTitle ?? null,
            isActiveRole: r.isActiveRole ?? null,
            appointedOn: r.appointedOn ?? null,
            resignedOn: r.resignedOn ?? null,
            company: {
                name: r.company?.name ?? null,
                externalId: r.company?.externalId ?? null,
                externalIdScheme: r.company?.externalIdScheme ?? null,
                onProCompanyId: r.company?.onProCompanyId ?? null
            },
            natureOfControl: r.natureOfControl ? [...r.natureOfControl] : [],
            correspondenceAddressRef: r.correspondenceAddressRef ? { ...r.correspondenceAddressRef } : null,
            legacyEmbeddedAddressDiagnostic: roleEmbedded ? "correspondenceAddress" : null,
            legacyEmbeddedAddressRaw: roleEmbedded ? roleEmbedded.address : null
        };
    });

    return {
        partyType: party.partyType,
        knownAs: party.knownAs ?? null,
        isActiveParty: party.isActiveParty ?? null,
        
        identity: {
            title: isIndiv ? (indiv.title ?? null) : null,
            forenames: isIndiv ? (indiv.forenames ?? null) : null,
            surname: isIndiv ? (indiv.surname ?? null) : null,
            legalName: isOrg ? (org.legalName ?? null) : null,
            teamName: isTeam ? (team.teamName ?? null) : null,
            location: isTeam ? (team.location ?? null) : null,
            nationality: isIndiv && indiv.nationality ? [...indiv.nationality] : [],
            placeOfBirth: isIndiv ? (indiv.placeOfBirth ?? null) : null,
            dateOfBirth: {
                year: isIndiv && indiv.dateOfBirth?.year ? indiv.dateOfBirth.year.toString() : "",
                month: isIndiv && indiv.dateOfBirth?.month ? indiv.dateOfBirth.month.toString() : "",
                day: isIndiv && indiv.dateOfBirth?.day ? indiv.dateOfBirth.day.toString() : ""
            }
        },

        emails: (party.emails || []).map(e => ({ rowId: generateRowId(), value: e })),
        phones: (party.phones || []).map(p => ({ rowId: generateRowId(), type: p.type, number: p.number })),
        roles,

        sourceIdentifiers: party.sourceIdentifiers ? JSON.parse(JSON.stringify(party.sourceIdentifiers)) : [],
        
        homeAddressRef: isIndiv && indiv.homeAddressRef ? { ...indiv.homeAddressRef } : null,
        registeredAddressRef: isOrg && org.registeredAddressRef ? { ...org.registeredAddressRef } : null,
        correspondenceAddressRef: isTeam && (party as any).correspondenceAddressRef ? { ...(party as any).correspondenceAddressRef } : null,

        legacyTopLevelAddressDiagnostics
    };
}

function isValidPartialDate(year: string, month: string, day: string) {
    if (!year && !month && !day) return true;
    const y = year ? parseInt(year, 10) : null;
    const m = month ? parseInt(month, 10) : null;
    const d = day ? parseInt(day, 10) : null;
    
    if (m !== null && (m < 1 || m > 12)) return false;
    if (d !== null && (d < 1 || d > 31)) return false;
    
    if (y !== null && m !== null && d !== null) {
        const date = new Date(y, m - 1, d);
        if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
            return false;
        }
    }
    return true;
}

export function buildCCPartyDataFromForm(formState: CanonicalPartyFormState, originalReadModel?: NormalisedPartyReadModel): EditorSubmissionCandidate {
    let isValid = true;
    
    if (formState.partyType === 'INDIVIDUAL') {
        if (!formState.identity.forenames && !formState.identity.surname) isValid = false;
    } else if (formState.partyType === 'TEAM') {
        if (!formState.identity.teamName) isValid = false;
    } else if (formState.partyType === 'ORGANISATION') {
        if (!formState.identity.legalName) isValid = false;
    }

    if (!isValidPartialDate(formState.identity.dateOfBirth.year, formState.identity.dateOfBirth.month, formState.identity.dateOfBirth.day)) {
        isValid = false;
    }

    const baseData: any = {
        schemaVersion: 2,
        partyType: formState.partyType,
        knownAs: formState.knownAs || undefined,
        isActiveParty: formState.isActiveParty ?? undefined,
        emails: formState.emails.map(e => e.value).filter(v => v.trim() !== ""),
        phones: formState.phones.filter(p => p.number.trim() !== "").map(p => ({ type: p.type, number: p.number })),
        sourceIdentifiers: formState.sourceIdentifiers,
        correspondenceAddressRef: formState.correspondenceAddressRef || undefined,
        roles: formState.roles.map(r => {
            const isCompanyEmpty = !r.company.name && !r.company.externalId && !r.company.externalIdScheme && !r.company.onProCompanyId;
            return {
                roleType: r.roleType || undefined,
                roleTitle: r.roleTitle || undefined,
                isActiveRole: r.isActiveRole ?? undefined,
                appointedOn: r.appointedOn || undefined,
                resignedOn: r.resignedOn || undefined,
                company: isCompanyEmpty ? undefined : {
                    name: r.company.name || undefined,
                    externalId: r.company.externalId || undefined,
                    externalIdScheme: r.company.externalIdScheme || undefined,
                    onProCompanyId: r.company.onProCompanyId || undefined
                },
                natureOfControl: r.natureOfControl.length > 0 ? r.natureOfControl : undefined,
                correspondenceAddressRef: r.correspondenceAddressRef || undefined
            };
        })
    };

    // Emails, phones, and roles are strictly required as arrays by isCCPartyData

    let finalData: CCPartyData | null = null;

    let dob: { year?: number, month?: number, day?: number } | undefined = undefined;
    if (formState.partyType === 'INDIVIDUAL') {
        const yStr = formState.identity.dateOfBirth.year.trim();
        const mStr = formState.identity.dateOfBirth.month.trim();
        const dStr = formState.identity.dateOfBirth.day.trim();
        
        if (yStr || mStr || dStr) {
            const y = yStr ? parseInt(yStr, 10) : NaN;
            const m = mStr ? parseInt(mStr, 10) : NaN;
            const d = dStr ? parseInt(dStr, 10) : NaN;

            let valid = true;
            if (dStr && (!mStr || !yStr)) valid = false; // Cannot have day without month and year
            else if (mStr && !yStr) valid = false; // Cannot have month without year
            else if (yStr && isNaN(y)) valid = false;
            else if (mStr && (isNaN(m) || m < 1 || m > 12)) valid = false;
            else if (dStr && (isNaN(d) || d < 1)) valid = false;
            else if (dStr && mStr && yStr) {
                const daysInMonth = new Date(y, m, 0).getDate();
                if (d > daysInMonth) valid = false;
            }

            if (!valid) {
                return { isValid: false, data: null, destructiveOmissions: [] };
            }

            dob = {
                year: yStr ? y : undefined,
                month: mStr ? m : undefined,
                day: dStr ? d : undefined
            };
        }
    }

    if (formState.partyType === 'INDIVIDUAL') {
        finalData = {
            ...baseData,
            title: formState.identity.title || undefined,
            forenames: formState.identity.forenames || undefined,
            surname: formState.identity.surname || undefined,
            nationality: formState.identity.nationality.length > 0 ? formState.identity.nationality : undefined,
            placeOfBirth: formState.identity.placeOfBirth || undefined,
            dateOfBirth: dob,
            homeAddressRef: formState.homeAddressRef || undefined
        } as IndividualPartyData;
    } else if (formState.partyType === 'TEAM') {
        finalData = {
            ...baseData,
            teamName: formState.identity.teamName || undefined,
            location: formState.identity.location || undefined
        } as TeamPartyData;
    } else if (formState.partyType === 'ORGANISATION') {
        finalData = {
            ...baseData,
            legalName: formState.identity.legalName || undefined,
            registeredAddressRef: formState.registeredAddressRef || undefined
        } as OrganisationPartyData;
    }

    const destructiveOmissions: EditorSubmissionCandidate['destructiveOmissions'] = [];
    if (originalReadModel && originalReadModel.legacy) {
        if (originalReadModel.legacy.embeddedHomeAddress) {
            destructiveOmissions.push({
                level: 'TOP_LEVEL',
                addressRole: 'homeAddress',
                displayValue: 'Home Address',
                rawAddress: originalReadModel.legacy.embeddedHomeAddress
            });
        }
        if (originalReadModel.legacy.embeddedCorrespondenceAddress) {
            destructiveOmissions.push({
                level: 'TOP_LEVEL',
                addressRole: 'correspondenceAddress',
                displayValue: 'Correspondence Address',
                rawAddress: originalReadModel.legacy.embeddedCorrespondenceAddress
            });
        }
    }
    
    formState.roles.forEach((formRole) => {
        if (formRole.legacyEmbeddedAddressDiagnostic && formRole.legacyEmbeddedAddressRaw) {
            destructiveOmissions.push({
                level: 'ROLE_LEVEL',
                addressRole: formRole.legacyEmbeddedAddressDiagnostic,
                roleRowId: formRole.rowId,
                displayValue: 'Role Address',
                rawAddress: formRole.legacyEmbeddedAddressRaw
            });
        }
    });

    return {
        isValid,
        data: isValid ? finalData : null,
        destructiveOmissions
    };
}
