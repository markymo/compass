"use server";

import prisma from "@/lib/prisma";
import { MasterSchemaDefinition, MasterSchemaDefinitionSchema } from "@/types/schema";
import { revalidatePath } from "next/cache";
import { MASTER_SCHEMA_CATEGORIES } from "@/data/master-schema-categories"; // The static source of truth
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

// --- Seed / Sync Categories ---
export async function ensureSchemaCategories() {
    // Target the LATEST schema (Draft or Active) because that's what the UI is editing
    const targetSchema = await prisma.masterSchema.findFirst({
        orderBy: { version: 'desc' },
    });

    if (!targetSchema) return { success: false, error: "No schema found" };

    const definition = targetSchema.definition as any as MasterSchemaDefinition;

    // If categories already exist, maybe update them? For now, if empty/missing, seed.
    if (!definition.categories || definition.categories.length === 0) {

        // Transform the static data to the SchemaCategory type (strip fields string array if needed or keep it)
        const categoriesToSeed = MASTER_SCHEMA_CATEGORIES.map(c => ({
            id: c.id,
            title: c.title,
            description: c.description
            // We don't store the static 'fields' bullet points in the live schema definition usually, 
            // but we can for reference.
        }));

        const newDefinition = {
            ...definition,
            categories: categoriesToSeed
        };

        await prisma.masterSchema.update({
            where: { id: targetSchema.id },
            data: { definition: newDefinition as any }
        });

        revalidatePath("/app/admin/schema");
        return { success: true, seeded: true };
    }

    return { success: true, seeded: false };
}

// --- AI Categorization ---
export async function proposeCategoryForField(fieldId: string) {
    // Target Latest (Draft)
    const targetSchema = await prisma.masterSchema.findFirst({
        orderBy: { version: 'desc' },
    });
    if (!targetSchema) return { success: false, error: "No schema definition found" };

    const definition = targetSchema.definition as any as MasterSchemaDefinition;
    const fieldIndex = definition.fields.findIndex(f => f.id === fieldId);

    if (fieldIndex === -1) return { success: false, error: "Field not found" };

    const field = definition.fields[fieldIndex];
    const categories = definition.categories || [];

    if (categories.length === 0) return { success: false, error: "No categories defined" };

    // Call AI
    const prompt = `
    You are a data classification expert for financial onboarding.
    
    Task: Map the following data field to the most appropriate Master Compliance Category.
    
    Field Label: "${field.label}"
    Field Description: "${field.description || ''}"
    Field Key: "${field.key}"

    Available Categories:
    ${categories.map(c => `- ID: ${c.id} | Title: ${c.title} | Desc: ${c.description}`).join('\n')}

    Return ONLY the ID of the best matching category. If unsure, return "1" (Entity Identity).
    `;

    try {
        const { text } = await generateText({
            model: openai("gpt-4o"),
            prompt: prompt,
        });

        const proposedId = text.trim();

        // Update the field with the proposal
        definition.fields[fieldIndex].proposedCategoryId = proposedId;

        await prisma.masterSchema.update({
            where: { id: targetSchema.id },
            data: { definition: definition as any }
        });

        revalidatePath("/app/admin/schema");
        return { success: true, proposedId };
    } catch (error) {
        console.error("AI Error:", error);
        return { success: false, error: "AI processing failed" };
    }
}

export async function acceptCategoryProposal(fieldId: string, categoryId: string) {
    // Target Latest
    const targetSchema = await prisma.masterSchema.findFirst({
        orderBy: { version: 'desc' },
    });
    if (!targetSchema) return { success: false, error: "No schema definition found" };

    const definition = targetSchema.definition as any as MasterSchemaDefinition;
    const fieldIndex = definition.fields.findIndex(f => f.id === fieldId);

    if (fieldIndex === -1) return { success: false };

    // Apply the category
    definition.fields[fieldIndex].categoryId = categoryId;

    await prisma.masterSchema.update({
        where: { id: targetSchema.id },
        data: { definition: definition as any }
    });

    revalidatePath("/app/admin/schema");
    return { success: true };
}


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
