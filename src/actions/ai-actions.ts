"use server";

import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

export async function generateLEDescription(clientOrgName: string, leName: string) {
    try {
        const key = process.env.OPENAI_API_KEY;
        if (!key) throw new Error("Server Misconfiguration: OPENAI_API_KEY is missing.");

        const openai = createOpenAI({ apiKey: key });

        const prompt = `Generate a single, factual, unemotional sentence describing a financial or corporate project involving the client '${clientOrgName}' and the legal entity '${leName}'. If possible, infer or include relevant dates and geography from their names. Do not use marketing speak or subjective terms like 'exciting'. Just state the facts of the relationship/project. Do not include introductory phrases. Just the sentence itself.`;

        const { text } = await generateText({
            model: openai('gpt-4o'),
            prompt: prompt,
            temperature: 0.7 // add a bit of variety
        });

        return { success: true, description: text.trim().replace(/^"|"$/g, '') }; // Clean up quotes if generated
    } catch (e: any) {
        console.error("[generateLEDescription Error]", e);
        return { success: false, error: e.message };
    }
}
