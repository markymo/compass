const fs = require('fs');
const file = '/opt/code/coparity/src/components/client/engagement/inline-engagement-sections.tsx';
let code = fs.readFileSync(file, 'utf8');

// Update Interface
code = code.replace(
    /engagementId: string,\n    questionnaires: any\[\]\n\}\)/,
    `engagementId: string,\n    questionnaires: any[],\n    commonQuestionnaires?: any[]\n})`
);

// Add commonQuestionnaires prop to destructuring
code = code.replace(
    /export function InlineOutputBuilder\(\{\n    engagementId,\n    questionnaires\n\}/,
    `export function InlineOutputBuilder({\n    engagementId,\n    questionnaires,\n    commonQuestionnaires = []\n}`
);

// Pass to OutputPackBuilder
code = code.replace(
    /<OutputPackBuilder\s*\n\s*engagementId=\{engagementId\}\s*\n\s*questionnaires=\{questionnaires\}/,
    `<OutputPackBuilder\n                    engagementId={engagementId}\n                    questionnaires={questionnaires}\n                    commonQuestionnaires={commonQuestionnaires}`
);

fs.writeFileSync(file, code);
