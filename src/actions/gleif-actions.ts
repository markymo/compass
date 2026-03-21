"use server";

import prisma from "@/lib/prisma";
import { fetchGLEIFData } from "@/actions/gleif";
import { updateClientLE } from "@/actions/client";
import { revalidatePath } from "next/cache";

export async function refreshGleifData(leId: string) {
    console.log("[refreshGleifData] START for leId:", leId);
    
    try {
        // 1. Fetch Client LE to get current LEI
        const le = await prisma.clientLE.findUnique({
            where: { id: leId },
            select: { id: true, lei: true }
        });

        if (!le) {
            return { success: false, error: "Legal Entity not found" };
        }

        if (!le.lei) {
            return { success: false, error: "No LEI found for this entity. Cannot refresh GLEIF data." };
        }

        // 2. Fetch from GLEIF API
        const result = await fetchGLEIFData(le.lei);
        
        if (!result.success) {
            return { success: false, error: result.error };
        }

        // 3. Update ClientLE using existing updateClientLE action
        // This also handles nationalRegistryData if present in the payload
        const updateResult = await updateClientLE(leId, {
            gleifData: result.data
        });

        if (updateResult.success) {
            revalidatePath(`/app/le/${leId}/sources/gleif`);
            return { success: true };
        } else {
            return { success: false, error: updateResult.error || "Failed to update record" };
        }

    } catch (error: any) {
        console.error("GLEIF Refresh Error:", error);
        return { success: false, error: error.message || "Failed to refresh GLEIF data" };
    }
}
