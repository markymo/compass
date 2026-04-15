const { generateText } = require('ai');
const { createOpenAI } = require('@ai-sdk/openai');
require('dotenv').config();

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function run() {
  try {
    const { text } = await generateText({
      model: openai('gpt-4o'),
      prompt: 'Extract the company name, address, incorporation date, and legal form for the German company registered at Local Court Frankfurt am Main under HRB 130853. Return ONLY valid JSON.',
    });
    console.log(text);
  } catch(e) { console.error(e) }
}
run();
