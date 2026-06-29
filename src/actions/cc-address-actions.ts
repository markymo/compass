"use server";

import { getIdentity } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { AddressValue, isAddressValue } from "@/lib/master-data/address-value";
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
 * Fetch all curated addresses for a given clientLEId
 */
export async function getCCAddresses(clientLEId: string) {
    const identity = await getIdentity();
    if (!identity?.userId) {
        throw new Error("Unauthorized");
    }

    try {
        const addresses = await prisma.cCAddress.findMany({
            where: { clientLEId },
            orderBy: { createdAt: "desc" }
        });

        // Fetch source claims for promoted addresses
        const claimIds = addresses.filter((a: any) => a.createdFromClaimId).map((a: any) => a.createdFromClaimId as string);
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
        const usageMap = await getCCAddressUsage(clientLEId);

        // Cast prisma JSON to AddressValue and attach metadata
        return addresses.map((a: any) => {
            const claimId = a.createdFromClaimId;
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
                    originMetadata = {
                        originType: "PROMOTED",
                        originLabel: `Saved for reuse from Field ${claim.fieldNo} — ${fieldName}`,
                        originFieldNo: claim.fieldNo,
                        originFieldName: fieldName,
                        originSourceLabel: formatSourceLabel(claim.sourceType),
                        originClaimId: claimId
                    };
                }
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
                ...a,
                data: a.data as unknown as AddressValue,
                ...originMetadata,
                usage: usageMap[a.id] || []
            };
        });
    } catch (error) {
        console.error("Failed to fetch CC addresses:", error);
        throw new Error("Failed to fetch saved addresses");
    }
}

/**
 * Create or update a curated address
 */
export async function upsertCCAddress(params: {
    id?: string;
    clientLEId: string;
    data: AddressValue;
}) {
    const identity = await getIdentity();
    if (!identity?.userId) {
        throw new Error("Unauthorized");
    }

    if (!isAddressValue(params.data) && !params.data.addressLines && !params.data.countryCode) {
        throw new Error("Invalid AddressValue data structure");
    }

    try {
        let address;
        if (params.id) {
            address = await prisma.cCAddress.update({
                where: { id: params.id },
                data: {
                    data: params.data as any,
                    updatedByUserId: identity.userId
                }
            });
        } else {
            address = await prisma.cCAddress.create({
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
            address: {
                ...address,
                data: address.data as unknown as AddressValue
            }
        };
    } catch (error) {
        console.error("Failed to upsert CC address:", error);
        throw new Error("Failed to save saved address");
    }
}

/**
 * Get usage of curated addresses across CC_ADDRESS_REF fields
 * Returns a map of ccAddressId -> Array of { fieldNo, fieldName }
 */
export async function getCCAddressUsage(clientLEId: string) {
    const identity = await getIdentity();
    if (!identity?.userId) {
        throw new Error("Unauthorized");
    }

    try {
        const claims = await prisma.fieldClaim.findMany({
            where: { valueJson: { not: Prisma.AnyNull } },
            select: { fieldNo: true, valueJson: true }
        });

        const usageMap: Record<string, { fieldNo: number; fieldName: string }[]> = {};
        const defMap = new Map<number, string>();

        for (const claim of claims) {
            const value = claim.valueJson as any;
            const addressIds = extractIds(value, 'ccAddressId');
            for (const addressId of addressIds) {
                if (!usageMap[addressId]) {
                    usageMap[addressId] = [];
                }
                // Avoid duplicates if multiple claims for the same field point to the same address
                if (!usageMap[addressId].some(u => u.fieldNo === claim.fieldNo)) {
                    // Lazy load field definitions only for fields that actually have usage
                    if (!defMap.has(claim.fieldNo)) {
                        try {
                            const def = await getMasterFieldDefinition(claim.fieldNo);
                            defMap.set(claim.fieldNo, def.fieldName);
                        } catch (e) {
                            defMap.set(claim.fieldNo, `Field ${claim.fieldNo}`);
                        }
                    }
                    usageMap[addressId].push({
                        fieldNo: claim.fieldNo,
                        fieldName: defMap.get(claim.fieldNo) as string
                    });
                }
            }
        }

        return usageMap;
    } catch (error) {
        console.error("Failed to fetch CC address usage:", error);
        throw new Error("Failed to fetch saved address usage");
    }
}

/**
 * Delete a curated address
 */
export async function deleteCCAddress(id: string, clientLEId: string) {
    const identity = await getIdentity();
    if (!identity?.userId) {
        throw new Error("Unauthorized");
    }

    try {
        const claims = await prisma.fieldClaim.findMany({
            where: { valueJson: { not: Prisma.AnyNull } },
            select: { valueJson: true }
        });

        const isUsed = claims.some((c: any) => {
            const val = c.valueJson as any;
            return extractIds(val, 'ccAddressId').has(id);
        });

        if (isUsed) {
            throw new Error("This saved address is used by one or more fields. Remove those references before deleting.");
        }

        await prisma.cCAddress.delete({
            where: { id }
        });

        revalidatePath(`/app/le/${clientLEId}/sources/ccc`);
        return { success: true };
    } catch (error: any) {
        console.error("Failed to delete CC address:", error);
        throw new Error(error.message || "Failed to delete saved address");
    }
}

/**
 * Search curated addresses for a client LE (used by UnifiedAddressPicker)
 */
export async function searchCCAddresses(clientLEId: string, query: string) {
    const identity = await getIdentity();
    if (!identity?.userId) {
        throw new Error("Unauthorized");
    }

    try {
        const addresses = await prisma.cCAddress.findMany({
            where: { clientLEId },
            orderBy: { createdAt: 'desc' }
        });

        const q = query.toLowerCase().trim();

        if (!q) {
            return addresses.map((a: any) => ({
                id: a.id,
                data: a.data as AddressValue
            }));
        }

        // Filter by stringifying the payload
        const filtered = addresses.filter((a: any) => {
            if (!a.data) return false;
            const dataStr = JSON.stringify(a.data).toLowerCase();
            return dataStr.includes(q);
        });

        return filtered.map((a: any) => ({
            id: a.id,
            data: a.data as AddressValue
        }));
    } catch (error) {
        console.error("Failed to search CC addresses:", error);
        throw new Error("Failed to search saved addresses");
    }
}
/**
 * Saves a source-created embedded ADDRESS claim as a reusable CCAddress record.
 * Mirrors the CCParty workflow.
 */
export async function saveAddressForReuse(claimId: string, clientLEId: string) {
    const identity = await getIdentity();
    if (!identity?.userId) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        const claim = await prisma.fieldClaim.findUnique({
            where: { id: claimId }
        });

        if (!claim) {
            return { success: false, message: "Claim not found" };
        }

        if (claim.clientLeScopeId && claim.clientLeScopeId !== clientLEId) {
            return { success: false, message: "Claim does not belong to this dossier" };
        }

        const valueObj = typeof claim.valueJson === 'string'
            ? JSON.parse(claim.valueJson)
            : claim.valueJson;

        if (valueObj && typeof valueObj === 'object' && valueObj.ccAddressId) {
            return { success: false, message: "Already saved for reuse" };
        }

        if (!isAddressValue(valueObj)) {
            return { success: false, message: "Claim does not contain a valid embedded Address" };
        }

        // Check if already saved
        const existing = await prisma.cCAddress.findFirst({
            where: {
                clientLEId,
                createdFromClaimId: claimId
            }
        });

        if (existing) {
            return { success: true, ccAddress: existing };
        }

        // Create new CCAddress
        const newCCAddress = await prisma.cCAddress.create({
            data: {
                clientLEId,
                visibility: "CLIENT_LE",
                data: valueObj as any,
                createdFromClaimId: claimId,
                createdByUserId: claim.verifiedByUserId || identity.userId,
                updatedByUserId: claim.verifiedByUserId || identity.userId
            }
        });

        revalidatePath(`/app/le/${clientLEId}/sources/ccc`);
        revalidatePath(`/app/le/${clientLEId}/workbench4`);

        return { success: true, ccAddress: newCCAddress };

    } catch (error) {
        console.error("Error saving address for reuse:", error);
        return { success: false, message: "Internal error saving address" };
    }
}

