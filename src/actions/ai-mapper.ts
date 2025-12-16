"use server";

import prisma from "@/lib/prisma";
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

import mammoth from 'mammoth';
import PDFParser from 'pdf2json';

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

export interface ExtractedItem {
    type: "QUESTION" | "SECTION" | "INSTRUCTION" | "NOTE";
    originalText: string;
    neutralText?: string;
    masterKey?: string;
    confidence: number;
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

    return processDocumentBuffer(buffer, file.type, file.name);
}

export async function processDocumentBuffer(buffer: Buffer, mimeType: string, fileName: string): Promise<{ content: string, type: "image" | "text", mime: string }> {
    if (!buffer || buffer.length === 0) {
        throw new Error("Document buffer is empty");
    }

    // DOCX Handling
    if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || fileName.endsWith(".docx")) {
        console.log("[AI Mapper] Parsing DOCX via Mammoth: Start");
        try {
            const result = await mammoth.extractRawText({ buffer });
            console.log("[AI Mapper] DOCX Extraction Complete. Length:", result.value.length);
            return {
                content: result.value, // The raw text
                type: "text",
                mime: "text/plain"
            };
        } catch (e) {
            console.error("[AI Mapper] DOCX Extraction Failed:", e);
            throw e; // Re-throw to be caught by caller
        }
    }

    // TEXT Handling
    if (mimeType === "text/plain" || fileName.endsWith(".txt")) {
        return {
            content: buffer.toString('utf-8'),
            type: "text",
            mime: "text/plain"
        };
    }

    // PDF Handling
    if (mimeType === "application/pdf" || fileName.endsWith(".pdf")) {
        console.log("[AI Mapper] Parsing PDF via pdf2json: Start");
        try {
            // @ts-ignore
            const pdfParser = new PDFParser(null, 1);
            console.log("[AI Mapper] PDFParser initialized");

            const text = await new Promise<string>((resolve, reject) => {
                pdfParser.on("pdfParser_dataError", (errData: any) => {
                    console.error("[AI Mapper] PDFParser Data Error event:", errData);
                    reject(errData.parserError)
                });
                pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
                    console.log("[AI Mapper] PDFParser Data Ready event");
                    // getRawTextContent() usually works, but let's check output
                    const raw = pdfParser.getRawTextContent();
                    console.log("[AI Mapper] Raw text length:", raw?.length);
                    resolve(raw);
                });

                console.log("[AI Mapper] Calling parseBuffer, buffer size:", buffer.length);
                pdfParser.parseBuffer(buffer);
            });
            console.log("[AI Mapper] PDF Parsing Complete");
            return { content: text, type: "text", mime: "text/plain" };
        } catch (e) {
            console.error("[AI Mapper] PDF text extraction failed:", e);
            // Fall through to image handling? Or just fail?
            // Let's try image handling as fallback if it was a scanned PDF
        }
    }

    // IMAGE Handling (Vision API) - fallback for Scanned PDFs or actual Images
    const base64 = buffer.toString('base64');
    return {
        content: base64,
        type: "image",
        mime: mimeType
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

// 3. Granular Extraction (Columns 1, 2, 3)
export async function extractQuestionnaireItems(input: { content: string, type: "image" | "text", mime: string }): Promise<ExtractedItem[]> {
    const { content, type, mime } = input;

    // A. Fetch Master Schema
    const masterSchema = await prisma.masterSchema.findFirst({
        where: { isActive: true },
    });
    const fields = (masterSchema?.definition as any)?.fields || [];
    const schemaDesc = fields.map((f: any) => `${f.key} (${f.label})`).join('\n');

    // B. Construct Message
    const userContent: any[] = [
        {
            type: "text",
            text: `Analyze this financial questionnaire document and extract EVERY structural element.
            
            OUTPUT COLUMNS:
            1. Type: "QUESTION" (requires answer), "SECTION" (Header/Title), "INSTRUCTION" (Context/Help), "NOTE" (Disclaimer/Footer).
            2. Original Text: Exact text from document.
            3. Neutral Text (Questions Only): The question re-phrased to be generic (remove "Please provide...", remove numbering "1.2", remove specific formatting).
            4. Master Key (Questions Only): Best guess match from the provided Master Schema list.

            MASTER SCHEMA FIELDS:
            ${schemaDesc}
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
        console.log(`[AI Mapper] Extracting Items (${type} mode)`);

        const { object } = await generateObject({
            model: openai('gpt-4o'),
            schema: z.object({
                items: z.array(z.object({
                    type: z.enum(["QUESTION", "SECTION", "INSTRUCTION", "NOTE"]),
                    originalText: z.string(),
                    neutralText: z.string().optional(),
                    masterKey: z.string().optional(),
                    confidence: z.number()
                }))
            }),
            messages: [{ role: "user", content: userContent }]
        });

        return object.items;
    } catch (e) {
        console.error("[AI Mapper] Extraction Error:", e);
        return [];
    }
}
