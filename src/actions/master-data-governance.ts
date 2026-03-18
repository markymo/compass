"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { invalidateDefinitionCache } from "@/services/masterData/definitionService";

/**
 * toggleFieldActive: Toggles the active state of a master field definition.
 */
export async function toggleFieldActive(fieldNo: number, isActive: boolean) {
    try {
        await (prisma as any).masterFieldDefinition.update({
            where: { fieldNo },
            data: { isActive }
        });
        invalidateDefinitionCache();
        revalidatePath("/app/admin/master-data");
        revalidatePath("/app/admin/master-data/fields");
        return { success: true };
    } catch (e) {
        console.error("[toggleFieldActive] Error:", e);
        return { success: false, error: String(e) };
    }
}

/**
 * toggleGroupActive: Toggles the active state of a master field group.
 */
export async function toggleGroupActive(id: string, isActive: boolean) {
    try {
        await (prisma as any).masterFieldGroup.update({
            where: { id },
            data: { isActive }
        });
        revalidatePath("/app/admin/master-data");
        revalidatePath("/app/admin/master-data/groups");
        return { success: true };
    } catch (e) {
        console.error("[toggleGroupActive] Error:", e);
        return { success: false, error: String(e) };
    }
}

/**
 * clearDefinitionCache: Forces a refresh of the definition cache.
 */
export async function clearDefinitionCache() {
    try {
        invalidateDefinitionCache();
        revalidatePath("/app/admin/master-data");
        return { success: true };
    } catch (e) {
        console.error("[clearDefinitionCache] Error:", e);
        return { success: false, error: String(e) };
    }
}

/**
 * updateMasterField: Updates metadata for a master field definition.
 */
export async function updateMasterField(
    fieldNo: number,
    data: {
        fieldName?: string;
        category?: string;
        notes?: string;
        description?: string;
        domain?: string;
        isActive?: boolean;
    }
) {
    try {
        await (prisma as any).masterFieldDefinition.update({
            where: { fieldNo },
            data
        });
        invalidateDefinitionCache();
        revalidatePath("/app/admin/master-data");
        revalidatePath("/app/admin/master-data/fields");
        return { success: true };
    } catch (e) {
        console.error("[updateMasterField] Error:", e);
        return { success: false, error: String(e) };
    }
}

/**
 * createMasterFieldGroup: Creates a new master field group.
 */
export async function createMasterFieldGroup(data: {
    key: string;
    label: string;
    description?: string;
    category?: string;
    order?: number;
}) {
    try {
        const group = await (prisma as any).masterFieldGroup.create({ data });
        invalidateDefinitionCache();
        revalidatePath("/app/admin/master-data");
        revalidatePath("/app/admin/master-data/groups");
        return { success: true, group };
    } catch (e) {
        console.error("[createMasterFieldGroup] Error:", e);
        return { success: false, error: String(e) };
    }
}

/**
 * updateMasterFieldGroup: Updates metadata for a master field group.
 */
export async function updateMasterFieldGroup(
    id: string,
    data: {
        label?: string;
        description?: string;
        category?: string;
        isActive?: boolean;
        order?: number;
    }
) {
    try {
        await (prisma as any).masterFieldGroup.update({
            where: { id },
            data
        });
        invalidateDefinitionCache();
        revalidatePath("/app/admin/master-data");
        revalidatePath("/app/admin/master-data/groups");
        return { success: true };
    } catch (e) {
        console.error("[updateMasterFieldGroup] Error:", e);
        return { success: false, error: String(e) };
    }
}

/**
 * renameCustomField: Updates the label of a CustomFieldDefinition.
 * Available to LE_Admin and LE_User roles.
 */
export async function renameCustomField(
    customFieldId: string,
    newLabel: string
): Promise<{ success: boolean; error?: string }> {
    try {
        if (!newLabel.trim()) {
            return { success: false, error: "Label cannot be empty" };
        }

        await prisma.customFieldDefinition.update({
            where: { id: customFieldId },
            data: { label: newLabel.trim() }
        });

        revalidatePath("/app/admin/master-data");
        revalidatePath("/app/admin/master-data/fields");
        // Revalidate workbench pages broadly
        revalidatePath("/app/le", "layout");

        return { success: true };
    } catch (e) {
        console.error("[renameCustomField] Error:", e);
        return { success: false, error: String(e) };
    }
}
