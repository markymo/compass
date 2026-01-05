"use server";

import prisma from "@/lib/prisma";
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

import mammoth from 'mammoth';
import PDFParser from 'pdf2json';

// Helper for debugging
import fs from 'fs';
import path from 'path';

function logToFile(msg: string, data?: any) {
    try {
        const logPath = path.resolve(process.cwd(), 'debug-server-log.txt');
        const timestamp = new Date().toISOString();
        const content = `[${timestamp}] ${msg} ${data ? JSON.stringify(data, null, 2) : ''}\n`;
        fs.appendFileSync(logPath, content);
    } catch (e) {
        // ignore logging errors
    }
}

// Ensure API Key is loaded
let apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
    logToFile("[AI Mapper] OPENAI_API_KEY missing in process.env. Attempting manual load.");
    const envFiles = ['.env.local', '.env'];

    for (const file of envFiles) {
        try {
            const envPath = path.resolve(process.cwd(), file);
            if (fs.existsSync(envPath)) {
                logToFile(`[AI Mapper] Found ${file}`);
                const content = fs.readFileSync(envPath, 'utf-8');
                const match = content.match(/OPENAI_API_KEY=(.+)/);
                if (match && match[1]) {
                    apiKey = match[1].trim().replace(/^["']|["']$/g, '');
                    process.env.OPENAI_API_KEY = apiKey;
                    logToFile(`[AI Mapper] Loaded API Key from ${file}`);
                    break;
                }
            }
        } catch (e) {
            logToFile(`[AI Mapper] Failed to read ${file}`, e);
        }
    }
}

if (!apiKey) {
    logToFile("[AI Mapper] CRITICAL: API Key still missing after manual search.");
} else {
    logToFile("[AI Mapper] API Key is present (length: " + apiKey.length + ")");
}

const openai = createOpenAI({
    apiKey: apiKey,
});

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
    category?: string;
    confidence: number;
}

// 1. Process Document: Convert to Base64 (Images/PDF) or Text (Docx/Txt)
export async function parseDocument(formData: FormData): Promise<{ content: string, type: "image" | "text", mime: string }> {
    const file = formData.get("file") as File;
    if (!file) {
        throw new Error("No file uploaded");
    }

    logToFile(`[AI Mapper] Processing file: ${file.name} (${file.type}, ${file.size} bytes)`);

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
        logToFile("[AI Mapper] Parsing DOCX via Mammoth: Start");
        try {
            const result = await mammoth.extractRawText({ buffer });
            logToFile(`[AI Mapper] DOCX Extraction Complete. Length: ${result.value.length}`);
            return {
                content: result.value, // The raw text
                type: "text",
                mime: "text/plain"
            };
        } catch (e) {
            logToFile("[AI Mapper] DOCX Extraction Failed:", e);
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
            if (!text || text.trim().length < 50) {
                console.log("[AI Mapper] PDF text is empty or too short. Assuming scanned PDF. Falling back to Vision.");
                throw new Error("Scanned PDF");
            }
            console.log("[AI Mapper] PDF Parsing Complete");
            return { content: text, type: "text", mime: "text/plain" };
        } catch (e: any) {
            console.error("[AI Mapper] PDF text extraction failed:", e);
            if (e.message === "Scanned PDF") {
                throw new Error("The PDF appears to be a scanned image. Please provide a text-selectable PDF or a Word document.");
            }
            throw new Error("Failed to parse PDF text. Please try converting to Word.");
        }
    }

    // IMAGE Handling (Vision API) - fallback for Scanned PDFs or actual Images
    // Note: OpenAI Vision only supports images (jpg, png), not PDF.
    if (mimeType === "application/pdf") {
        throw new Error("The PDF appears to be a scanned image (text extraction failed). Image-based PDFs are not currently supported without OCR.");
    }

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

import { STANDARD_CATEGORIES } from "@/lib/constants";

// 3. Granular Extraction (Columns 1, 2, 3)
export async function extractQuestionnaireItems(input: { content: string, type: "image" | "text", mime: string }): Promise<ExtractedItem[]> {
    const { content, type, mime } = input;

    if (!content || content.trim().length === 0) {
        throw new Error(`Extraction failed: No text content found in document (MIME: ${mime}). The file might be empty or scanned/image-based without OCR.`);
    }

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
            5. Category (Questions Only): IF no Master Key matches, assign a category from the list below.

            MASTER SCHEMA FIELDS:
            ${schemaDesc}

            STANDARD CATEGORIES:
            ${STANDARD_CATEGORIES.join(', ')}
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
        logToFile(`[AI Mapper] Extracting Items (${type} mode)`);

        const { object } = await generateObject({
            model: openai('gpt-4o'),
            schema: z.object({
                items: z.array(z.object({
                    type: z.enum(["QUESTION", "SECTION", "INSTRUCTION", "NOTE"]).describe("The structural type of the item"),
                    originalText: z.string().describe("The exact text content"),
                    neutralText: z.string().optional().describe("Neutralized question text (optional for non-questions)"),
                    masterKey: z.string().optional().describe("Matching master schema key (optional)"),
                    category: z.string().optional().describe("Fallback category if no master key matches"),
                    confidence: z.number().optional().describe("Confidence score 0-1")
                }))
            }),
            messages: [{ role: "user", content: userContent }]
        });

        // Post-process: handling nulls if necessary
        const safeItems = object.items.map(item => ({
            ...item,
            neutralText: item.neutralText || undefined,
            masterKey: item.masterKey || undefined,
            category: item.category || undefined,
            confidence: item.confidence ?? 0
        }));

        logToFile(`[AI Mapper] Extraction Success. Found ${safeItems.length} items.`);
        return safeItems;
    } catch (e: any) {
        logToFile("[AI Mapper] Extraction Error:", e);
        console.error("[AI Mapper] Extraction Error:", e);
        if (e.cause) logToFile("[AI Mapper] Error Cause:", e.cause);
        throw e;
    }
}
