
const mammoth = require('mammoth');
const fs = require('fs');
const path = require('path');

async function main() {
    const filePath = "/home/mark/MEGA/Antiravity/Compass/compass/sampleQuestionnaires/Generic - UHRC Questionnaire.docx";
    console.log(`Reading file: ${filePath}`);

    try {
        const buffer = fs.readFileSync(filePath);
        console.log(`Buffer length: ${buffer.length} bytes`);

        console.log("Starting Mammoth extraction...");
        const result = await mammoth.extractRawText({ buffer: buffer });

        console.log("Success!");
        console.log(`Extracted text length: ${result.value.length}`);
        console.log("Preview:", result.value.substring(0, 200));

        if (result.messages && result.messages.length > 0) {
            console.log("Messages/Warnings:", result.messages);
        }
    } catch (e) {
        console.error("Extraction Failed:", e);
    }
}

main();
