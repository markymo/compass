"use server";

import prisma from "@/lib/prisma";
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';



export interface ExtractedItem {
    type: "QUESTION" | "SECTION" | "INSTRUCTION" | "NOTE";
    originalText: string;
    neutralText?: string;
    masterKey?: string;
    category?: string;
    confidence: number;
    answer?: string;
    order?: number;
}

import { STANDARD_CATEGORIES } from "@/lib/constants";
import mammoth from 'mammoth';
import PDFParser from 'pdf2json';

// 1. Process Document: Convert to Base64 (Images/PDF) or Text (Docx/Txt)
export async function parseDocument(formData: FormData): Promise<{ content: string | string[], type: "image" | "text", mime: string }> {
    const file = formData.get("file") as File;
    if (!file) throw new Error("No file uploaded");
    console.log(`[AI Mapper] Processing file: ${file.name}`);
    const buffer = Buffer.from(await file.arrayBuffer());
    return processDocumentBuffer(buffer, file.type, file.name);
}

export async function processDocumentBuffer(buffer: Buffer, mimeType: string, fileName: string): Promise<{ content: string | string[], type: "image" | "text", mime: string }> {
    if (!buffer || buffer.length === 0) throw new Error("Document buffer is empty");

    // DOCX
    if (mimeType.includes("wordprocessingml") || fileName.endsWith(".docx")) {
        console.log("[AI Mapper] Parsing DOCX via Mammoth");
        const result = await mammoth.extractRawText({ buffer });
        return { content: result.value, type: "text", mime: "text/plain" };
    }

    // TEXT
    if (mimeType === "text/plain" || fileName.endsWith(".txt")) {
        return { content: buffer.toString('utf-8'), type: "text", mime: "text/plain" };
    }

    // PDF
    if (mimeType === "application/pdf" || fileName.endsWith(".pdf")) {
        console.log("[AI Mapper] Parsing PDF via pdf2json");
        try {
            // @ts-ignore
            const pdfParser = new PDFParser(null, 1);
            const text = await new Promise<string>((resolve, reject) => {
                pdfParser.on("pdfParser_dataError", (errData: any) => reject(errData.parserError));
                pdfParser.on("pdfParser_dataReady", () => resolve(pdfParser.getRawTextContent()));
                pdfParser.parseBuffer(buffer);
            });

            // Check if Scanned
            const cleanedText = text.replace(/----------------Page \(\d+\) Break----------------/g, "").trim();
            if (!text || cleanedText.length < 100) {
                console.log("[AI Mapper] PDF text extraction yielded empty/short text. Likely Scanned.");
                // THROW SPECIFIC ERROR for Client-Side Fallback
                throw new Error("SCANNED_PDF_DETECTED");
            }
            return { content: text, type: "text", mime: "text/plain" };
        } catch (e: any) {
            console.error("[AI Mapper] PDF Parse Error:", e);
            if (e.message === "SCANNED_PDF_DETECTED") throw e;
            // Other errors
            throw new Error("Failed to parse PDF text.");
        }
    }

    // Fallback: Treat as Image? No, without GS we can't generic convert. 
    // Just return as base64 and hope Vision can read it? (No, Vision needs image/png not application/pdf)

    throw new Error(`Unsupported file type: ${mimeType}`);
}
export async function extractQuestionnaireItems(input: { content: string | string[], type: "image" | "text", mime: string }): Promise<ExtractedItem[]> {
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
            text: `Extract all structural elements (Questions, Sections, Instructions, Notes) from the provided document content.
            
            RULES FOR QUESTIONS:
            1. EVERY Question MUST be assigned one of the STANDARD CATEGORIES. This is MANDATORY.
            2. If a question specifically matches a MASTER SCHEMA FIELD, assign the Master Key as well.
            3. Priority: Categorization is CRITICAL for UI grouping. Master Mapping is secondary but important for automation.

            OUTPUT COLUMNS:
            1. Type: "QUESTION", "SECTION", "INSTRUCTION", "NOTE".
            2. Original Text: Exact text from document.
            3. Neutral Text (Questions Only): The question re-phrased to be generic.
            4. Master Key (Questions Only): Best guess match from the provided Master Schema list (Optional).
            5. Category (Questions Only): The standard category this question belongs to (MANDATORY).
 
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
        // Image Mode (Single or Multiple)
        if (Array.isArray(content)) {
            // Multiple images (e.g. Scanned PDF pages)
            content.forEach((b64) => {
                userContent.push({
                    type: "image",
                    // @ts-ignore
                    image: `data:${mime};base64,${b64}`
                });
            });
        } else {
            // Single image
            userContent.push({
                type: "image",
                // @ts-ignore
                image: `data:${mime};base64,${content}`
            });
        }
    }

    try {
        const key = process.env.OPENAI_API_KEY;
        console.log(`[AI Mapper] Server Action Start. API Key present: ${!!key}. Length: ${key ? key.length : 0}`);

        if (!key) {
            console.error("[AI Mapper] CRITICAL: OPENAI_API_KEY is undefined in process.env");
            // Check debug info
            console.log("[AI Mapper] Env Keys:", Object.keys(process.env).filter(k => k.includes("OPENAI")));
            throw new Error("Server Misconfiguration: OPENAI_API_KEY is missing.");
        }

        const openai = createOpenAI({
            apiKey: key,
        });

        console.log(`[AI Mapper] Extracting Items (${type} mode). Input length: ${Array.isArray(content) ? content.length + " pages" : content.length + " chars"}`);

        const { object } = await generateObject({
            model: openai('gpt-4o'),

            // @ts-ignore
            mode: 'json',
            schemaName: 'extracted_questionnaire_items',
            schemaDescription: 'A list of all questions, sections, and notes extracted from the document',
            schema: z.object({
                items: z.array(z.object({
                    type: z.string().describe("The structural type: QUESTION, SECTION, INSTRUCTION, or NOTE"),
                    originalText: z.string().describe("The exact text content"),
                    neutralText: z.string().optional().describe("Neutralized question text (optional)"),
                    masterKey: z.string().optional().describe("Matching master schema key (optional)"),
                    category: z.string().describe("The standard category for this question (MANDATORY for Questions)"),
                    confidence: z.number().optional().describe("Confidence score 0-1")
                }))
            }),
            messages: [{ role: "user", content: userContent }]
        });

        // Post-process: Normalize types and handle nulls
        const safeItems = object.items.map(item => {
            let type: any = item.type ? item.type.toUpperCase() : "NOTE";
            if (!["QUESTION", "SECTION", "INSTRUCTION", "NOTE"].includes(type)) {
                type = "NOTE"; // Fallback
                if (item.originalText.includes("?")) type = "QUESTION";
            }

            return {
                ...item,
                type: type as "QUESTION" | "SECTION" | "INSTRUCTION" | "NOTE",
                neutralText: item.neutralText || undefined,
                masterKey: item.masterKey || undefined,
                category: item.category || undefined,
                confidence: item.confidence ?? 0,
                order: 0 // Will be populated by index
            };
        }).map((item, idx) => ({ ...item, order: idx + 1 }));

        console.log(`[AI Mapper] Extraction Success. Found ${safeItems.length} items.`);
        return safeItems;
    } catch (e: any) {
        console.log("[AI Mapper] Extraction Error:", e);
        console.error("[AI Mapper] Extraction Error:", e);
        if (e.cause) console.log("[AI Mapper] Error Cause:", e.cause);
        throw e;
    }
}

export interface MappingSuggestion {
    originalText: string;
    suggestedKey?: string;
    confidence: number;
    newFieldProposal?: {
        key: string;
        label: string;
        type: string;
        description: string;
    };
}

export async function generateMappingSuggestions(input: { content: string | string[], type: "image" | "text", mime: string }): Promise<MappingSuggestion[]> {
    const items = await extractQuestionnaireItems(input);
    return items
        .filter(i => i.type === "QUESTION")
        .map(i => ({
            originalText: i.originalText,
            suggestedKey: i.masterKey,
            confidence: i.confidence || 0
        }));
}
