const { generateObject } = require('ai');
const { createOpenAI } = require('@ai-sdk/openai');
const { z } = require('zod');
const https = require('https');
require('dotenv').config();

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

https.get('https://html.duckduckgo.com/html/?q=Gode+Wind+3+GmbH+Frankfurt+am+Main+HRB+130853', { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
  let html = '';
  res.on('data', c => html+=c);
  res.on('end', async () => {
    try {
      const { object } = await generateObject({
        model: openai('gpt-4o'),
        schema: z.object({
          entityName: z.string(),
          entityStatus: z.string(),
          address: z.string(),
          incorporationDate: z.string().optional()
        }),
        prompt: 'Extract company info from this search result HTML:\n\n' + html.substring(0, 8000),
      });
      console.log(object);
    } catch(e) { console.error(e) }
  });
});
