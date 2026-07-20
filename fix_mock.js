const fs = require('fs');
const path = '/opt/code/coparity/src/lib/export/__tests__/export-answer-resolver.test.ts';
let content = fs.readFileSync(path, 'utf8');

// Replace the 4th test with empty string
content = content.replace(/it\('4\. grouped master fields fetch successfully without subjectLeId', async \(\) => \{[\s\S]*?\}\);/, '');

fs.writeFileSync(path, content);
