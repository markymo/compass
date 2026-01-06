"use server";

import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

// Ensure API Key is loaded (Reusing logic from ai-mapper if needed, or just relying on process.env)
const apiKey = process.env.OPENAI_API_KEY;
const openai = createOpenAI({
    apiKey: apiKey,
});

export interface SuggestedAnswer {
    questionId: string; // The ID from the extractedContent array
    suggestedAnswer: string;
    confidence: number;
    sourceQuote: string;
    reasoning: string;
}

export async function generateAnswers(leId: string, questionnaireId: string): Promise<{ success: boolean; data?: SuggestedAnswer[]; error?: string }> {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Unauthorized" };

    try {
        // 1. Fetch Standing Data for the Client LE
        const standingDataSections = await prisma.standingDataSection.findMany({
            where: { clientLEId: leId }
        });

        if (standingDataSections.length === 0) {
            return { success: false, error: "No Standing Data found. Please fill out your Knowledge Base first." };
        }

        // Format Standing Data for the AI
        const contextText = standingDataSections.map(section =>
            `SECTION: ${section.category}\nCONTENT:\n${section.content}\n`
        ).join("\n---\n");


        // 2. Fetch Questionnaire Content
        const questionnaire = await prisma.questionnaire.findUnique({
            where: { id: questionnaireId },
            select: { extractedContent: true, name: true }
        });

        if (!questionnaire || !questionnaire.extractedContent) {
            return { success: false, error: "Questionnaire content not found. Please ensure it has been extracted." };
        }

        const items = questionnaire.extractedContent as any[];
        // Filter for only items that are "QUESTION"
        const questions = items.filter((item: any) => item.type === "QUESTION");

        if (questions.length === 0) {
            return { success: false, error: "No questions found in this document." };
        }

        // Optimize: If too many questions, we might need to batch this. 
        // For now, let's try sending them all (assuming < 50-100 questions).
        // We'll map them to a simplified format to save tokens.
        const simplifiedQuestions = questions.map((q: any, index: number) => ({
            id: q.originalText.substring(0, 20) + "_" + index, // Generate a temp ID if one doesn't exist. Ideally extractedContent has IDs.
            text: q.originalText,
            category: q.category
        }));

        // Note: The extractedContent doesn't strictly have stable IDs unless we added them. 
        // We really should rely on index or generate IDs during extraction. 
        // For now, let's trust the AI to return the array in order or key off the text if unique.
        // BETTER APPROACH: Add an 'id' during extraction or just use the array index.
        // Let's use the array index in the prompt to map back.

        const questionsPrompt = questions.map((q: any, i: number) =>
            `ID: ${i}\nQuestion: ${q.originalText}\nCategory: ${q.category || "General"}`
        ).join("\n\n");

        // 3. Prompt the AI
        console.log(`[AutoFill] Generating answers for ${questions.length} questions for LE ${leId}`);

        const { object } = await generateObject({
            model: openai('gpt-4o'),
            schema: z.object({
                answers: z.array(z.object({
                    questionIndex: z.number().describe("The numeric ID of the question provided in the input"),
                    answer: z.string().describe("The answer to the question based ONLY on the Standing Data"),
                    confidence: z.number().min(0).max(1).describe("Confidence score. 1.0 = Exact match in data. 0.1 = Wild guess."),
                    sourceQuote: z.string().describe("Verbatim quote from the Standing Data that supports this answer"),
                    reasoning: z.string().describe("Brief explanation of why this answer was chosen")
                }))
            }),
            messages: [
                {
                    role: "system",
                    content: `You are an expert Compliance Officer filling out a Due Diligence Questionnaire (DDQ).
                    
                    YOUR GOAL: Answer the provided questions using ONLY the provided verified Standing Data.
                    
                    RULES:
                    1. Use the provided Standing Data as your knowledge base.
                    2. If the answer is explicitly in the data, set confidence to 0.9-1.0.
                    3. If you can infer the answer (e.g. "UK" implies "Not US"), set confidence to 0.7-0.9.
                    4. If the data is missing, reply "Information not available in Standing Data" and set confidence to 0.
                    5. Always provide the "sourceQuote" - the exact text from the Standing Data you used.
                    6. Be concise and professional.`
                },
                {
                    role: "user",
                    content: `STANDING DATA LIBRARY:
                    ${contextText}
                    
                    QUESTIONS TO ANSWER:
                    ${questionsPrompt}`
                }
            ]
        });

        console.log(`[AutoFill] Generated ${object.answers.length} answers.`);

        // 4. Map back to our friendly format
        const finalResults: SuggestedAnswer[] = object.answers.map(ans => {
            // Re-finding the question object to get its original Text if needed, 
            // but the frontend mainly needs to overlay this on the existing list.
            // We'll rely on the index to match up with the frontend's 'questions' array.

            // Wait, the frontend might have filtered lists. 
            // It's safest if the Frontend passes the questions? 
            // No, the backend is the source of truth for the doc content.
            // We'll return the index so the frontend can map it to its view of 'extractedContent'.

            return {
                questionId: ans.questionIndex.toString(), // We used index as ID
                suggestedAnswer: ans.answer,
                confidence: ans.confidence,
                sourceQuote: ans.sourceQuote,
                reasoning: ans.reasoning
            };
        });

        return { success: true, data: finalResults };

    } catch (error: any) {
        console.error("[generateAnswers] Error:", error);
        return { success: false, error: error.message || "Failed to generate answers" };
    }
}
