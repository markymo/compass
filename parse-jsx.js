const fs = require('fs');
const content = fs.readFileSync('src/components/client/engagement/questionnaire-mapper.tsx', 'utf-8');

let lines = content.split('\n');
const tagRegex = /<\/?([a-zA-Z0-9]+)[^>]*?>/g;
let stack = [];

for (let i = 0; i < 521; i++) {
  let line = lines[i];
  if (line.trim().startsWith('{/*') || line.trim().startsWith('//')) continue;
  
  let match;
  while ((match = tagRegex.exec(line)) !== null) {
    const isClosing = match[0].startsWith('</');
    const selfClosing = match[0].endsWith('/>');
    const tag = match[1];

    if (selfClosing || tag === 'input' || tag === 'img' || tag === 'br' || tag === 'hr') continue;

    if (!isClosing) {
      stack.push({ tag, line: i + 1 });
    } else {
      if (stack.length > 0) {
        if (stack[stack.length - 1].tag === tag) {
          stack.pop();
        } else {
          console.log(`Mismatched closing tag near line ${i + 1}: expected </${stack[stack.length - 1].tag}> (from ${stack[stack.length - 1].line}) but got </${tag}>`);
        }
      } else {
        console.log(`Extra closing tag </${tag}> at line ${i + 1}`);
      }
    }
  }
}
console.log('Unclosed tags remaining:', stack.length);
stack.forEach(s => console.log(`<${s.tag}> from line ${s.line}`));
