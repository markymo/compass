"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { ExtractedItem } from "./ai-mapper"; // Importing type
import { MasterSchemaDefinition } from "@/types/schema";

export async function createLegalEntity(data: { name: string; jurisdiction: string; clientOrgId: string }) {
    if (!data.name || !data.clientOrgId) {
        return { success: false, error: "Name and Client Org ID are required" };
    }

    try {
        const le = await prisma.clientLE.create({
            data: {
                name: data.name,
                jurisdiction: data.jurisdiction,
                clientOrgId: data.clientOrgId,
                status: "ACTIVE",
            },
        });
        revalidatePath(`/app/le`); // Revalidate list page
        return { success: true, data: le };
    } catch (error) {
        console.error("Failed to create LE:", error);
        return { success: false, error: "Database error" };
    }
}

export async function updateClientLEData(clientLEId: string, inputData: Record<string, any>) {
    // 1. Get existing record or create one specific to the "Master Schema"
    // For V1 we assume there is ONE active Master Schema we are answering against.
    // In reality, we might need to find the specific Record linked to the Master Schema version.

    const masterSchema = await prisma.masterSchema.findFirst({ where: { isActive: true } });
    if (!masterSchema) return { success: false, error: "No active Master Schema" };

    try {
        // Find existing record for this LE and Schema
        let record = await prisma.clientLERecord.findFirst({
            where: {
                clientLEId,
                masterSchemaId: masterSchema.id
            }
        });

        if (!record) {
            // Create
            record = await prisma.clientLERecord.create({
                data: {
                    clientLEId,
                    masterSchemaId: masterSchema.id,
                    data: inputData,
                    status: "DRAFT"
                }
            });
        } else {
            // Merge Data
            const currentData = (record.data as Record<string, any>) || {};
            const newData = { ...currentData, ...inputData };

            await prisma.clientLERecord.update({
                where: { id: record.id },
                data: {
                    data: newData
                }
            });
        }

        revalidatePath(`/app/le/${clientLEId}`);
        return { success: true };

    } catch (error) {
        console.error("Failed to update LE data:", error);
        return { success: false, error: "Update failed" };
    }
}

export async function getEffectiveRequirements(clientLEId: string) {
    // 1. Fetch Engagements and their Linked Questionnaires
    const engagements = await prisma.fIEngagement.findMany({
        where: { clientLEId },
        include: {
            questionnaires: true, // Fetch linked questionnaires
            org: true // To get FI Name
        }
    });

    // 2. Fetch Master Schema to get Field Definitions
    const masterSchema = await prisma.masterSchema.findFirst({ where: { isActive: true } });
    if (!masterSchema) return { success: false, error: "No active Master Schema" };

    const definition = masterSchema.definition as any as MasterSchemaDefinition;
    const allFields = definition.fields || [];

    // 3. Aggregate Requirements
    // Map: Key -> { requiredBy: Set<FIName>, definition: FieldDef }
    const requirements = new Map<string, { definition: any, requiredBy: Set<string> }>();

    for (const eng of engagements) {
        const fiName = eng.org.name;

        for (const q of eng.questionnaires) {
            // Check extractedContent for generic 'QUESTIONS' that map to a Master Key
            const items = (q.extractedContent as any as ExtractedItem[]) || [];

            items.forEach(item => {
                if (item.type === "QUESTION" && item.masterKey) {
                    const key = item.masterKey;

                    // Verify key exists in Master Schema
                    const fieldDef = allFields.find(f => f.key === key);
                    if (fieldDef) {
                        if (!requirements.has(key)) {
                            requirements.set(key, { definition: fieldDef, requiredBy: new Set() });
                        }
                        requirements.get(key)!.requiredBy.add(fiName); // Add FI name
                    }
                }
            });
        }
    }

    // 4. Fetch Current Answers (with Carry Forward)
    let record = await prisma.clientLERecord.findFirst({
        where: { clientLEId, masterSchemaId: masterSchema.id }
    });

    // Fallback: If no record for THIS version, find the most recent one for ANY version
    if (!record) {
        record = await prisma.clientLERecord.findFirst({
            where: { clientLEId },
            orderBy: { updatedAt: 'desc' }
        });
    }

    const answers = (record?.data as Record<string, any>) || {};

    // 5. Format Output
    const fields = Array.from(requirements.entries()).map(([key, data]) => ({
        key,
        ...data.definition,
        requiredBy: Array.from(data.requiredBy),
        currentValue: answers[key] || ""
    }));

    // Start with all requirements, but also include fields that HAVE answers even if not required anymore?
    // For now, let's stick to "Effective Requirements". 
    // If a user answered something that's no longer asked, it might be hidden.

    // Calculate generic progress
    const total = fields.length;
    const filled = fields.filter(f => f.currentValue !== undefined && f.currentValue !== "").length;

    return {
        success: true,
        fields,
        progress: { total, filled }
    };
}
