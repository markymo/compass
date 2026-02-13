
import { generateObject, generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod'; // Import z from zod directly
import { DocumentIngestionService, ExtractResult } from "@/services/ingestion/DocumentIngestionService";
import { FIELD_DEFINITIONS, FieldDefinition } from "@/domain/kyc/FieldDefinitions";
import { getAllFieldGroups } from "@/domain/kyc/FieldGroups";
import { STANDARD_CATEGORIES } from "@/lib/constants";

// --- Schema Definitions ---

const QuestionnaireItemSchema = z.object({
    type: z.enum(["question", "section", "instruction", "note"]),
    text: z.string(),
    // Optional Mapping Candidates
    masterFieldNo: z.number().nullable().optional().describe("If this matches a single Master Field (e.g. Legal Name), provide the Field No."),
    masterQuestionGroupId: z.string().nullable().optional().describe("If this matches a Field Group (e.g. Address), provide the Group ID."),
    category: z.string().optional().describe("One of the Standard Compliance Categories."),
    confidence: z.number().optional()
});

export type QuestionnaireItem = z.infer<typeof QuestionnaireItemSchema>;

const ExtractionResponseSchema = z.object({
    items: z.array(QuestionnaireItemSchema)
});


export class QuestionnaireExtractorService {
    private openai = createOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    /**
     * Core Extraction Method
     */
    async extract(
        ingestionResult: ExtractResult,
        legalEntityId: string // Context, though maybe not needed for raw extraction
    ): Promise<QuestionnaireItem[]> {

        const context = this.buildSchemaContext();

        if (ingestionResult.strategy === 'vision') {
            return this.extractFromVision(ingestionResult, context);
        } else {
            return this.extractFromText(ingestionResult, context);
        }
    }

    private async extractFromText(result: ExtractResult, schemaContext: string): Promise<QuestionnaireItem[]> {
        const { object } = await generateObject({
            model: this.openai('gpt-4o'),
            schema: ExtractionResponseSchema,
            messages: [
                {
                    role: "system",
                    content: `You are an expert KYC Analyst. 
                    Extract the structure of the questionnaire from the text provided.
                    
                    CRITICAL MAPPING RULES:
                    1. Assign 'category' from the Standard List provided.
                    2. Try to map each Question to a Master Field or Group.
                    3. PREFER 'masterQuestionGroupId' for composite concepts (Address, Person, UBO).
                    4. Use 'masterFieldNo' only for atomic fields (Name, Date, Status).
                    
                    Returns valid JSON only.`
                },
                {
                    role: "user",
                    content: `
                    ${schemaContext}

                    --- DOCUMENT CONTENT ---
                    ${result.text.substring(0, 100000)} // Truncate safety for massive files
                    `
                }
            ]
        });

        return object.items;
    }

    private async extractFromVision(result: ExtractResult, schemaContext: string): Promise<QuestionnaireItem[]> {
        // NOTE: In a real implementation with PDF-to-Image conversion, 
        // 'result' would contain image buffers. 
        // For the scope of this refactor, we are assuming the caller (Server Action) 
        // might have handled the buffer-to-image conversion or we do it here.
        // Since 'DocumentIngestionService' currently just returns 'Pages', 
        // we might need to actually pass the raw buffer to this service if we want to extract images on the fly, 
        // OR have the ingestion service return image buffers.

        // For strictly "ChatGPT-style", we need the images.
        // Let's assume for now we fallback to "Best Effort Text" if image buffers aren't ready,
        // OR we throw an error saying "Vision pipeline requires Image Buffer support".

        // To Unblock: we will try to use the text we *did* extract (even if poor) 
        // but prompt the AI that it might be OCR garbage and it should try its best.
        // *Real* Vision support requires 'pdf-img-convert' or similar which creates heavy dependencies.

        console.warn("[Extractor] Vision strategy requested. Using text-fallback with 'Repair' prompt for now.");

        const { object } = await generateObject({
            model: this.openai('gpt-4o'),
            schema: ExtractionResponseSchema,
            messages: [
                {
                    role: "system",
                    content: `You are an expert KYC Analyst. 
                    The provided text comes from a POOR QUALITY SCAN (OCR). 
                    It may contain typos, artifacts, or garbage.
                    
                    Your job is to RECONSTRUCT the questions and structure.
                    
                    ${schemaContext}`
                },
                {
                    role: "user",
                    content: `OCR TEXT CONTENT:\n\n${result.text}`
                }
            ]
        });

        return object.items;
    }

    private buildSchemaContext(): string {
        // 1. Categories
        const categories = STANDARD_CATEGORIES.join(", ");

        // 2. Field Groups (Summarized)
        const groups = getAllFieldGroups().map(g =>
            `- GroupID: "${g.id}" Label: "${g.label}" (Fields: ${g.fieldNos.join(',')})`
        ).join("\n");

        // 3. Definitions (Summarized - just key/label to save tokens)
        const fields = Object.values(FIELD_DEFINITIONS).map((f: FieldDefinition) =>
            `- Field ${f.fieldNo}: ${f.fieldName} (${f.dataType})`
        ).join("\n");

        return `
        STANDARD CATEGORIES:
        ${categories}

        MASTER FIELD GROUPS (Composite - Prefer these):
        ${groups}

        MASTER ATOMIC FIELDS:
        ${fields}
        `;
    }
}
