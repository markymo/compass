#!/usr/bin/env node
/**
 * Migration script to sync compactText from questionnaire JSON to Question table
 * Run with: node scripts/migrate-compact-text.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Starting compactText migration...");

    const questionnaires = await prisma.questionnaire.findMany({
        where: {
            extractedContent: { not: null }
        },
        include: {
            questions: true
        }
    });

    console.log(`Found ${questionnaires.length} questionnaires to check`);

    let updated = 0;

    for (const q of questionnaires) {
        const extractedContent = q.extractedContent;

        if (!Array.isArray(extractedContent)) continue;

        for (const item of extractedContent) {
            if (item.type?.toLowerCase() !== 'question') continue;
            if (!item.compactText) continue;

            const question = q.questions.find(qu => qu.text === item.text);

            if (question && !question.compactText) {
                await prisma.question.update({
                    where: { id: question.id },
                    data: { compactText: item.compactText }
                });
                updated++;
                console.log(`✓ Updated: "${question.text.slice(0, 40)}..." → "${item.compactText}"`);
            }
        }
    }

    console.log(`\n✅ Migration complete! Updated ${updated} questions.`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
