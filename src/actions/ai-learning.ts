"use server";

import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { STANDARD_CATEGORIES } from "@/lib/constants";

const apiKey = process.env.OPENAI_API_KEY;
const openai = createOpenAI({
    apiKey: apiKey,
});

interface QAPair {
    question: string;
    answer: string;
    category?: string;
}

export async function learnFromAnswers(leId: string, qaPairs: QAPair[]): Promise<{ success: boolean; count?: number; error?: string }> {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Unauthorized" };

    // 1. Filter valid pairs (non-empty answers)
    const validPairs = qaPairs.filter(p => p.answer && p.answer.trim().length > 2);
    if (validPairs.length === 0) return { success: true, count: 0 };

    try {
        // 2. Fetch Existing Standing Data
        // We fetch all sections to give the AI full context of what we already know.
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

        console.log(`[AI Learning] Analyzing ${validPairs.length} answers for LE ${leId}`);

        // 4. Prompt: Extract & Merge
        // We ask the AI to return the FULL UPDATED CONTENT for any sections that need changes.
        // This is safer than asking for diffs.
        const { object } = await generateObject({
            model: openai('gpt-4o'),
            schema: z.object({
                updatedSections: z.array(z.object({
                    category: z.enum(STANDARD_CATEGORIES as [string, ...string[]]).describe("The category from the standard list to update"),
                    content: z.string().describe("The full, updated markdown content for this section. Merge new facts into the existing text naturally.")
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
        console.log(`[AI Learning] AI proposed updates for ${updates.length} sections.`);

        if (updates.length === 0) return { success: true, count: 0 };

        // 5. Update Database
        // We process these in parallel
        await Promise.all(updates.map(async (update) => {
            // Upsert the section
            await prisma.standingDataSection.upsert({
                where: {
                    clientLEId_category: {
                        clientLEId: leId,
                        category: update.category
                    }
                },
                create: {
                    clientLEId: leId,
                    category: update.category,
                    content: update.content
                },
                update: {
                    content: update.content
                }
            });
        }));

        return { success: true, count: updates.length };

    } catch (error: any) {
        console.error("[learnFromAnswers] Error:", error);
        return { success: false, error: error.message || "Learning failed" };
    }
}
