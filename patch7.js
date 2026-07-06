const fs = require('fs');

const file = '/opt/code/coparity/src/components/client/engagement/engagement-manager.tsx';
let code = fs.readFileSync(file, 'utf8');

// Update Interface
code = code.replace(
    /interface EngagementManagerProps \{\n    leId: string;\n    initialEngagements: any\[\];\n    leDueDate: Date \| null;\n\}/,
    `interface EngagementManagerProps {\n    leId: string;\n    initialEngagements: any[];\n    leDueDate: Date | null;\n    commonQuestionnaires?: any[];\n}`
);

// Update Function Signature
code = code.replace(
    /export function EngagementManager\(\{ leId, initialEngagements, leDueDate \}: EngagementManagerProps\) \{/,
    `export function EngagementManager({ leId, initialEngagements, leDueDate, commonQuestionnaires = [] }: EngagementManagerProps) {`
);

// Pass to InlineOutputBuilder
code = code.replace(
    /<InlineOutputBuilder\s*\n\s*engagementId=\{eng\.id\}\s*\n\s*questionnaires=\{questionnaires\}\s*\n\s*\/>/g,
    `<InlineOutputBuilder\n                                                    engagementId={eng.id}\n                                                    questionnaires={questionnaires}\n                                                    commonQuestionnaires={commonQuestionnaires}\n                                                />`
);

fs.writeFileSync(file, code);
