import { PrismaClient } from "@prisma/client";
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

const openai = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

async function main() {
    const args = process.argv.slice(2);
    let questionnaireId = args[0];

    let whereClause: any = {
        OR: [
            { compactText: null },
            { compactText: "" }
        ]
    };

    if (questionnaireId) {
        whereClause.questionnaireId = questionnaireId;
        console.log(`Targeting Questionnaire ID: ${questionnaireId}`);
    } else {
        console.log(`Targeting all questions missing compactText`);
    }

    // Process in batches
    const batchSize = 50;
    let totalUpdated = 0;

    while (true) {
        const questions = await prisma.question.findMany({
            where: whereClause,
            take: batchSize,
            select: { id: true, text: true }
        });

        if (questions.length === 0) {
            if (totalUpdated === 0) {
                console.log("No questions found needing compactText generation.");
            } else {
                console.log(`Finished processing. Total updated: ${totalUpdated}`);
            }
            break;
        }

        console.log(`Processing batch of ${questions.length} questions...`);

        try {
            const { object } = await generateObject({
                model: openai('gpt-4o'),
                schema: z.object({
                    items: z.array(z.object({
                        id: z.string(),
                        compactText: z.string().describe("A concise summary of the question, strictly under 20 chars (e.g. 'Entity Name')")
                    }))
                }),
                messages: [
                    {
                        role: "system",
                        content: "You are an expert KYC Analyst. Generate a 'compactText' version strictly under 20 characters (like a short label) for each provided question."
                    },
                    {
                        role: "user",
                        content: JSON.stringify(questions.map(q => ({ id: q.id, text: q.text })))
                    }
                ]
            });

            console.log(`Generated ${object.items.length} compact texts. Updating database...`);

            let batchUpdated = 0;
            for (const item of object.items) {
                if (!item.compactText) continue;

                try {
                    await prisma.question.update({
                        where: { id: item.id },
                        data: { compactText: item.compactText }
                    });
                    batchUpdated++;
                    const q = questions.find(q => q.id === item.id);
                    console.log(`✓ Updated: "${q?.text.slice(0, 40)}..." -> "${item.compactText}"`);
                } catch (e) {
                    console.error(`Failed to update question ${item.id}`, e);
                }
            }

            totalUpdated += batchUpdated;
            console.log(`Batch complete. ${batchUpdated} updated.`);
        } catch (error) {
            console.error("Error generating compact texts from AI:", error);
            break; // Stop on AI error to avoid infinite loops if it's an auth/rate-limit issue
        }
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
