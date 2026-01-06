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

import fs from 'fs';
import path from 'path';

function logToFile(msg: string, data?: any) {
    try {
        const logPath = path.resolve(process.cwd(), 'debug-autofill.txt');
        const timestamp = new Date().toISOString();
        const content = `[${timestamp}] ${msg} ${data ? JSON.stringify(data, null, 2) : ''}\n`;
        fs.appendFileSync(logPath, content);
    } catch (e) {
        // ignore
    }
}

export async function generateAnswers(leId: string, questionnaireId: string): Promise<{ success: boolean; data?: SuggestedAnswer[]; debugMessages?: any[]; error?: string }> {
    logToFile(`[generateAnswers] START for LE ${leId}, Q ${questionnaireId}`);

    const { userId } = await auth();
    if (!userId) return { success: false, error: "Unauthorized" };

    try {
        // 1. Fetch Standing Data for the Client LE
        const standingDataSections = await prisma.standingDataSection.findMany({
            where: { clientLEId: leId }
        });

        logToFile(`[generateAnswers] Found ${standingDataSections.length} sections`);

        if (standingDataSections.length === 0) {
            logToFile("[generateAnswers] No standing data found");
            return { success: false, error: "No Standing Data found. Please fill out your Knowledge Base first." };
        }

        // Format Standing Data for the AI
        const contextText = standingDataSections.map(section =>
            `SECTION: ${section.category}\nCONTENT:\n${section.content}\n`
        ).join("\n---\n");

        logToFile("[generateAnswers] Context Text Preview", contextText.substring(0, 500));

        // 2. Fetch Questionnaire Content
        const questionnaire = await prisma.questionnaire.findUnique({
            where: { id: questionnaireId },
            select: { extractedContent: true, name: true }
        });

        if (!questionnaire || !questionnaire.extractedContent) {
            return { success: false, error: "Questionnaire content not found. Please ensure it has been extracted." };
        }

        const items = questionnaire.extractedContent as any[];
        // Map to preserve original index, then filter for "QUESTION"
        const questions = items
            .map((item, idx) => ({ ...item, originalIndex: idx }))
            .filter((item: any) => item.type === "QUESTION");

        if (questions.length === 0) {
            return { success: false, error: "No questions found in this document." };
        }

        logToFile(`[generateAnswers] Found ${questions.length} questions`);

        // Use originalIndex as the ID
        const questionsPrompt = questions.map((q: any) =>
            `ID: ${q.originalIndex}\nQuestion: ${q.originalText}\nCategory: ${q.category || "General"}`
        ).join("\n\n");

        // 3. Prompt the AI
        logToFile(`[AutoFill] Sending request to AI...`);

        const aiMessages = [
            {
                role: "system" as const,
                content: `You are an expert Compliance Officer filling out a Due Diligence Questionnaire (DDQ).
                    
                    YOUR GOAL: Answer the provided questions using ONLY the provided verified Standing Data.
                    
                    RULES:
                    1. Use the provided Standing Data as your knowledge base.
                    2. If the answer is explicitly in the data, set confidence to 0.9-1.0.
                    3. If you can infer the answer (e.g. "UK" implies "Not US"), set confidence to 0.7-0.9.
                    4. DATA PRECEDENCE: The Standing Data is the absolute truth for the entity being processed. If a question contains a specific name, date, or value that conflicts with the Standing Data, you MUST ignore the value in the question and answer using the Standing Data.
                    5. If the data is missing, reply "Information not available in Standing Data" and set confidence to 0.
                    6. Always provide the "sourceQuote" - the exact text from the Standing Data you used.
                    7. Be concise and professional.`
            },
            {
                role: "user" as const,
                content: `STANDING DATA LIBRARY:
                    ${contextText}
                    
                    QUESTIONS TO ANSWER:
                    ${questionsPrompt}`
            }
        ];

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
            messages: aiMessages
        });

        logToFile(`[AutoFill] Generated ${object.answers.length} answers.`);

        object.answers.forEach((ans, idx) => {
            // Log first 3 for sanity
            if (idx < 3) {
                logToFile(`[AutoFill] Answer ${idx}: QID=${ans.questionIndex}`, ans);
            }
            // Log specific debug targets
            if (ans.answer.toLowerCase().includes("bravo") || ans.sourceQuote.toLowerCase().includes("bravo")) {
                logToFile(`[AutoFill] Found Answer for Bravo: QID=${ans.questionIndex}`, ans);
            }
        });

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

        return { success: true, data: finalResults, debugMessages: aiMessages };

    } catch (error: any) {
        logToFile("[generateAnswers] Error:", error);
        console.error("[generateAnswers] Error:", error);
        return { success: false, error: error.message || "Failed to generate answers" };
    }
}
