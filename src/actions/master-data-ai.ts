"use server";

import prisma from "@/lib/prisma";
import { isSystemAdmin } from "@/actions/security";

/**
 * Generates a concise description for a master data field using AI.
 */
export async function generateFieldDescription(
    systemPrompt: string,
    fieldName: string,
    category: string,
    dataType: string
): Promise<{
    success: boolean;
    description?: string;
    error?: string;
}> {
    try {
        if (!(await isSystemAdmin())) {
            return { success: false, error: "Unauthorized. Must be system admin." };
        }

        const key = process.env.OPENAI_API_KEY;
        if (!key) {
            return { success: false, error: "OpenAI API key not configured" };
        }

        const { createOpenAI } = await import('@ai-sdk/openai');
        const { generateText } = await import('ai');

        const openai = createOpenAI({ apiKey: key });

        // Replace placeholders in the prompt
        // Ensure the prompt guides the AI appropriately
        const finalPrompt = systemPrompt
            .replace(/\{\{fieldName\}\}/g, fieldName)
            .replace(/\{\{category\}\}/g, category || 'General')
            .replace(/\{\{dataType\}\}/g, dataType || 'String');

        const { text } = await generateText({
            model: openai('gpt-4o-mini'),
            prompt: finalPrompt,
            temperature: 0.2, // Low temperature for factual/structural responses
        });

        // Clean up the response (remove quotes if AI added them, trim)
        let cleanText = text.trim();
        if (cleanText.startsWith('"') && cleanText.endsWith('"')) {
            cleanText = cleanText.slice(1, -1);
        }

        return { success: true, description: cleanText };
    } catch (error: any) {
        console.error("[generateFieldDescription] Error:", error);
        return { success: false, error: error.message || "Failed to generate description" };
    }
}

/**
 * Updates a master data field's notes/description.
 */
export async function updateFieldDescription(fieldNo: number, notes: string): Promise<{ success: boolean; error?: string }> {
    try {
        if (!(await isSystemAdmin())) {
            return { success: false, error: "Unauthorized. Must be system admin." };
        }

        await (prisma as any).masterFieldDefinition.update({
            where: { fieldNo },
            data: { notes }
        });

        return { success: true };
    } catch (error: any) {
        console.error("[updateFieldDescription] Error:", error);
        return { success: false, error: error.message || "Failed to update field description" };
    }
}
