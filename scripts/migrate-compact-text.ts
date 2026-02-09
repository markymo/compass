/**
 * One-time migration script to populate compactText for existing questions
 * Run this after adding the compactText field to sync data from extractedContent JSON
 */

import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

export async function migrateCompactText() {
    console.log("Starting compactText migration...");

    // Get all questionnaires - we'll filter for extractedContent in code
    const questionnaires = await prisma.questionnaire.findMany({
        include: {
            questions: true
        }
    });

    console.log(`Found ${questionnaires.length} questionnaires to check`);

    let updated = 0;

    for (const q of questionnaires) {
        // Skip if no extractedContent
        if (!q.extractedContent) continue;

        const extractedContent = q.extractedContent as any[];

        if (!Array.isArray(extractedContent)) continue;

        // Map questions by their text to match with extracted content
        for (const item of extractedContent) {
            if (item.type?.toLowerCase() !== 'question') continue;
            if (!item.compactText) continue;

            // Find matching question by text
            const question = q.questions.find(qu => qu.text === item.text);

            if (question && !question.compactText) {
                await prisma.question.update({
                    where: { id: question.id },
                    data: { compactText: item.compactText }
                });
                updated++;
                console.log(`✓ Updated question: "${question.text.slice(0, 40)}..." → "${item.compactText}"`);
            }
        }
    }

    console.log(`Migration complete! Updated ${updated} questions.`);
    return { success: true, updated };
}
