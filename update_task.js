const fs = require('fs');
const path = '/home/mark/.gemini/antigravity/brain/10a5620d-56f0-40de-a29d-69a6645f2e35/task.md';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/- `\[ \]` Add regression tests/, '- `[x]` Add regression tests');
content = content.replace(/- `\[ \]` Verify tests pass./, '- `[x]` Verify tests pass.');
content = content.replace(/- `\[ \]` Perform manual verification/, '- `[x]` Perform manual verification');

fs.writeFileSync(path, content);
