const fs = require('fs');
const path = '/opt/code/coparity/src/lib/export/__tests__/export-answer-resolver.test.ts';
let content = fs.readFileSync(path, 'utf8');

// I might have deleted a bracket or something.
// Let's count the number of { and } in the file.
const openCount = (content.match(/\{/g) || []).length;
const closeCount = (content.match(/\}/g) || []).length;

console.log(`open: ${openCount}, close: ${closeCount}`);

// Let's just append an extra } to fix it if it's missing one.
if (openCount > closeCount) {
    fs.appendFileSync(path, '\n}\n');
} else if (openCount > closeCount - 1) {
    fs.appendFileSync(path, '\n});\n');
}
