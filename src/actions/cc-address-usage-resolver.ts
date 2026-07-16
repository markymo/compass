import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { normaliseCCPartyData } from "@/lib/master-data/party-v2/normaliser";
import { getPartyLabel } from "@/lib/master-data/party-v2/label-helper";
import { getMasterFieldDefinition } from "@/services/masterData/definitionService";

export type CCAddressPartyUsage = {
  ccPartyId: string;
  partyLabel: string;
  partyType: "INDIVIDUAL" | "TEAM" | "ORGANISATION";
  usageKind: "HOME_ADDRESS" | "REGISTERED_ADDRESS" | "CORRESPONDENCE_ADDRESS" | "ROLE_CORRESPONDENCE_ADDRESS";
  roleId?: string;
  roleTitle?: string | null;
  roleCompanyName?: string | null;
};

export type CCAddressFieldUsage = {
  fieldNo: number;
  fieldName: string;
};

export type CCAddressUsageSummary = {
  ccAddressId: string;
  partyUsages: CCAddressPartyUsage[];
  fieldUsages: CCAddressFieldUsage[];
};

function extractIds(value: any, idKey: string, foundIds: Set<string> = new Set()): Set<string> {
    if (!value) return foundIds;
    let parsedValue = value;
    if (typeof value === 'string') {
        if (value.startsWith('{') || value.startsWith('[')) {
            try { parsedValue = JSON.parse(value); } catch (e) { return foundIds; }
        } else {
            return foundIds;
        }
    }
    if (typeof parsedValue !== 'object' || parsedValue === null) return foundIds;
    if (Array.isArray(parsedValue)) {
        for (const v of parsedValue) extractIds(v, idKey, foundIds);
        return foundIds;
    }
    if (typeof parsedValue[idKey] === 'string') {
        foundIds.add(parsedValue[idKey]);
    }
    for (const key of Object.keys(parsedValue)) {
        if (typeof parsedValue[key] === 'object' && parsedValue[key] !== null) {
            extractIds(parsedValue[key], idKey, foundIds);
        }
    }
    return foundIds;
}

export async function resolveCCAddressUsages(
    clientLEId: string, 
    addressIds?: string[]
): Promise<Record<string, CCAddressUsageSummary>> {
    if (addressIds && addressIds.length > 0) {
        const addresses = await prisma.cCAddress.findMany({
            where: { id: { in: addressIds } },
            select: { id: true, clientLEId: true }
        });
        const mismatched = addresses.filter((a: any) => a.clientLEId !== clientLEId);
        if (mismatched.length > 0) {
            throw new Error(`Address access denied or scope mismatch for addresses: ${mismatched.map((m: any) => m.id).join(', ')}`);
        }
    }

    const summaryMap: Record<string, CCAddressUsageSummary> = {};
    if (addressIds) {
        for (const addrId of addressIds) {
            summaryMap[addrId] = { ccAddressId: addrId, partyUsages: [], fieldUsages: [] };
        }
    }
    const getSummary = (addrId: string) => {
        if (!summaryMap[addrId]) {
            summaryMap[addrId] = { ccAddressId: addrId, partyUsages: [], fieldUsages: [] };
        }
        return summaryMap[addrId];
    };

    const fieldWhere: any = { valueJson: { not: Prisma.AnyNull }, claimRole: 'VALUE' };
    const claims = await prisma.fieldClaim.findMany({
        where: fieldWhere,
        select: { fieldNo: true, valueJson: true, clientLeScopeId: true }
    });
    
    const clientClaims = claims.filter((c: any) => c.clientLeScopeId === clientLEId);

    const defMap = new Map<number, string>();
    for (const claim of clientClaims) {
        const value = claim.valueJson as any;
        const foundIds = extractIds(value, 'ccAddressId');
        for (const addrId of foundIds) {
            if (addressIds && !addressIds.includes(addrId)) continue;
            
            const summary = getSummary(addrId);
            if (!summary.fieldUsages.some(u => u.fieldNo === claim.fieldNo)) {
                if (!defMap.has(claim.fieldNo)) {
                    try {
                        const def = await getMasterFieldDefinition(claim.fieldNo);
                        defMap.set(claim.fieldNo, def.fieldName);
                    } catch (e) {
                        defMap.set(claim.fieldNo, `Field ${claim.fieldNo}`);
                    }
                }
                summary.fieldUsages.push({
                    fieldNo: claim.fieldNo,
                    fieldName: defMap.get(claim.fieldNo) as string
                });
            }
        }
    }

    const parties = await prisma.cCParty.findMany({
        where: { clientLEId }
    });

    for (const partyRecord of parties) {
        try {
            const parsedData = typeof partyRecord.data === 'string' ? JSON.parse(partyRecord.data) : partyRecord.data;
            const norm = normaliseCCPartyData(parsedData);
            if (!norm) {
                console.log("Failed to normalise party data:", JSON.stringify(parsedData));
                continue;
            }

            const party = norm.party;
            const partyLabel = getPartyLabel(norm);

            const addUsage = (addrId: string, usageKind: CCAddressPartyUsage['usageKind'], roleId?: string, roleTitle?: string | null, roleCompanyName?: string | null) => {
                if (addressIds && !addressIds.includes(addrId)) return;
                
                const summary = getSummary(addrId);
                const dedupKey = `${partyRecord.id}-${usageKind}-${roleId || ''}`;
                
                const isDuplicate = summary.partyUsages.some(u => 
                    u.ccPartyId === partyRecord.id && 
                    u.usageKind === usageKind && 
                    (u.roleId || '') === (roleId || '')
                );

                if (!isDuplicate) {
                    summary.partyUsages.push({
                        ccPartyId: partyRecord.id,
                        partyLabel,
                        partyType: party.partyType,
                        usageKind,
                        roleId,
                        roleTitle,
                        roleCompanyName
                    });
                }
            };

            if (party.partyType === 'INDIVIDUAL' && party.homeAddressRef) {
                addUsage(party.homeAddressRef.ccAddressId, 'HOME_ADDRESS');
            } else if (party.partyType === 'ORGANISATION' && party.registeredAddressRef) {
                addUsage(party.registeredAddressRef.ccAddressId, 'REGISTERED_ADDRESS');
            } else if (party.partyType === 'TEAM' && party.correspondenceAddressRef) {
                addUsage(party.correspondenceAddressRef.ccAddressId, 'CORRESPONDENCE_ADDRESS');
            }

            if (party.roles) {
                party.roles.forEach((role, idx) => {
                    if (role.correspondenceAddressRef) {
                        const fallbackRoleId = role.company?.externalId || `idx-${idx}`;
                        addUsage(
                            role.correspondenceAddressRef.ccAddressId, 
                            'ROLE_CORRESPONDENCE_ADDRESS', 
                            fallbackRoleId, 
                            role.roleTitle, 
                            role.company?.name
                        );
                    }
                });
            }
        } catch (error) {
            console.warn(`[resolveCCAddressUsages] Failed to resolve usage for party ${partyRecord.id}:`, error);
        }
    }

    return summaryMap;
}
