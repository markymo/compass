const fs = require('fs');
const path = require('path');

const files = [
  'src/actions/__tests__/questionnaire-visibility.test.ts',
  'src/actions/__tests__/reference-codes-integration.test.ts',
  'src/lib/questionnaires/__tests__/reference-codes.test.ts',
  'scripts/verify-creation.ts'
];

for (const file of files) {
  const p = path.join(__dirname, '..', file);
  if (fs.existsSync(p)) {
    let content = fs.readFileSync(p, 'utf8');
    content = content.replace(/COPARITY/g, 'ONPRO');
    fs.writeFileSync(p, content, 'utf8');
    console.log('Updated ' + file);
  } else {
    console.log('Not found ' + file);
  }
}
