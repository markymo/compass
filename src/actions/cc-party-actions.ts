"use server";

import { getIdentity } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { PartyValue, isPartyValue } from "@/lib/master-data/party-value";
import { revalidatePath } from "next/cache";
import { getMasterFieldDefinition } from "@/services/masterData/definitionService";

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
                where: { id: { in: claimIds } },
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
                originMetadata = {
                    originType: "PROMOTED",
                    originLabel: `Promoted from Field ${claim.fieldNo} — ${fieldName}`,
                    originFieldNo: claim.fieldNo,
                    originFieldName: fieldName,
                    originSourceLabel: formatSourceLabel(claim.sourceType),
                    originClaimId: claimId
                };
            } else if (claimId && !claim) {
                originMetadata = {
                    originType: "PROMOTED",
                    originLabel: "Promoted from a deleted claim",
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

        revalidatePath(`/app/le/${params.clientLEId}/ccc`);
        return {
            success: true,
            party: {
                ...party,
                data: party.data as unknown as PartyValue
            }
        };
    } catch (error) {
        console.error("Failed to upsert CC party:", error);
        throw new Error("Failed to save curated party");
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
        const refDefs = await prisma.masterFieldDefinition.findMany({
            where: { appDataType: 'PARTY_REF' },
            select: { fieldNo: true, fieldName: true }
        });

        const usageMap: Record<string, { fieldNo: number; fieldName: string }[]> = {};

        if (refDefs.length === 0) {
            return usageMap;
        }

        const refFieldNos = refDefs.map((d: any) => d.fieldNo);
        const defMap = new Map<number, string>(refDefs.map((d: any) => [d.fieldNo, d.fieldName]));

        // Fetch all claims for these fields (ideally scoped to clientLEId, but we fetch all for safety
        // since we are just counting usage of parties).
        // Since FieldClaims can be large, we use raw SQL to find matching ccPartyIds efficiently.
        // But for Prisma, we can do an in-memory filter if we scope by subjectLeId, but we want all usages.
        // Let's use Prisma to fetch all valueJsons for these fieldNos.
        const claims = await prisma.fieldClaim.findMany({
            where: { fieldNo: { in: refFieldNos } },
            select: { fieldNo: true, valueJson: true }
        });

        for (const claim of claims) {
            const value = claim.valueJson as any;
            if (value && typeof value === 'object' && typeof value.ccPartyId === 'string') {
                const partyId = value.ccPartyId;
                if (!usageMap[partyId]) {
                    usageMap[partyId] = [];
                }
                // Avoid duplicates if multiple claims for the same field point to the same party
                if (!usageMap[partyId].some(u => u.fieldNo === claim.fieldNo)) {
                    usageMap[partyId].push({
                        fieldNo: claim.fieldNo,
                        fieldName: (defMap.get(claim.fieldNo) as string) || `Field ${claim.fieldNo}`
                    });
                }
            }
        }

        console.log("[getCCPartyUsage] Returning usage map:", JSON.stringify(usageMap, null, 2));
        return usageMap;
    } catch (error) {
        console.error("Failed to fetch CC party usage:", error);
        throw new Error("Failed to fetch curated party usage");
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
        const refDefs = await prisma.masterFieldDefinition.findMany({
            where: { appDataType: 'PARTY_REF' },
            select: { fieldNo: true }
        });

        if (refDefs.length > 0) {
            const refFieldNos = refDefs.map((d: any) => d.fieldNo);
            const claims = await prisma.fieldClaim.findMany({
                where: { fieldNo: { in: refFieldNos } },
                select: { valueJson: true }
            });

            const isUsed = claims.some((c: any) => {
                const val = c.valueJson as any;
                return val && val.ccPartyId === id;
            });

            if (isUsed) {
                throw new Error("This curated party is used by one or more fields. Remove those references before deleting.");
            }
        }

        await prisma.cCParty.delete({
            where: { id }
        });

        revalidatePath(`/app/le/${clientLEId}/ccc`);
        return { success: true };
    } catch (error: any) {
        console.error("Failed to delete CC party:", error);
        throw new Error(error.message || "Failed to delete curated party");
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

        const def = await getMasterFieldDefinition(claim.fieldNo);
        if (def.appDataType !== 'PARTY' && def.appDataType !== 'PERSON_OR_CONTACT') {
            throw new Error("Only PARTY claims are promotable");
        }

        if (!claim.valueJson) {
            throw new Error("Claim has no valueJson to promote");
        }

        if (!isPartyValue(claim.valueJson)) {
            throw new Error("Claim value is not a valid Party structure");
        }

        // 2. Prevent duplicate promotion
        const existing = await prisma.cCParty.findFirst({
            where: { createdFromClaimId: claimId }
        });

        if (existing) {
            throw new Error("Claim is already promoted");
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

        revalidatePath(`/app/le/${clientLEId}/ccc`);
        return { success: true, party };
    } catch (error) {
        console.error("Failed to promote claim:", error);
        throw new Error("Failed to promote claim");
    }
}
