"use server";

import prisma from "@/lib/prisma";
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

import mammoth from 'mammoth';
import PDFParser from 'pdf2json';



import fs from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);



// Ensure API Key is loaded
let apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
    console.log("[AI Mapper] OPENAI_API_KEY missing in process.env. Attempting manual load.");
    const envFiles = ['.env.local', '.env'];

    for (const file of envFiles) {
        try {
            const envPath = path.resolve(process.cwd(), file);
            if (fs.existsSync(envPath)) {
                console.log(`[AI Mapper] Found ${file}`);
                const content = fs.readFileSync(envPath, 'utf-8');
                const match = content.match(/OPENAI_API_KEY=(.+)/);
                if (match && match[1]) {
                    apiKey = match[1].trim().replace(/^["']|["']$/g, '');
                    process.env.OPENAI_API_KEY = apiKey;
                    console.log(`[AI Mapper] Loaded API Key from ${file}`);
                    break;
                }
            }
        } catch (e) {
            console.log(`[AI Mapper] Failed to read ${file}`, e);
        }
    }
}

if (!apiKey) {
    console.log("[AI Mapper] CRITICAL: API Key still missing after manual search.");
} else {
    console.log("[AI Mapper] API Key is present (length: " + apiKey.length + ")");
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
    answer?: string;
}

// 1. Process Document: Convert to Base64 (Images/PDF) or Text (Docx/Txt)
export async function parseDocument(formData: FormData): Promise<{ content: string | string[], type: "image" | "text", mime: string }> {
    const file = formData.get("file") as File;
    if (!file) {
        throw new Error("No file uploaded");
    }

    console.log(`[AI Mapper] Processing file: ${file.name} (${file.type}, ${file.size} bytes)`);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return processDocumentBuffer(buffer, file.type, file.name);
}

export async function processDocumentBuffer(buffer: Buffer, mimeType: string, fileName: string): Promise<{ content: string | string[], type: "image" | "text", mime: string }> {
    if (!buffer || buffer.length === 0) {
        throw new Error("Document buffer is empty");
    }

    // DOCX Handling
    if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || fileName.endsWith(".docx")) {
        console.log("[AI Mapper] Parsing DOCX via Mammoth: Start");
        try {
            const result = await mammoth.extractRawText({ buffer });
            console.log(`[AI Mapper] DOCX Extraction Complete. Length: ${result.value.length}`);
            return {
                content: result.value, // The raw text
                type: "text",
                mime: "text/plain"
            };
        } catch (e) {
            console.log("[AI Mapper] DOCX Extraction Failed:", e);
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

            // Clean up pdf2json artifacts to check for real text
            const cleanedText = text.replace(/----------------Page \(\d+\) Break----------------/g, "").trim();
            console.log("[AI Mapper] Cleaned text length:", cleanedText.length);

            if (!text || cleanedText.length < 100) {
                console.log("[AI Mapper] PDF text is empty or too short (after cleanup). Assuming scanned PDF. Falling back to Vision.");
                throw new Error("Scanned PDF");
            }
            console.log("[AI Mapper] PDF Parsing Complete");
            return { content: text, type: "text", mime: "text/plain" };
        } catch (e: any) {
            console.error("[AI Mapper] PDF text extraction failed:", e);

            // Fallback for Scanned PDF -> Convert to Images
            console.log("[AI Mapper] Attempting to convert PDF to images (OCR fallback)...");
            try {
                // Use Ghostscript for conversion
                console.log("[AI Mapper] Using Ghostscript...");
                const images = await convertPdfToImagesGs(buffer);

                console.log(`[AI Mapper] GS converted PDF to ${images.length} images.`);

                const base64Images = images.map((img) => img.toString('base64'));

                return {
                    content: base64Images,
                    type: "image",
                    mime: "image/png"
                };
            } catch (imgError) {
                console.error("[AI Mapper] PDF to Image conversion failed:", imgError);
                throw new Error("Failed to process PDF. It appears to be scanned, and image conversion failed.");
            }
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
export async function generateMappingSuggestions(input: { content: string | string[], type: "image" | "text", mime: string }): Promise<MappingSuggestion[]> {
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
export async function extractQuestionnaireItems(input: { content: string | string[], type: "image" | "text", mime: string }): Promise<ExtractedItem[]> {
    const { content, type, mime } = input;

    if (!content || (typeof content === 'string' && content.trim().length === 0) || (Array.isArray(content) && content.length === 0)) {
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
            text: `Extract all structural elements (Questions, Sections, Instructions, Notes) from the provided document content.
            
            OUTPUT COLUMNS:
            1. Type: "QUESTION", "SECTION", "INSTRUCTION", "NOTE".
            2. Original Text: Exact text from document.
            3. Neutral Text (Questions Only): The question re-phrased to be generic.
            4. Master Key (Questions Only): Best guess match from the provided Master Schema list.
            5. Category (Questions Only): Assign a category from the list.
 
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
        console.log(`[AI Mapper] Extracting Items (${type} mode)`);

        const { object } = await generateObject({
            model: openai('gpt-4o'),

            // @ts-ignore
            mode: 'json',
            schemaName: 'extracted_questionnaire_items',
            schemaDescription: 'A list of all questions, sections, and notes extracted from the document',
            schema: z.object({
                items: z.array(z.object({
                    type: z.enum(["QUESTION", "SECTION", "INSTRUCTION", "NOTE"]).describe("The structural type of the item"),
                    originalText: z.string().describe("The exact text content"),
                    neutralText: z.string().nullish().describe("Neutralized question text (optional for non-questions)"),
                    masterKey: z.string().nullish().describe("Matching master schema key (optional)"),
                    category: z.string().nullish().describe("Fallback category if no master key matches"),
                    confidence: z.number().nullish().describe("Confidence score 0-1")
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

        console.log(`[AI Mapper] Extraction Success. Found ${safeItems.length} items.`);
        return safeItems;
    } catch (e: any) {
        console.log("[AI Mapper] Extraction Error:", e);
        console.error("[AI Mapper] Extraction Error:", e);
        if (e.cause) console.log("[AI Mapper] Error Cause:", e.cause);
        throw e;
    }
}

async function convertPdfToImagesGs(buffer: Buffer): Promise<Buffer[]> {
    const tmpDir = os.tmpdir();
    const runId = Math.random().toString(36).substring(7);
    const workDir = path.join(tmpDir, `compass-ocr-${runId}`);

    await fsPromises.mkdir(workDir, { recursive: true });

    const inputPath = path.join(workDir, 'input.pdf');
    const outputPrefix = path.join(workDir, 'output-%03d.png');

    try {
        await fsPromises.writeFile(inputPath, buffer);

        // Run Ghostscript
        // -r150 is usually enough for OCR (Tradeoff: Size vs Quality). 
        // -sDEVICE=png16m for 24-bit color PNG.
        const cmd = `gs -dSAFER -dBATCH -dNOPAUSE -sDEVICE=png16m -r150 -sOutputFile="${outputPrefix}" "${inputPath}"`;
        // console.log("[GS Command]", cmd);

        await execAsync(cmd);

        // Read files
        const files = await fsPromises.readdir(workDir);
        const pngs = files.filter(f => f.startsWith('output-') && f.endsWith('.png')).sort();

        const buffers = [];
        for (const file of pngs) {
            const b = await fsPromises.readFile(path.join(workDir, file));
            buffers.push(b);
        }
        return buffers;

    } finally {
        // Cleanup
        try {
            await fsPromises.rm(workDir, { recursive: true, force: true });
        } catch (e) {
            console.error("Cleanup failed:", e);
        }
    }
}
