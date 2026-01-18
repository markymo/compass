"use server";

import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

// Ensure API Key is loaded (Reusing logic from ai-mapper if needed, or just relying on process.env)
// Global initialization removed. Client created on demand.

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
    if (process.env.NODE_ENV === 'development') {
        // console.log(`[AutoFill Debug] ${msg}`, data ? JSON.stringify(data).slice(0, 100) : '');
    }
}

export interface QuestionPrompt {
    id: string | number;
    text: string;
    category?: string;
}

/**
 * Shared AI Service: Generates answers for a list of questions based on provided context.
 */
export async function generateAIAnswers(contextText: string, questions: QuestionPrompt[]) {
    try {
        const openai = createOpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        // Use originalIndex as the ID
        const questionsPrompt = questions.map((q) =>
            `ID: ${q.id}\nQuestion: ${q.text}\nCategory: ${q.category || "General"}`
        ).join("\n\n");

        logToFile(`[AutoFill] Sending request to AI...`);

        const aiMessages = [
            {
                role: "system" as const,
                content: `You are an expert Compliance Officer filling out a Due Diligence Questionnaire (DDQ).
                    
                    YOUR GOAL: Answer the provided questions using ONLY the provided verified Knowledge Base.
                    
                    RULES:
                    1. Use the provided Knowledge Base as your source of truth.
                    2. If the answer is explicitly in the data, set confidence to 0.9-1.0.
                    3. If you can infer the answer (e.g. "UK" implies "Not US"), set confidence to 0.7-0.9.
                    4. DATA PRECEDENCE: The Knowledge Base is the absolute truth for the entity being processed. If a question contains a specific name, date, or value that conflicts with the Knowledge Base, you MUST ignore the value in the question and answer using the Knowledge Base.
                    5. If the data is missing, reply "Information not available in Knowledge Base" and set confidence to 0.
                    6. Always provide the "sourceQuote" - the exact text from the Knowledge Base you used.
                    7. Be concise and professional.`
            },
            {
                role: "user" as const,
                content: `KNOWLEDGE BASE LIBRARY:
                    ${contextText}
                    
                    QUESTIONS TO ANSWER:
                    ${questionsPrompt}`
            }
        ];

        const { object } = await generateObject({
            model: openai('gpt-4o'),
            schema: z.object({
                answers: z.array(z.object({
                    questionId: z.string().describe("The ID of the question provided in the input"),
                    answer: z.string().describe("The answer to the question based ONLY on the Knowledge Base"),
                    confidence: z.number().min(0).max(1).describe("Confidence score. 1.0 = Exact match in data. 0.1 = Wild guess."),
                    sourceQuote: z.string().describe("Verbatim quote from the Knowledge Base that supports this answer"),
                    reasoning: z.string().describe("Brief explanation of why this answer was chosen")
                }))
            }),
            messages: aiMessages
        });

        logToFile(`[AutoFill] Generated ${object.answers.length} answers.`);

        return { success: true, answers: object.answers };

    } catch (e: any) {
        logToFile("[AutoFill] Error: " + e.message);
        return { success: false, error: e.message || "Unknown error" };
    }
}

/**
 * Analyze an answer and update the Knowledge Base
 * This is a "Learning Loop": if the answer contains new facts, add them to the relevant section.
 */
export async function learnFromAnswer(clientLEId: string, questionText: string, answerText: string, userId: string) {
    try {
        logToFile(`[Learning] Analyzing Q: "${questionText.slice(0, 30)}..." -> A: "${answerText.slice(0, 30)}..."`);

        // 1. Fetch Existing Knowledge Base
        const standingDataSections = await prisma.standingDataSection.findMany({
            where: { clientLEId }
        });

        // If no sections, maybe we can't learn? Or create a default "General"?
        // Let's assume we need at least one section to update.
        if (standingDataSections.length === 0) {
            logToFile(`[Learning] Skipped: No Knowledge Base sections found.`);
            return { success: false, error: "No Knowledge Base" };
        }

        const contextText = standingDataSections.map(section =>
            `SECTION_ID: ${section.id}\ncategory: ${section.category}\ncontent:\n${section.content}\n`
        ).join("\n---\n");

        const openai = createOpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        const { object } = await generateObject({
            model: openai("gpt-4o"),
            schema: z.object({
                updates: z.array(z.object({
                    sectionId: z.string().describe("The SECTION_ID to update"),
                    newContent: z.string().describe("The FULL updated markdown content for this section"),
                    reasoning: z.string().describe("What specific fact was learned (e.g. 'Added Tax Residency: UK'). Be extremely concise."),
                    hasChanges: z.boolean().describe("True if new facts were added, False if already knew this")
                }))
            }),
            messages: [
                {
                    role: "system",
                    content: `You are a Knowledge Base Manager. 
                    Your job is to read a Q&A pair and update the existing Knowledge Base sections if new facts are discovered.
                    
                    RULES:
                    1. Read the Question and Answer.
                    2. Check the provided Knowledge Base sections.
                    3. If the Answer contains specific facts (names, dates, entities, policies) that are NOT in the Knowledge Base, add them to the most relevant section.
                    4. If the Answer contradicts the Knowledge Base, assume the Answer is the new truth (User Verified) and update the Knowledge Base.
                    5. Return the FULL updated content for any modified sections.
                    6. Do NOT remove existing info unless it is replaced by the new facts.
                    7. If no new info is found, set hasChanges to false.
                    8. In 'reasoning', be concise: "Learned [Fact]" or "Updated [Fact]".`
                },
                {
                    role: "user",
                    content: `KNOWLEDGE BASE:
                    ${contextText}
                    
                    NEW Q&A TO LEARN FROM:
                    Question: ${questionText}
                    Answer: ${answerText}`
                }
            ],
        });

        // 2. Apply Updates
        const updatePromises = object.updates
            .filter(u => u.hasChanges)
            .map(async (u) => {
                const sectionId = u.sectionId.trim();
                logToFile(`[Learning] Updating Section ${sectionId}: ${u.reasoning}`);

                // Transaction: Create Log + Update Section
                // @ts-ignore: Prisma client lag
                return prisma.$transaction([
                    prisma.usageLog.create({
                        data: {
                            userId: userId,
                            action: "AI_LEARNED",
                            details: {
                                fact: u.reasoning,
                                source: "User Answer",
                                question: questionText.slice(0, 50),
                                clientLEId: clientLEId
                            }
                        }
                    }),
                    prisma.standingDataSection.update({
                        where: { id: sectionId },
                        data: { content: u.newContent }
                    })
                ]);
            });

        if (updatePromises.length > 0) {
            await Promise.all(updatePromises);
            return { success: true, learned: true, updates: updatePromises.length };
        } else {
            return { success: true, learned: false };
        }

    } catch (e: any) {
        console.error("Learning Error:", e);
        logToFile(`[Learning] Error: ${e}`);
        return { success: false, error: "Failed to learn" };
    }
}

export async function generateAnswers(leId: string, questionnaireId: string, lockedQuestionIds: number[] = []): Promise<{ success: boolean; data?: SuggestedAnswer[]; debugMessages?: any[]; error?: string }> {
    logToFile(`[generateAnswers] START for LE ${leId}, Q ${questionnaireId} (Locked: ${lockedQuestionIds.length})`);

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
        // AND exclude locked questions (either passed from client OR persisted in DB)
        const questions: QuestionPrompt[] = items
            .map((item, idx) => ({ ...item, originalIndex: idx }))
            .filter((item: any) => {
                if (item.type !== "QUESTION") return false;

                // Check if unlocked
                const isLockedLocally = lockedQuestionIds.includes(item.originalIndex);
                // Future proofing: check persisted lock status
                const isLockedPersisted = !!item.isLocked;

                return !isLockedLocally && !isLockedPersisted;
            })
            .map((item: any) => ({
                id: item.originalIndex.toString(),
                text: item.originalText || item.text,
                category: item.category
            }));

        if (questions.length === 0) {
            return { success: false, error: "No questions found in this document." };
        }

        logToFile(`[generateAnswers] Found ${questions.length} questions`);

        // 3. Call Shared Service
        const result = await generateAIAnswers(contextText, questions);

        if (!result.success || !result.answers) {
            throw new Error(result.error);
        }

        // 4. Map back to our friendly format
        const finalResults: SuggestedAnswer[] = result.answers.map(ans => {
            return {
                questionId: ans.questionId,
                suggestedAnswer: ans.answer,
                confidence: ans.confidence,
                sourceQuote: ans.sourceQuote,
                reasoning: ans.reasoning
            };
        });

        return { success: true, data: finalResults };

    } catch (error: any) {
        logToFile("[generateAnswers] Error:", error);
        console.error("[generateAnswers] Error:", error);
        return { success: false, error: error.message || "Failed to generate answers" };
    }
}
