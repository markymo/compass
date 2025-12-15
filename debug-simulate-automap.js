
const { PrismaClient } = require('@prisma/client');
const { openai } = require("@ai-sdk/openai");
const { generateText } = require("ai");

const prisma = new PrismaClient();

// Mock environment if needed, but usually they are loaded if .env exists
require('dotenv').config();

async function simulateBulkMap() {
    console.log("Starting Simulation...");

    const targetSchema = await prisma.masterSchema.findFirst({ orderBy: { version: 'desc' }, });
    if (!targetSchema) return console.error("No schema found");

    const definition = targetSchema.definition;
    const categories = definition.categories || [];

    // Find unmapped fields
    const unmappedIndices = definition.fields
        .map((f, idx) => ({ ...f, idx }))
        .filter(f => !f.categoryId && !f.proposedCategoryId);

    console.log(`Found ${unmappedIndices.length} unmapped fields.`);

    if (unmappedIndices.length === 0) {
        // For debug purposes, let's force map 'ultimate_beneficiary' even if it has a proposal, 
        // just to see if it works.
        const uboField = definition.fields.find(f => f.key === 'ultimate_beneficiary');
        if (uboField) {
            console.log("Force testing 'ultimate_beneficiary'...");
            unmappedIndices.push({ ...uboField, idx: 999 }); // idx fake
        } else {
            return console.log("Nothing to map.");
        }
    }

    // Filter SPECIFICALLY for the UBO field for debugging
    const fieldsToProcess = definition.fields.filter(f => f.key === 'ultimate_beneficiary' || f.label.includes("Ultimate"));

    if (fieldsToProcess.length === 0) {
        return console.log("Field 'ultimate_beneficiary' not found in schema fields.");
    }

    const prompt = `
    You are a data classification expert. Map each Field to the best Category ID.
    
    Categories:
    ${categories.map(c => `${c.id}: ${c.title} (${c.examples?.slice(0, 3).join(', ')})`).join('\n')}

    Fields to Map:
    ${fieldsToProcess.map(f => `[${f.id}] Label: "${f.label}" (Desc: ${f.description || ''})`).join('\n')}

    Return a JSON object where keys are Field IDs and values are Category IDs (strings).
    Example: { "uuid-1": "1", "uuid-2": "5" }
    JSON ONLY.
    `;

    console.log("\n--- SENT PROMPT ---");
    console.log(prompt.substring(0, 500) + "..."); // truncated
    console.log("-------------------\n");

    try {
        const { text } = await generateText({
            model: openai("gpt-4o"),
            prompt: prompt,
        });

        console.log("\n--- RECEIVED RESPONSE ---");
        console.log(text);
        console.log("-------------------------\n");

        // Logic check
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error("REGEX FAILED to find JSON");
        } else {
            const cleanJson = jsonMatch[0];
            const mapping = JSON.parse(cleanJson);
            console.log("Parsed Mapping:", mapping);
        }

    } catch (e) {
        console.error("Simulation Error:", e);
    }
}

simulateBulkMap()
    .finally(() => prisma.$disconnect());
