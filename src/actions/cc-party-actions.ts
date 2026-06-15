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
                ...originMetadata
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
 * Delete a curated party
 */
export async function deleteCCParty(id: string, clientLEId: string) {
    const identity = await getIdentity();
    if (!identity?.userId) {
        throw new Error("Unauthorized");
    }

    try {
        await prisma.cCParty.delete({
            where: { id }
        });

        revalidatePath(`/app/le/${clientLEId}/ccc`);
        return { success: true };
    } catch (error) {
        console.error("Failed to delete CC party:", error);
        throw new Error("Failed to delete curated party");
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
