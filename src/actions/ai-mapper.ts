"use server";

import prisma from "@/lib/prisma";
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

import mammoth from 'mammoth';

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

// 1. Process Document: Convert to Base64 (Images/PDF) or Text (Docx/Txt)
export async function parseDocument(formData: FormData): Promise<{ content: string, type: "image" | "text", mime: string }> {
    const file = formData.get("file") as File;
    if (!file) {
        throw new Error("No file uploaded");
    }

    console.log(`[AI Mapper] Processing file: ${file.name} (${file.type}, ${file.size} bytes)`);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // DOCX Handling
    if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || file.name.endsWith(".docx")) {
        console.log("[AI Mapper] Parsing DOCX via Mammoth");
        const result = await mammoth.extractRawText({ buffer });
        return {
            content: result.value, // The raw text
            type: "text",
            mime: "text/plain"
        };
    }

    // TEXT Handling
    if (file.type === "text/plain" || file.name.endsWith(".txt")) {
        return {
            content: buffer.toString('utf-8'),
            type: "text",
            mime: "text/plain"
        };
    }

    // IMAGE / PDF Handling (Vision API)
    const base64 = buffer.toString('base64');
    return {
        content: base64,
        type: "image",
        mime: file.type
    };
}

// 2. Generate Schema Mapping
export async function generateMappingSuggestions(input: { content: string, type: "image" | "text", mime: string }): Promise<MappingSuggestion[]> {
    const { content, type, mime } = input;

    // A. Fetch Master Schema
    const masterSchema = await prisma.masterSchema.findFirst({
        where: { isActive: true },
    });
    const fields = (masterSchema?.definition as any)?.fields || [];
    const schemaDesc = fields.map((f: any) => `${f.key} (${f.label}): ${f.description || ''}`).join('\n');

    // B. Construct Message Content
    const userContent: any[] = [
        {
            type: "text",
            text: `Analyze this financial questionnaire document.
            Extract EVERY question or data request found, paying attention to checkboxes and tables.
            
            MASTER SCHEMA FIELDS (Use these if possible):
            ${schemaDesc}
            
            Rules:
            1. List every question found.
            2. If a question matches a Master Schema field, map it to 'masterKey'.
            3. If it does NOT match, leaving 'masterKey' empty AND propose a 'newFieldProposal'.
            `
        }
    ];

    if (type === "text") {
        userContent.push({
            type: "text",
            text: `DOCUMENT CONTENT:\n\n${content}`
        });
    } else {
        userContent.push({
            type: "image",
            // @ts-ignore
            image: `data:${mime};base64,${content}`
        });
    }

    try {
        console.log(`[AI Mapper] Calling OpenAI (${type} mode)`);

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
                    }).nullable().describe("Propose a new field if no good match exists")
                }))
            }),
            messages: [
                {
                    role: "user",
                    content: userContent
                }
            ]
        });

        console.log(`[AI Mapper] LLM returned ${object.mappings.length} mappings.`);

        return object.mappings.map(m => ({
            originalText: m.questionText,
            suggestedKey: m.masterKey || "",
            confidence: m.confidence,
            newFieldProposal: m.newFieldProposal || undefined // Convert null to undefined
        }));

    } catch (e) {
        console.error("[AI Mapper] LLM Error:", e);
        return [];
    }
}
