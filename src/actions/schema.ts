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

    // ALWAYS refresh categories from the static source of truth to ensure we have the latest descriptions/examples
    // Transform the static data to the SchemaCategory type
    const categoriesToSeed = MASTER_SCHEMA_CATEGORIES.map(c => ({
        id: c.id,
        title: c.title,
        description: c.description,
        examples: c.fields // Use the static bullet points as "examples"
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

// --- AI Categorization ---
export async function proposeCategoryForField(fieldId: string) {
    const targetSchema = await prisma.masterSchema.findFirst({ orderBy: { version: 'desc' }, });
    if (!targetSchema) return { success: false, error: "No schema definition found" };

    const definition = targetSchema.definition as any as MasterSchemaDefinition;
    const fieldIndex = definition.fields.findIndex(f => (f.id && f.id === fieldId) || f.key === fieldId);

    if (fieldIndex === -1) return { success: false, error: `Field not found (ID/Key: ${fieldId})` };

    const field = definition.fields[fieldIndex];
    // Allow re-proposal even if categorized
    // if (field.categoryId) return { success: false, error: "Already categorized" };

    const categories = definition.categories || [];
    if (categories.length === 0) return { success: false, error: "No categories defined" };

    const prompt = `
    You are a data classification expert for financial onboarding.
    
    Task: Map the following data field to the most appropriate Master Compliance Category.
    
    Field Label: "${field.label}"
    Field Description: "${field.description || ''}"
    Field Key: "${field.key}"

    Available Categories:
    ${categories.map(c => `- ID: ${c.id} | Title: ${c.title} | Desc: ${c.description} | Examples: ${c.examples?.join(', ') || ''}`).join('\n')}

    Return ONLY the numeric ID (e.g. "1", "10", "5"). Do not include any text, punctuation, or explanations.
    `;

    try {
        const { text } = await generateText({
            model: openai("gpt-4o"),
            prompt: prompt,
        });

        // Robust cleanup: find the first number in the string
        const match = text.match(/\d+/);
        const proposedId = match ? match[0] : "1";

        // Validate it exists
        if (!categories.find(c => c.id === proposedId)) {
            console.warn(`AI proposed invalid ID ${proposedId} for field ${field.label}`);
            return { success: false, error: "Invalid category proposed" };
        }

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

export async function bulkAutoMapFields() {
    const targetSchema = await prisma.masterSchema.findFirst({ orderBy: { version: 'desc' }, });
    if (!targetSchema) return { success: false, error: "No schema definition found" };

    const definition = targetSchema.definition as any as MasterSchemaDefinition;
    const categories = definition.categories || [];

    // Find unmapped fields
    const unmappedIndices = definition.fields
        .map((f, idx) => ({ ...f, idx }))
        .filter(f => !f.categoryId && !f.proposedCategoryId); // Only map ones without proposals? Or remap all? Let's do ones without proposals to save tokens.

    console.log(`[BulkMap] Found ${unmappedIndices.length} unmapped fields.`);

    if (unmappedIndices.length === 0) return { success: true, count: 0 };

    // Simply loop and call the logic (parallel is fine for < 50 items)
    // For a larger system, we'd use a single batch prompt.
    // Let's use a batch prompt here for speed and coherence.

    const prompt = `
    You are a data classification expert. Map each Field to the best Category ID.
    
    Categories:
    ${categories.map(c => `${c.id}: ${c.title} (${c.examples?.slice(0, 3).join(', ')})`).join('\n')}

    Fields to Map:
    ${unmappedIndices.map(f => `Key: "${f.key}" | Label: "${f.label}" (Desc: ${f.description || ''})`).join('\n')}

    Return a JSON object where the KEY is the exact "Key" string provided above (e.g. "client_email"), and the VALUE is the Category ID.
    Example: { "client_email": "1", "registered_address": "5" }
    JSON ONLY.
    `;

    try {
        console.log("[BulkMap] Sending prompt to AI...");
        const { text } = await generateText({
            model: openai("gpt-4o"),
            prompt: prompt,
        });

        console.log("[BulkMap] AI Response raw:", text);

        // Robust JSON extraction
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error("[BulkMap] Error: AI did not return a JSON object.");
            return { success: false, error: "AI output format invalid" };
        }

        const cleanJson = jsonMatch[0];
        let mapping: Record<string, string>;
        try {
            mapping = JSON.parse(cleanJson);
            console.log("[BulkMap] Parsed mapping:", mapping);
        } catch (parseError) {
            console.error("[BulkMap] Error: JSON parse failed", parseError);
            return { success: false, error: "Invalid JSON from AI" };
        }

        let updateCount = 0;
        unmappedIndices.forEach(f => {
            // Try to find by key
            const proposedId = mapping[f.key];

            if (proposedId) {
                // Check if category exists
                if (categories.find(c => c.id === String(proposedId))) {
                    definition.fields[f.idx].proposedCategoryId = String(proposedId);
                    updateCount++;
                    console.log(`[BulkMap] Mapped field '${f.key}' to Category ${proposedId}`);
                } else {
                    console.warn(`[BulkMap] Invalid category ID '${proposedId}' returned for field '${f.key}'`);
                }
            } else {
                console.log(`[BulkMap] No mapping returned for field '${f.key}'`);
            }
        });

        console.log(`[BulkMap] Total updates pending: ${updateCount}`);

        if (updateCount > 0) {
            await prisma.masterSchema.update({
                where: { id: targetSchema.id },
                data: { definition: definition as any }
            });
            console.log("[BulkMap] Database updated successfully.");
        }

        revalidatePath("/app/admin/schema");
        return { success: true, count: updateCount };

    } catch (e) {
        console.error("[BulkMap] Unexpected Error:", e);
        return { success: false, error: "Bulk mapping failed" };
    }
}


export async function acceptCategoryProposal(fieldId: string, categoryId: string) {
    // Target Latest
    const targetSchema = await prisma.masterSchema.findFirst({
        orderBy: { version: 'desc' },
    });
    if (!targetSchema) return { success: false, error: "No schema definition found" };

    const definition = targetSchema.definition as any as MasterSchemaDefinition;
    const fieldIndex = definition.fields.findIndex(f => (f.id && f.id === fieldId) || f.key === fieldId);

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
