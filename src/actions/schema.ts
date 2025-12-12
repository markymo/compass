"use server";

import prisma from "@/lib/prisma";
import { MasterSchemaDefinition, MasterSchemaDefinitionSchema } from "@/types/schema";
import { revalidatePath } from "next/cache";

export async function createMasterSchema() {
    // 1. Get the latest version number
    const latest = await prisma.masterSchema.findFirst({
        orderBy: { version: 'desc' },
    });

    const nextVersion = (latest?.version || 0) + 1;

    // 2. Create new draft
    // Pre-fill with previous definition if exists
    const initialDefinition = latest?.definition || { fields: [] };

    const newSchema = await prisma.masterSchema.create({
        data: {
            version: nextVersion,
            isActive: false,
            definition: initialDefinition as any,
        },
    });

    revalidatePath("/app/admin/schema");
    return { success: true, data: newSchema };
}

export async function updateSchemaDefinition(id: string, definition: MasterSchemaDefinition) {
    // Validate input
    const parsed = MasterSchemaDefinitionSchema.safeParse(definition);
    if (!parsed.success) {
        return { success: false, error: parsed.error.message };
    }

    // Update
    await prisma.masterSchema.update({
        where: { id },
        data: {
            definition: parsed.data as any, // Cast to any because Prisma JSON is flexible
        },
    });

    revalidatePath("/app/admin/schema");
    return { success: true };
}

export async function publishSchema(id: string) {
    // 1. Deactivate all others (this might be heavy if many, but fine for v1)
    // Actually, we can just set this one to active. Multiple *creates* confusion but
    // logic typically looks for "latest active". Setup properly:

    // Transaction to unset others and set this one
    await prisma.$transaction([
        prisma.masterSchema.updateMany({
            where: { isActive: true },
            data: { isActive: false },
        }),
        prisma.masterSchema.update({
            where: { id },
            data: { isActive: true },
        }),
    ]);

    revalidatePath("/app/admin/schema");
    return { success: true };
}

export async function getLatestSchema() {
    // Get the latest created one (draft or active)
    const schema = await prisma.masterSchema.findFirst({
        orderBy: { version: 'desc' },
    });
    return schema;
}

export async function getActiveSchema() {
    const schema = await prisma.masterSchema.findFirst({
        where: { isActive: true },
    });
    return schema;
}
// Helper to Append new fields (for AI Mapper)
export async function appendFieldsToActiveSchema(newFields: any[]) {
    // 1. Get Active Schema
    const activeSchema = await prisma.masterSchema.findFirst({
        where: { isActive: true },
    });
    if (!activeSchema) return { success: false, error: "No active master schema" };

    // 2. Merge Fields
    const currentDef = activeSchema.definition as any;
    const currentFields = currentDef.fields || [];

    // Simple merge: append if key doesn't exist
    // (Ideally we check for key collisions more robustly)
    const existingKeys = new Set(currentFields.map((f: any) => f.key));
    const fieldsToAdd = newFields.filter(f => !existingKeys.has(f.key));

    if (fieldsToAdd.length === 0) {
        return { success: true, message: "No new fields to add" };
    }

    const updatedDef = {
        ...currentDef,
        fields: [...currentFields, ...fieldsToAdd]
    };

    // 3. Update DB
    await prisma.masterSchema.update({
        where: { id: activeSchema.id },
        data: { definition: updatedDef }
    });

    revalidatePath("/app/admin/schema");
    return { success: true, addedCount: fieldsToAdd.length };
}
