"use server";

import { getIdentity } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { PartyValue, isPartyValue } from "@/lib/master-data/party-value";
import { revalidatePath } from "next/cache";
import { getMasterFieldDefinition } from "@/services/masterData/definitionService";

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

/**
 * Fetch all curated parties for a given clientLEId
 */
export async function getCCParties(clientLEId: string) {
    const identity = await getIdentity();
    if (!identity?.userId) {
        throw new Error("Unauthorized");
    }

    try {
        const parties = await prisma.cCParty.findMany({
            where: { clientLEId },
            orderBy: { createdAt: "desc" }
        });

        // Fetch source claims for promoted parties
        const claimIds = parties.filter((p: any) => p.createdFromClaimId).map((p: any) => p.createdFromClaimId as string);
        let claimsMap = new Map<string, any>();
        let fieldDefsMap = new Map<number, string>();

        if (claimIds.length > 0) {
            const claims = await prisma.fieldClaim.findMany({
                where: { id: { in: claimIds }, claimRole: 'VALUE' },
                select: { id: true, fieldNo: true, sourceType: true }
            });

            for (const c of claims) {
                claimsMap.set(c.id, c);
                if (!fieldDefsMap.has(c.fieldNo)) {
                    try {
                        const def = await getMasterFieldDefinition(c.fieldNo);
                        fieldDefsMap.set(c.fieldNo, def.fieldName);
                    } catch (e) {
                        fieldDefsMap.set(c.fieldNo, `Field ${c.fieldNo}`);
                    }
                }
            }
        }

        const formatSourceLabel = (sourceType: string) => {
            switch (sourceType) {
                case "COMPANY_REGISTRY": return "Companies House";
                case "GLEIF": return "GLEIF";
                case "USER_INPUT": return "User Input";
                default: return sourceType || "System";
            }
        };

        // Fetch usage data
        const usageMap = await getCCPartyUsage(clientLEId);

        // Cast prisma JSON to PartyValue and attach metadata
        return parties.map((p: any) => {
            const claimId = p.createdFromClaimId;
            const claim = claimId ? claimsMap.get(claimId) : null;
            
            let originMetadata;
            if (claimId && claim) {
                const fieldName = fieldDefsMap.get(claim.fieldNo) || `Field ${claim.fieldNo}`;
                if (claim.sourceType === 'USER_INPUT') {
                    originMetadata = {
                        originType: "MANUAL",
                        originLabel: `Created manually via Field ${claim.fieldNo} — ${fieldName}`,
                        originFieldNo: claim.fieldNo,
                        originFieldName: fieldName,
                        originSourceLabel: formatSourceLabel(claim.sourceType),
                        originClaimId: claimId
                    };
                } else {
                    originMetadata = {
                        originType: "PROMOTED",
                        originLabel: `Saved for reuse from Field ${claim.fieldNo} — ${fieldName}`,
                        originFieldNo: claim.fieldNo,
                        originFieldName: fieldName,
                        originSourceLabel: formatSourceLabel(claim.sourceType),
                        originClaimId: claimId
                    };
                }
            } else if (claimId && !claim) {
                originMetadata = {
                    originType: "PROMOTED",
                    originLabel: "Saved for reuse from a deleted claim",
                    originClaimId: claimId
                };
            } else {
                originMetadata = {
                    originType: "MANUAL",
                    originLabel: "Created manually in CCC"
                };
            }

            return {
                ...p,
                data: p.data as unknown as PartyValue,
                ...originMetadata,
                usage: usageMap[p.id] || []
            };
        });
    } catch (error) {
        console.error("Failed to fetch CC parties:", error);
        throw new Error("Failed to fetch curated parties");
    }
}

/**
 * Create or update a curated party
 */
export async function upsertCCParty(params: {
    id?: string;
    clientLEId: string;
    data: PartyValue;
}) {
    const identity = await getIdentity();
    if (!identity?.userId) {
        throw new Error("Unauthorized");
    }

    if (!isPartyValue(params.data)) {
        throw new Error("Invalid PartyValue data structure");
    }

    try {
        let party;
        if (params.id) {
            party = await prisma.cCParty.update({
                where: { id: params.id },
                data: {
                    data: params.data as any,
                    updatedByUserId: identity.userId
                }
            });
        } else {
            party = await prisma.cCParty.create({
                data: {
                    clientLEId: params.clientLEId,
                    data: params.data as any,
                    visibility: "CLIENT_LE",
                    createdByUserId: identity.userId,
                    updatedByUserId: identity.userId
                }
            });
        }

        revalidatePath(`/app/le/${params.clientLEId}/sources/ccc`);
        return {
            success: true,
            party: {
                ...party,
                data: party.data as unknown as PartyValue
            }
        };
    } catch (error) {
        console.error("Failed to upsert CC party:", error);
        throw new Error("Failed to save saved party");
    }
}

/**
 * Get usage of curated parties across PARTY_REF fields
 * Returns a map of ccPartyId -> Array of { fieldNo, fieldName }
 */
export async function getCCPartyUsage(clientLEId: string) {
    const identity = await getIdentity();
    if (!identity?.userId) {
        throw new Error("Unauthorized");
    }

    try {
        const claims = await prisma.fieldClaim.findMany({
            where: { valueJson: { not: Prisma.AnyNull }, claimRole: 'VALUE' },
            select: { fieldNo: true, valueJson: true }
        });

        const usageMap: Record<string, { fieldNo: number; fieldName: string }[]> = {};
        const defMap = new Map<number, string>();

        for (const claim of claims) {
            const value = claim.valueJson as any;
            const partyIds = extractIds(value, 'ccPartyId');
            for (const partyId of partyIds) {
                if (!usageMap[partyId]) {
                    usageMap[partyId] = [];
                }
                // Avoid duplicates if multiple claims for the same field point to the same party
                if (!usageMap[partyId].some(u => u.fieldNo === claim.fieldNo)) {
                    // Lazy load field definitions only for fields that actually have usage
                    if (!defMap.has(claim.fieldNo)) {
                        try {
                            const def = await getMasterFieldDefinition(claim.fieldNo);
                            defMap.set(claim.fieldNo, def.fieldName);
                        } catch (e) {
                            defMap.set(claim.fieldNo, `Field ${claim.fieldNo}`);
                        }
                    }
                    usageMap[partyId].push({
                        fieldNo: claim.fieldNo,
                        fieldName: defMap.get(claim.fieldNo) as string
                    });
                }
            }
        }

        console.log("[getCCPartyUsage] Returning usage map:", JSON.stringify(usageMap, null, 2));
        return usageMap;
    } catch (error) {
        console.error("Failed to fetch CC party usage:", error);
        throw new Error("Failed to fetch saved party usage");
    }
}

/**
 * Search curated parties for a client LE (used by UnifiedPartyPicker)
 */
export async function searchCCParties(clientLEId: string, query: string) {
    const identity = await getIdentity();
    if (!identity?.userId) {
        throw new Error("Unauthorized");
    }

    try {
        const parties = await prisma.cCParty.findMany({
            where: {
                clientLEId,
                // Prisma doesn't support deep JSON filtering well without raw SQL,
                // so we fetch all and filter in memory since CCC sizes per client are small (<100 usually).
            },
            orderBy: { createdAt: "desc" }
        });

        const queryLower = query.toLowerCase();
        
        const filtered = parties.filter((p: any) => {
            const data = p.data as any;
            if (!data) return false;
            
            const matchesName = 
                (data.partyType === 'ORGANISATION' && data.name?.toLowerCase().includes(queryLower)) ||
                (data.partyType === 'INDIVIDUAL' && 
                 ((data.forenames || '') + ' ' + (data.surname || '')).toLowerCase().includes(queryLower)) ||
                // Legacy PERSON structure
                (data.contactType === 'PERSON' && 
                 ((data.forenames || '') + ' ' + (data.surname || '')).toLowerCase().includes(queryLower));

            return matchesName;
        });

        return filtered.map((p: any) => ({
            ...p,
            data: p.data as unknown as PartyValue
        }));
    } catch (error) {
        console.error("Failed to search CC parties:", error);
        throw new Error("Failed to search curated parties");
    }
}

/**
 * Delete a curated party
 */
export async function deleteCCParty(id: string, clientLEId: string) {
    const identity = await getIdentity();
    if (!identity?.userId) {
        throw new Error("Unauthorized");
    }

    try {
        const claims = await prisma.fieldClaim.findMany({
            where: { valueJson: { not: Prisma.AnyNull }, claimRole: 'VALUE' },
            select: { valueJson: true }
        });

        const isUsed = claims.some((c: any) => {
            const val = c.valueJson as any;
            return extractIds(val, 'ccPartyId').has(id);
        });

        if (isUsed) {
            throw new Error("This saved party is used by one or more fields. Remove those references before deleting.");
        }

        await prisma.cCParty.delete({
            where: { id }
        });

        revalidatePath(`/app/le/${clientLEId}/sources/ccc`);
        return { success: true };
    } catch (error: any) {
        console.error("Failed to delete CC party:", error);
        throw new Error(error.message || "Failed to delete saved party");
    }
}

/**
 * Promote a claim to a CCParty
 */
export async function promoteClaimToCCParty(claimId: string, clientLEId: string) {
    const identity = await getIdentity();
    if (!identity?.userId) {
        throw new Error("Unauthorized");
    }

    try {
        // 1. Fetch the claim
        const claim = await prisma.fieldClaim.findUnique({
            where: { id: claimId }
        });

        if (!claim) {
            throw new Error("Claim not found");
        }

        if (claim.claimRole !== 'VALUE') {
            throw new Error("Only VALUE claims are promotable");
        }

        if (claim.clientLeScopeId && claim.clientLeScopeId !== clientLEId) {
            throw new Error("Claim does not belong to this dossier");
        }

        const def = await getMasterFieldDefinition(claim.fieldNo);
        if (def.appDataType !== 'PARTY' && def.appDataType !== 'PERSON_OR_CONTACT') {
            throw new Error("Only PARTY claims are promotable");
        }

        if (!claim.valueJson) {
            throw new Error("Claim has no valueJson to save for reuse");
        }

        if (!isPartyValue(claim.valueJson)) {
            throw new Error("Claim value is not a valid Party structure");
        }

        // 2. Prevent duplicate promotion
        const existing = await prisma.cCParty.findFirst({
            where: { createdFromClaimId: claimId }
        });

        if (existing) {
            throw new Error("Claim is already saved for reuse");
        }

        // 3. Create CCParty
        const party = await prisma.cCParty.create({
            data: {
                clientLEId,
                data: claim.valueJson as any,
                visibility: "CLIENT_LE",
                createdFromClaimId: claimId,
                createdByUserId: identity.userId,
                updatedByUserId: identity.userId
            }
        });

        revalidatePath(`/app/le/${clientLEId}/sources/ccc`);
        return { success: true, party };
    } catch (error) {
        console.error("Failed to promote claim:", error);
        throw new Error("Failed to save for reuse");
    }
}

