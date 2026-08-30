"use server";

import { getIdentity } from "@/lib/auth";
import { ensureApiAuthorization } from "@/lib/auth/api-auth";
import { Action } from "@/lib/auth/permissions";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { CCPartyService } from "@/services/masterData/cc-party-service";
import type { V2PartyType } from "@/lib/master-data/party-v2/CCPartyData";
import { PartyValue, isPartyValue, getPartyName } from "@/lib/master-data/party-value";
import { revalidatePath } from "next/cache";
import { getMasterFieldDefinition } from "@/services/masterData/definitionService";
import { KycStateService } from "@/lib/kyc/KycStateService";

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
    if (!clientLEId) {
        return [];
    }

    await ensureApiAuthorization(Action.LE_VIEW_MASTER_DATA, { clientLEId });

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
    const { userId } = await ensureApiAuthorization(Action.LE_EDIT_MASTER_DATA, { clientLEId: params.clientLEId });

    if (!isPartyValue(params.data)) {
        throw new Error("Invalid PartyValue data structure");
    }

    try {
        const { CCPartyService } = await import("@/services/masterData/cc-party-service");
        const { convertLegacyManualPartyToV2 } = await import("@/services/masterData/cc-party-legacy-adapter");
        
        const v2Data = convertLegacyManualPartyToV2(params.data);
        
        let party;
        if (params.id) {
            party = await CCPartyService.update({
                ccPartyId: params.id,
                clientLEId: params.clientLEId,
                data: v2Data,
                updatedByUserId: userId
            });
        } else {
            party = await CCPartyService.create({
                clientLEId: params.clientLEId,
                data: v2Data,
                createdByUserId: userId
            });
        }

        revalidatePath(`/app/le/${params.clientLEId}/sources/user-parties`);
        revalidatePath(`/app/le/${params.clientLEId}/sources/user`);
        return {
            success: true,
            party: {
                ...party,
                data: party.data as unknown as PartyValue
            }
        };
    } catch (error: any) {
        if (error?.message?.startsWith("Unauthorized")) {
            throw error;
        }
        console.error("Failed to upsert CC party:", error);
        throw new Error(error?.message || "Failed to save saved party");
    }
}

/**
 * Create or update a curated party using the strict V2 schema.
 */
export async function upsertCCPartyV2(params: {
    id?: string;
    clientLEId: string;
    data: any; // We type it as any at the API boundary to perform runtime validation
}) {
    const { userId } = await ensureApiAuthorization(Action.LE_EDIT_MASTER_DATA, { clientLEId: params.clientLEId });

    const { isCCPartyData } = await import("@/lib/master-data/party-v2/CCPartyData");
    if (!isCCPartyData(params.data)) {
        throw new Error(`Invalid CCPartyData V2 structure. Payload: ${JSON.stringify(params.data)}`);
    }

    try {
        const { CCPartyService } = await import("@/services/masterData/cc-party-service");
        
        let party;
        if (params.id) {
            party = await CCPartyService.update({
                ccPartyId: params.id,
                clientLEId: params.clientLEId,
                data: params.data,
                updatedByUserId: userId
            });
        } else {
            party = await CCPartyService.create({
                clientLEId: params.clientLEId,
                data: params.data,
                createdByUserId: userId
            });
        }

        revalidatePath(`/app/le/${params.clientLEId}/sources/user-parties`);
        revalidatePath(`/app/le/${params.clientLEId}/sources/user`);
        return {
            success: true,
            party
        };
    } catch (error: any) {
        if (error?.message?.startsWith("Unauthorized")) {
            throw error;
        }
        console.error("Failed to upsert V2 CC party:", error);
        throw new Error(error?.message || "Failed to save saved party");
    }
}

/**
 * Get usage of curated parties across PARTY_REF fields
 * Returns a map of ccPartyId -> Array of { fieldNo, fieldName }
 */
export async function getCCPartyUsage(clientLEId: string) {
    if (!clientLEId) {
        return {};
    }

    await ensureApiAuthorization(Action.LE_VIEW_MASTER_DATA, { clientLEId });

    try {
        const candidateClaims = await prisma.fieldClaim.findMany({
            where: { clientLEId, claimRole: 'VALUE' },
            select: { fieldNo: true },
            distinct: ['fieldNo']
        });

        if (candidateClaims.length === 0) {
            return {};
        }

        const clientLE = await prisma.clientLE.findUnique({
            where: { id: clientLEId },
            select: { legalEntityId: true }
        });
        const subject = { clientLEId, subjectLeId: clientLE?.legalEntityId ?? null };

        const usageMap: Record<string, { fieldNo: number; fieldName: string }[]> = {};

        for (const { fieldNo } of candidateClaims) {
            try {
                const def = await getMasterFieldDefinition(fieldNo);
                const foundIds = new Set<string>();

                if (def.isMultiValue) {
                    const authoritative = await KycStateService.getAuthoritativeCollection(subject, fieldNo);
                    for (const item of authoritative) {
                        extractIds(item.value, 'ccPartyId', foundIds);
                    }
                } else {
                    const authoritative = await KycStateService.getAuthoritativeValue(subject, fieldNo);
                    if (authoritative) {
                        extractIds(authoritative.value, 'ccPartyId', foundIds);
                    }
                }

                for (const partyId of foundIds) {
                    if (!usageMap[partyId]) {
                        usageMap[partyId] = [];
                    }
                    if (!usageMap[partyId].some(u => u.fieldNo === fieldNo)) {
                        usageMap[partyId].push({
                            fieldNo,
                            fieldName: def.fieldName
                        });
                    }
                }
            } catch (err) {
                console.warn(`[getCCPartyUsage] Failed to resolve field ${fieldNo}:`, err);
            }
        }

        return usageMap;
    } catch (error: any) {
        if (error?.message?.startsWith("Unauthorized")) {
            throw error;
        }
        console.error("Failed to fetch CC party usage:", error);
        throw new Error("Failed to fetch saved party usage");
    }
}

/**
 * Search curated parties for a client LE (used by UnifiedPartyPicker)
 */
export async function searchCCParties(clientLEId: string, query: string, allowedPartyTypes?: V2PartyType[]) {
    if (!clientLEId) {
        return [];
    }

    await ensureApiAuthorization(Action.LE_VIEW_MASTER_DATA, { clientLEId });

    if (allowedPartyTypes && allowedPartyTypes.length === 0) {
        return [];
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
            
            // 1. Eligibility Filter
            if (allowedPartyTypes) {
                const pType = data.partyType ?? (data.contactType === 'PERSON' ? 'INDIVIDUAL' : 'INDIVIDUAL');
                if (!allowedPartyTypes.includes(pType as V2PartyType)) {
                    return false;
                }
            }
            
            // 2. Canonical Match Filter
            if (!query) return true;
            
            const name = getPartyName(data).toLowerCase();
            return name.includes(queryLower);
        });

        return filtered.map((p: any) => ({
            ...p,
            data: p.data as unknown as PartyValue
        }));
    } catch (error: any) {
        if (error?.message?.startsWith("Unauthorized")) {
            throw error;
        }
        console.error("Failed to search CC parties:", error);
        throw new Error(error?.message || "Failed to search curated parties");
    }
}

/**
 * Delete a curated party
 */
export async function deleteCCParty(id: string, clientLEId: string) {
    if (!clientLEId) {
        throw new Error("Client LE ID required");
    }

    await ensureApiAuthorization(Action.LE_EDIT_MASTER_DATA, { clientLEId });

    try {
        const existing = await prisma.cCParty.findUnique({
            where: { id }
        });

        if (!existing || existing.clientLEId !== clientLEId) {
            throw new Error("Party not found in this dossier");
        }

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

        revalidatePath(`/app/le/${clientLEId}/sources/user-parties`);
        revalidatePath(`/app/le/${clientLEId}/sources/user`);
        return { success: true };
    } catch (error: any) {
        if (error?.message?.startsWith("Unauthorized")) {
            throw error;
        }
        console.error("Failed to delete CC party:", error);
        throw new Error(error.message || "Failed to delete saved party");
    }
}

/**
 * Promote a claim to a CCParty
 */
export async function promoteClaimToCCParty(claimId: string, clientLEId: string) {
    const { userId } = await ensureApiAuthorization(Action.LE_EDIT_MASTER_DATA, { clientLEId });

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

        if (claim.clientLEId && claim.clientLEId !== clientLEId) {
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

        // 2. Prevent duplicate promotion (Idempotent return if already promoted)
        const existing = await prisma.cCParty.findFirst({
            where: { createdFromClaimId: claimId }
        });

        if (existing) {
            return { success: true, party: existing, alreadySaved: true };
        }

        // 3. Create CCParty via CCPartyService
        const { CCPartyService } = await import("@/services/masterData/cc-party-service");
        const { convertLegacyManualPartyToV2 } = await import("@/services/masterData/cc-party-legacy-adapter");
        
        const clientLE = await prisma.clientLE?.findUnique({
            where: { id: clientLEId },
            select: { id: true, name: true }
        });

        const v2Data = convertLegacyManualPartyToV2(claim.valueJson, {
            clientLEId,
            clientLEName: clientLE?.name || undefined
        });

        const party = await CCPartyService.create({
            clientLEId,
            data: v2Data,
            createdByUserId: userId,
            createdFromClaimId: claimId
        });

        revalidatePath(`/app/le/${clientLEId}/sources/user-parties`);
        revalidatePath(`/app/le/${clientLEId}/sources/user`);
        return { success: true, party };
    } catch (error: any) {
        console.error("Failed to promote claim:", error);
        throw new Error(error.message || "Failed to save for reuse");
    }
}

