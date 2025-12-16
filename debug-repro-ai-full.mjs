
import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

// Simple .env parser since we might not have dotenv
function loadEnv() {
    try {
        const envPath = path.resolve(process.cwd(), '.env');
        if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf-8');
            content.split('\n').forEach(line => {
                const parts = line.split('=');
                if (parts.length >= 2 && !line.startsWith('#')) {
                    const key = parts[0].trim();
                    const val = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
                    if (!process.env[key]) process.env[key] = val;
                }
            });
            console.log("Env loaded.");
        }
    } catch (e) {
        console.error("Failed to load .env", e);
    }
}

loadEnv();

const openai = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

async function main() {
    const filePath = "/home/mark/MEGA/Antiravity/Compass/compass/sampleQuestionnaires/Generic - UHRC Questionnaire.docx";
    console.log(`Processing: ${filePath}`);

    // 1. Mammoth
    const buffer = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value;
    console.log(`Extracted Text Length: ${text.length}`);

    // 2. AI
    console.log("Calling OpenAI...");
    try {
        const { object } = await generateObject({
            model: openai('gpt-4o'),
            schema: z.object({
                items: z.array(z.object({
                    type: z.enum(["QUESTION", "SECTION", "INSTRUCTION", "NOTE"]),
                    originalText: z.string(),
                    neutralText: z.string().optional(),
                    masterKey: z.string().optional(),
                    confidence: z.number()
                }))
            }),
            messages: [{
                role: "user",
                content: `Analyze this text and extract items:\n\n${text.substring(0, 5000)}` // Extract context
            }]
        });

        console.log(`Success! Extracted ${object.items.length} items.`);
        console.log(JSON.stringify(object.items.slice(0, 3), null, 2));
    } catch (e) {
        console.error("AI Generation Failed:", e);
        if (e.cause) console.error("Cause:", e.cause);
    }
}

main();
