"use server";

import prisma from "@/lib/prisma";
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';



export interface ExtractedItem {
    type: "question" | "section" | "instruction" | "note";
    text: string;
    neutralText?: string;
    masterKey?: string;
    masterQuestionGroupId?: string;
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

import { FIELD_GROUPS } from "@/domain/kyc/FieldGroups";
import { FIELD_DEFINITIONS } from "@/domain/kyc/FieldDefinitions";

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

    // B. Construct Message with robust context
    let schemaContext = "";

    // 1. Field Groups
    const groups = Object.values(FIELD_GROUPS);
    if (groups.length > 0) {
        schemaContext += "MASTER FIELD GROUPS (Composite - Prefer these):\n";
        schemaContext += groups.map(g => `- GroupID: "${g.id}" Label: "${g.label}" (Fields: ${g.fieldNos.join(',')})`).join('\n');
        schemaContext += "\n\n";
    }

    // 2. Atomic Fields
    const fields = Object.values(FIELD_DEFINITIONS);
    if (fields.length > 0) {
        schemaContext += "MASTER ATOMIC FIELDS:\n";
        schemaContext += fields.map(f => `- Field ${f.fieldNo} (Key: "${f.fieldNo}"): ${f.fieldName} (${f.dataType}) - ${f.notes || ''}`).join('\n');
        schemaContext += "\n\n";
    } else {
        // Fallback if definitions are missing
        schemaContext += "MASTER FIELDS: No strict schema provided. Please infer best-guess standard KYC field names (e.g. 'legal_name', 'incorporation_date').\n\n";
    }

    // 3. Categories
    schemaContext += `STANDARD CATEGORIES:\n${STANDARD_CATEGORIES.join(', ')}\n`;


    const userContent: any[] = [
        {
            type: "text",
            text: `Extract all structural elements (Questions, Sections, Instructions, Notes) from the provided document content.
            
            CRITICAL MAPPING RULES:
            1. Assign 'category' from the Standard List provided.
            2. Try to map each Question to a Master Field or Group.
            3. PREFER 'masterQuestionGroupId' for composite concepts (Address, Person, UBO).
            4. Use 'masterKey' (Field No) only for atomic fields (Name, Date, Status).
            
            CONTEXT:
            ${schemaContext}`
        }
    ];

    if (type === "text") {
        userContent.push({
            type: "text",
            text: `DOCUMENT CONTENT:\n\n${content}`
        });
    } else {
        // Image Mode
        if (Array.isArray(content)) {
            content.forEach((b64) => {
                userContent.push({
                    type: "image",
                    // @ts-ignore
                    image: `data:${mime};base64,${b64}`
                });
            });
        } else {
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
                    type: z.string().describe("The structural type: question, section, instruction, or note"),
                    text: z.string().describe("The exact text content"),
                    neutralText: z.string().nullable().optional().describe("Neutralized question text (optional)"),
                    masterKey: z.string().nullable().optional().describe("Matching master schema key (Field No) (optional)"),
                    masterQuestionGroupId: z.string().nullable().optional().describe("Matching master field group ID (optional)"),
                    category: z.string().nullable().optional().describe("The standard category for this question (Recommended)"),
                    confidence: z.number().optional().describe("Confidence score 0-1")
                }))
            }),
            messages: [{ role: "user", content: userContent }]
        });

        if (logger) await logger(`AI Response Received. Processing items...`, "AI_RESPONSE");

        // Post-process: Normalize types and handle nulls
        const safeItems = object.items.map(item => {
            let type: any = item.type ? item.type.toLowerCase() : "note";
            if (!["question", "section", "instruction", "note"].includes(type)) {
                type = "note"; // Fallback
                if (item.text.includes("?")) type = "question";
            }

            return {
                ...item,
                type: type as "question" | "section" | "instruction" | "note",
                neutralText: item.neutralText || undefined,
                masterKey: item.masterKey || undefined,
                masterQuestionGroupId: item.masterQuestionGroupId || undefined,
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
    text: string;
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
        .filter(i => i.type === "question")
        .map(i => ({
            text: i.text,
            suggestedKey: i.masterKey,
            confidence: i.confidence || 0
        }));
}

/**
 * Generates a list of questions based on a user prompt.
 */
export async function generateQuestionnaireFromPrompt(prompt: string): Promise<{ success: boolean, questions?: string[], error?: string }> {
    try {
        const key = process.env.OPENAI_API_KEY;
        if (!key) throw new Error("Server Misconfiguration: OPENAI_API_KEY is missing.");

        const openai = createOpenAI({ apiKey: key });

        const { object } = await generateObject({
            model: openai('gpt-4o'),
            schema: z.object({
                questions: z.array(z.string().describe("A single, clear compliance or KYC question"))
            }),
            messages: [
                {
                    role: "system",
                    content: "You are an expert compliance officer and legal analyst specializing in KYC, AML, and regulatory frameworks like MiFID II, GDPR, and local banking regulations."
                },
                {
                    role: "user",
                    content: `Based on the following request, generate a comprehensive list of questions for a questionnaire: \n\n${prompt}\n\nReturn only the questions.`
                }
            ]
        });

        return { success: true, questions: object.questions };
    } catch (e: any) {
        console.error("[generateQuestionnaireFromPrompt]", e);
        return { success: false, error: e.message };
    }
}
