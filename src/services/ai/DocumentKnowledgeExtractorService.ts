
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { ExtractResult } from "@/services/ingestion/DocumentIngestionService";

// --- Schema Definitions ---

const KnowledgeExtractionSchema = z.object({
    documentType: z.string().describe("The specific type of document (e.g. 'Certificate of Incorporation', 'ISDA Schedule', 'Passport')"),
    summary: z.string().describe("A concise 1-sentence summary of the document's purpose."),
    entities: z.array(z.object({
        name: z.string(),
        role: z.string().describe("Role in the document e.g. 'Issuer', 'Director', 'Lender'")
    })).describe("Organizations or Individuals mentioned in the document with their roles."),
    dates: z.array(z.object({
        date: z.string().describe("ISO 8601 date string if possible, or raw text"),
        label: z.string().describe("What this date represents e.g. 'Effective Date', 'Expiry Date'")
    })).describe("Critical dates found in the document."),
    keyFacts: z.array(z.object({
        label: z.string(),
        value: z.string()
    })).describe("Important reference numbers (Tax ID, Registration No), monetary amounts, or governing laws.")
});

export type KnowledgeExtractionResult = z.infer<typeof KnowledgeExtractionSchema>;

export class DocumentKnowledgeExtractorService {
    private openai = createOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    /**
     * Core Extraction Method
     */
    async extract(result: ExtractResult): Promise<KnowledgeExtractionResult> {

        // Strategy Selection: 
        // If vision was forced by ingestion (scanned PDF), we use a slightly different prompt context.
        const contextModifier = result.strategy === 'vision'
            ? "NOTE: The text was extracted via partial OCR from a scanned document. It may contain errors. Infer the correct values where possible."
            : "";

        const { object } = await generateObject({
            model: this.openai('gpt-4o'),
            schema: KnowledgeExtractionSchema,
            messages: [
                {
                    role: "system",
                    content: `You are an expert Legal and Compliance Analyst.
                    Your job is to extract Structured Knowledge from the provided document text.
                    
                    ${contextModifier}
                    

                    GUIDELINES:
                    1. BE PRECISE. Do not hallucinate. If a fact is not present, do not invent it.
                    2. ENTITIES: Identify the key parties involved.
                    3. DATES: Extract operational dates (Start, End, Signing).
                    4. FACTS: Look for Registration Numbers, Jurisdictions, Governing Laws, and Financial Limits.
                    5. SUMMARY: Provide a professional one-sentence summary.
                    `
                },
                {
                    role: "user",
                    content: `DOCUMENT TEXT (${result.mime} - Truncated for Analysis):\n\n${this.smartTruncate(result.text)}`
                }
            ]
        });

        return object;
    }

    /**
     * Smart Truncation Strategy to control LLM costs.
     * Limit: ~32k characters (~8k tokens).
     * Logic: Keep the START (Context/Parties) and END (Signatures/Schedules).
     */
    private smartTruncate(text: string): string {
        const MAX_CHARS = 32000;
        if (text.length <= MAX_CHARS) return text;

        const startChunk = 25000;
        const endChunk = 5000;

        return `${text.substring(0, startChunk)}\n\n... [${text.length - MAX_CHARS} characters omitted for brevity] ...\n\n${text.substring(text.length - endChunk)}`;
    }
}
