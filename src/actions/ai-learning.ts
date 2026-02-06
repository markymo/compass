"use server";

import prisma from "@/lib/prisma";
import { getIdentity } from "@/lib/auth";
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { STANDARD_CATEGORIES } from "@/lib/constants";
import { revalidatePath } from "next/cache";

import fs from 'fs';
import path from 'path';

// Global initialization removed. Client created on demand.

interface QAPair {
    question: string;
    answer: string;
    category?: string;
}

// Map English Display Names (from constants.ts) to DB Keys (used in StandingDataWorkbench)
const CATEGORY_MAP: Record<string, string> = {
    "Core Details": "CORE",
    "Corporate Structure": "STRUCTURE",
    "Geography": "GEOGRAPHY",
    "Products & Services": "PRODUCTS",
    "Compliance & Regulation": "COMPLIANCE"
};

function logToFile(msg: string, data?: any) {
    try {
        const logPath = path.resolve(process.cwd(), 'debug-learning.txt');
        const timestamp = new Date().toISOString();
        const content = `[${timestamp}] ${msg} ${data ? JSON.stringify(data, null, 2) : ''}\n`;
        fs.appendFileSync(logPath, content);
    } catch (e) {
        // ignore
    }
}

export async function learnFromAnswers(leId: string, qaPairs: QAPair[]): Promise<{ success: boolean; count?: number; error?: string }> {
    logToFile(`[learnFromAnswers] Called for LE ${leId} with ${qaPairs.length} pairs`);

    const identity = await getIdentity();
    const userId = identity?.userId;
    if (!userId) {
        logToFile("[learnFromAnswers] Unauthorized");
        return { success: false, error: "Unauthorized" };
    }

    // 1. Filter valid pairs (non-empty answers)
    const validPairs = qaPairs.filter(p => p.answer && p.answer.trim().length > 2);
    logToFile(`[learnFromAnswers] Valid pairs after filtering: ${validPairs.length}`, validPairs);

    if (validPairs.length === 0) return { success: true, count: 0 };

    try {
        const openai = createOpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        // 2. Fetch Existing Standing Data
        const existingSections = await prisma.standingDataSection.findMany({
            where: { clientLEId: leId }
        });

        // 3. Prepare AI Context
        const currentKnowledge = existingSections.map(s =>
            `SECTION: ${s.category}\n---\n${s.content}\n---`
        ).join("\n\n");

        const newInformation = validPairs.map(p =>
            `Q: ${p.question}\nA: ${p.answer}\n(Category: ${p.category || "General"})`
        ).join("\n\n");

        logToFile(`[AI Learning] Analyzing ${validPairs.length} answers for LE ${leId}`);

        // 4. Prompt: Extract & Merge
        const { object } = await generateObject({
            model: openai('gpt-4o'),
            schema: z.object({
                updatedSections: z.array(z.object({
                    category: z.enum(STANDARD_CATEGORIES as [string, ...string[]]).describe("The category from the standard list to update"),
                    content: z.string().describe("The full, updated markdown content for this section. Merge new facts from the Q&A into the existing text.")
                }))
            }),
            messages: [
                {
                    role: "system",
                    content: `You are a Knowledge Base Manager for a financial institution. 
                    Your job is to read new Q&A pairs from a questionnaire and update the "Standing Data" (Knowledge Base) to include any new facts.
                    
                    RULES:
                    1. Read the "Current Knowledge Base" and the "New Q&A Pairs".
                    2. If a Q&A pair contains new, factual information that is NOT in the knowledge base, add it to the appropriate section.
                    3. If the information contradicts, assume the New Q&A is more recent/accurate and update the record.
                    4. Maintain the existing markdown structure. Use bullet points or short paragraphs.
                    5. IGNORE answers that are specific to “this questionnaire” (e.g. “See attached”, “Yes”, “No” without context). Only extract reusable facts (e.g. “Revenue is $50M”).
                    6. Return existing content + new content for any modified sections. If a section doesn't need changes, do not return it.`
                },
                {
                    role: "user",
                    content: `CURRENT KNOWLEDGE BASE:
                    ${currentKnowledge}
                    
                    NEW Q&A PAIRS:
                    ${newInformation}`
                }
            ]
        });

        const updates = object.updatedSections;
        logToFile(`[AI Learning] AI proposed updates for ${updates.length} sections.`, updates);

        if (updates.length === 0) {
            logToFile("[AI Learning] No updates proposed by AI. Returning early.");
            return { success: true, count: 0 };
        }

        // 5. Update Database
        await Promise.all(updates.map(async (update) => {
            // MAP DISPLAY NAME TO DB KEY
            const dbCategoryKey = CATEGORY_MAP[update.category];

            if (!dbCategoryKey) {
                logToFile(`[AI Learning] WARNING: Could not find DB Key for category '${update.category}'. Skipping.`);
                return;
            }

            logToFile(`[AI Learning] Upserting section: ${dbCategoryKey} (${update.category}) for LE ${leId}`);
            try {
                await prisma.standingDataSection.upsert({
                    where: {
                        clientLEId_category: {
                            clientLEId: leId,
                            category: dbCategoryKey
                        }
                    },
                    create: {
                        clientLEId: leId,
                        category: dbCategoryKey,
                        content: update.content
                    },
                    update: {
                        content: update.content
                    }
                });
                logToFile(`[AI Learning] Upsert successful for ${dbCategoryKey}`);
            } catch (upsertError) {
                logToFile(`[AI Learning] Failed to upsert ${dbCategoryKey}:`, upsertError);
                throw upsertError;
            }
        }));

        logToFile(`[AI Learning] Successfully updated ${updates.length} sections.`);

        revalidatePath(`/app/le/${leId}/v2`);

        return { success: true, count: updates.length };

    } catch (error: any) {
        logToFile("[learnFromAnswers] Error:", error);
        return { success: false, error: error.message || "Learning failed" };
    }
}
