"use server";

import prisma from "@/lib/prisma";
import PDFParser from "pdf2json";
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

export interface MappingSuggestion {
    originalText: string;
    suggestedKey: string;
    confidence: number;
    newFieldProposal?: {
        key: string;
        label: string;
        type: string;
        description?: string;
    };
}

// 1. Parse PDF using pdf2json (Node-native, no DOM dependencies)
export async function parseDocument(formData: FormData): Promise<string> {
    const file = formData.get("file") as File;
    if (!file) {
        throw new Error("No file uploaded");
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return new Promise((resolve, reject) => {
        const parser = new PDFParser(null, 1); // 1 = Text content only

        parser.on("pdfParser_dataError", (errData: any) => {
            console.error("PDF Parser Error:", errData.parserError);
            reject(new Error("Failed to parse PDF"));
        });

        parser.on("pdfParser_dataReady", () => {
            // getRawTextContent() returns text without formatting
            try {
                const raw = parser.getRawTextContent();
                resolve(raw);
            } catch (e) {
                reject(e);
            }
        });

        parser.parseBuffer(buffer);
    });
}

// 2. Generate Schema Mapping using LLM (OpenAI + Zod)
export async function generateMappingSuggestions(text: string): Promise<MappingSuggestion[]> {
    // A. Fetch Master Schema
    const masterSchema = await prisma.masterSchema.findFirst({
        where: { isActive: true },
    });
    const fields = (masterSchema?.definition as any)?.fields || [];

    // Create a simplified schema description for the LLM
    const schemaDesc = fields.map((f: any) => `${f.key} (${f.label}): ${f.description || ''}`).join('\n');

    // B. Call OpenAI via Vercel AI SDK
    try {
        const { object } = await generateObject({
            model: openai('gpt-4o'),
            schema: z.object({
                mappings: z.array(z.object({
                    questionText: z.string().describe("The exact text of the question found in the document"),
                    masterKey: z.string().optional().describe("The best matching key from the Master Schema, if any"),
                    confidence: z.number().min(0).max(1).describe("Confidence score between 0 and 1"),
                    newFieldProposal: z.object({
                        key: z.string().describe("Proposed snake_case key for the new field"),
                        label: z.string().describe("Human readable label"),
                        type: z.enum(["text", "number", "date", "boolean", "select", "currency"]).describe("Data type"),
                        description: z.string().optional().describe("Description for AI context"),
                    }).optional().describe("Propose a new field if no good match exists in the Master Schema")
                }))
            }),
            prompt: `
            Analyze the following text extracted from a financial questionnaire.
            Identify specific questions asked and map them to the provided Master Schema fields.
            
            MASTER SCHEMA FIELDS:
            ${schemaDesc}
            
            EXTRACTED TEXT START:
            ${text.substring(0, 15000)} 
            EXTRACTED TEXT END
            
            Rules:
            1. If a question matches an existing Master Schema field (confidence > 0.7), map it to 'masterKey'.
            2. If NO good match exists (confidence < 0.7), you MUST propose a 'newFieldProposal'.
               - Create a logical snake_case key (e.g. 'esg_score').
               - specificy the correct data type.
            3. Ignore instructional text.
            `
        });

        // C. Transform to UI format
        return object.mappings.map(m => ({
            originalText: m.questionText,
            suggestedKey: m.masterKey || "",
            // Use a special prefix or flag in the UI to indicate it's a new proposal
            // For now, we'll attach the proposal to the suggestion object
            // We need to extend the interface return type first, but for now let's hack the object return or update interface.
            // Let's rely on the frontend to handle the 'suggestedKey' being empty if new proposal is present? 
            // Better: update the interface.
            confidence: m.confidence,
            newFieldProposal: m.newFieldProposal
        }));


    } catch (e) {
        console.error("LLM Error:", e);
        // Fallback or empty if LLM fails (e.g. invalid key)
        return [];
    }
}
