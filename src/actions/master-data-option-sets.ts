"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { MasterDataOptionSetPayload } from "@/types/master-data";
import { invalidateDefinitionCache } from "@/services/masterData/definitionService";

/**
 * getOptionSets: Fetches all option sets.
 */
export async function getOptionSets() {
    try {
        const optionSets = await prisma.masterDataOptionSet.findMany({
            orderBy: { name: 'asc' }
        });
        return { success: true, optionSets };
    } catch (e) {
        console.error("[getOptionSets] Error:", e);
        return { success: false, error: String(e) };
    }
}

/**
 * createOptionSet: Creates a new master data option set.
 */
export async function createOptionSet(data: MasterDataOptionSetPayload) {
    try {
        const optionSet = await prisma.masterDataOptionSet.create({
            data: {
                name: data.name,
                description: data.description,
                valueType: data.valueType,
                options: data.options as any, // Primas Json type
                isActive: data.isActive !== undefined ? data.isActive : true,
            }
        });
        invalidateDefinitionCache();
        revalidatePath("/app/admin/master-data/option-sets");
        revalidatePath("/app/admin/master-data/fields");
        return { success: true, optionSet };
    } catch (e) {
        console.error("[createOptionSet] Error:", e);
        return { success: false, error: String(e) };
    }
}

/**
 * updateOptionSet: Updates an existing master data option set.
 */
export async function updateOptionSet(id: string, data: Partial<MasterDataOptionSetPayload>) {
    try {
        const updateData: any = { ...data };
        if (updateData.options) {
            updateData.options = updateData.options as any;
        }

        const optionSet = await prisma.masterDataOptionSet.update({
            where: { id },
            data: updateData
        });
        invalidateDefinitionCache();
        revalidatePath("/app/admin/master-data/option-sets");
        revalidatePath("/app/admin/master-data/fields");
        return { success: true, optionSet };
    } catch (e) {
        console.error("[updateOptionSet] Error:", e);
        return { success: false, error: String(e) };
    }
}

/**
 * deleteOptionSet: Deletes a master data option set.
 */
export async function deleteOptionSet(id: string) {
    try {
        await prisma.masterDataOptionSet.delete({
            where: { id }
        });
        invalidateDefinitionCache();
        revalidatePath("/app/admin/master-data/option-sets");
        revalidatePath("/app/admin/master-data/fields");
        return { success: true };
    } catch (e) {
        console.error("[deleteOptionSet] Error:", e);
        return { success: false, error: String(e) };
    }
}
