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

// LOGGING INTERFACE
type Logger = (message: string, stage?: string, level?: "INFO" | "ERROR" | "SUCCESS") => Promise<void>;

// 1. Process Document: Convert to Base64 (Images/PDF) or Text (Docx/Txt)
export async function parseDocument(formData: FormData, logger?: Logger): Promise<{ content: string | string[], type: "image" | "text", mime: string }> {
    const file = formData.get("file") as File;
    if (!file) throw new Error("No file uploaded");
    if (logger) await logger(`Processing file: ${file.name} (${file.type})`, "FILE_DETECT");
    const buffer = Buffer.from(await file.arrayBuffer());
    return processDocumentBuffer(buffer, file.type, file.name, logger);
}

export async function processDocumentBuffer(buffer: Buffer, mimeType: string, fileName: string, logger?: Logger): Promise<{ content: string | string[], type: "image" | "text", mime: string }> {
    if (!buffer || buffer.length === 0) throw new Error("Document buffer is empty");

    if (logger) await logger(`Analyzing buffer: ${(buffer.length / 1024).toFixed(2)} KB`, "BUFFER_ANALYSIS");

    // DOCX
    if (mimeType.includes("wordprocessingml") || fileName.endsWith(".docx")) {
        if (logger) await logger("Detected DOCX format. Using Mammoth parser.", "PARSER_SELECT");
        const result = await mammoth.extractRawText({ buffer });
        if (logger) await logger(`DOCX Text Extracted. Length: ${result.value.length} chars`, "TEXT_EXTRACT", "SUCCESS");
        return { content: result.value, type: "text", mime: "text/plain" };
    }

    // TEXT
    if (mimeType === "text/plain" || fileName.endsWith(".txt")) {
        if (logger) await logger("Detected Plain Text.", "PARSER_SELECT");
        return { content: buffer.toString('utf-8'), type: "text", mime: "text/plain" };
    }

    // PDF
    if (mimeType === "application/pdf" || fileName.endsWith(".pdf")) {
        if (logger) await logger("Detected PDF format. Using pdf2json parser.", "PARSER_SELECT");
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
            if (logger) await logger(`PDF Text Extracted. Raw Length: ${text.length} chars`, "TEXT_EXTRACT");

            if (!text || cleanedText.length < 100) {
                if (logger) await logger("Text too short. Probably a Scanned PDF.", "SCANNED_DETECT", "ERROR");
                throw new Error("SCANNED_PDF_DETECTED");
            }

            if (logger) await logger("PDF Text Validation Passed.", "TEXT_EXTRACT", "SUCCESS");
            return { content: text, type: "text", mime: "text/plain" };
        } catch (e: any) {
            console.error("[AI Mapper] PDF Parse Error:", e);
            if (logger) await logger(`PDF Parse Error: ${e.message}`, "TEXT_EXTRACT", "ERROR");
            if (e.message === "SCANNED_PDF_DETECTED") throw e;
            throw new Error("Failed to parse PDF text.");
        }
    }

    throw new Error(`Unsupported file type: ${mimeType}`);
}

export async function extractQuestionnaireItems(input: { content: string | string[], type: "image" | "text", mime: string }, logger?: Logger): Promise<ExtractedItem[]> {
    const { content, type, mime } = input;

    if (logger) await logger(`Preparing AI Extraction Context. Mode: ${type}`, "AI_PREP");

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
        if (logger) await logger("Calling OpenAI API...", "AI_CALL");

        if (!key) {
            if (logger) await logger("CRITICAL: Missing API Key", "AI_CALL", "ERROR");
            throw new Error("Server Misconfiguration: OPENAI_API_KEY is missing.");
        }

        const openai = createOpenAI({
            apiKey: key,
        });

        const { object } = await generateObject({
            model: openai('gpt-4o'),

            // @ts-ignore
            mode: 'tool',
            schemaName: 'extracted_questionnaire_items',
            schemaDescription: 'A list of all questions, sections, and notes extracted from the document',
            schema: z.object({
                items: z.array(z.object({
                    type: z.string().describe("The structural type: QUESTION, SECTION, INSTRUCTION, or NOTE"),
                    originalText: z.string().describe("The exact text content"),
                    neutralText: z.string().nullable().optional().describe("Neutralized question text (optional)"),
                    masterKey: z.string().nullable().optional().describe("Matching master schema key (optional)"),
                    category: z.string().nullable().optional().describe("The standard category for this question (Recommended)"),
                    confidence: z.number().optional().describe("Confidence score 0-1")
                }))
            }),
            messages: [{ role: "user", content: userContent }]
        });

        if (logger) await logger(`AI Response Received. Processing items...`, "AI_RESPONSE");

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

        if (logger) await logger(`Extraction Complete. Found ${safeItems.length} items.`, "COMPLETE", "SUCCESS");
        return safeItems;
    } catch (e: any) {
        console.error("[AI Mapper] Extraction Error:", e);
        if (logger) await logger(`Extraction Error: ${e.message}`, "AI_ERROR", "ERROR");
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
    const items = await extractQuestionnaireItems(input); // Add logger here if we expose it?
    return items
        .filter(i => i.type === "QUESTION")
        .map(i => ({
            originalText: i.originalText,
            suggestedKey: i.masterKey,
            confidence: i.confidence || 0
        }));
}
