"use server";

import { getIdentity } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { PartyValue, isPartyValue } from "@/lib/master-data/party-value";
import { revalidatePath } from "next/cache";

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

        // Cast prisma JSON to PartyValue
        return parties.map((p: any) => ({
            ...p,
            data: p.data as unknown as PartyValue
        }));
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
