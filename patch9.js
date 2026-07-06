const fs = require('fs');
const file = '/opt/code/coparity/src/components/client/engagement/output-pack-builder.tsx';
let code = fs.readFileSync(file, 'utf8');

// Update Interface
code = code.replace(
    /interface OutputQuestionnaire \{\n    id: string;\n    name: string;\n    questionCount: number;\n    answeredCount: number;/,
    `interface OutputQuestionnaire {\n    id: string;\n    name: string;\n    questionCount: number;\n    answeredCount: number;\n    isCommon?: boolean;`
);

code = code.replace(
    /interface OutputPackBuilderProps \{\n\n    engagementId: string;\n    questionnaires: any\[\];\n    evidenceDocuments: any\[\];\n    sharedDocuments: any\[\];\n\}/,
    `interface OutputPackBuilderProps {\n\n    engagementId: string;\n    questionnaires: any[];\n    commonQuestionnaires?: any[];\n    evidenceDocuments: any[];\n    sharedDocuments: any[];\n}`
);

code = code.replace(
    /export function OutputPackBuilder\(\{\n    engagementId,\n    questionnaires,\n    evidenceDocuments,\n    sharedDocuments,\n\}: OutputPackBuilderProps\) \{/,
    `export function OutputPackBuilder({\n    engagementId,\n    questionnaires,\n    commonQuestionnaires = [],\n    evidenceDocuments,\n    sharedDocuments,\n}: OutputPackBuilderProps) {`
);

// Map commonQuestionnaires and questionnaires
code = code.replace(
    /const outputQuestionnaires: OutputQuestionnaire\[\] = questionnaires\.map\(q => \(\{\n\s*id: q\.id,\n\s*name: q\.name,\n\s*questionCount: q\.metrics\?\.total \?\? 0,\n\s*answeredCount: q\.metrics\?\.answered \?\? 0,\n\s*files: docsByQuestionnaireId\.get\(q\.id\) \?\? \[\],\n\s*\}\)\);/,
    `const outputQuestionnaires: OutputQuestionnaire[] = [\n        ...commonQuestionnaires.map(q => ({\n            id: q.id,\n            name: q.name,\n            questionCount: q.metrics?.total ?? 0,\n            answeredCount: q.metrics?.answered ?? 0,\n            files: docsByQuestionnaireId.get(q.id) ?? [],\n            isCommon: true,\n        })),\n        ...questionnaires.map(q => ({\n            id: q.id,\n            name: q.name,\n            questionCount: q.metrics?.total ?? 0,\n            answeredCount: q.metrics?.answered ?? 0,\n            files: docsByQuestionnaireId.get(q.id) ?? [],\n            isCommon: false,\n        }))\n    ];`
);

// Add Badge in render
const badgeAnchor = '<span className="font-medium text-sm text-slate-900">{q.name}</span>';
const replacementBadge = `{q.isCommon && (
                                                    <Badge variant="outline" className="text-[9px] uppercase font-bold text-slate-500 mb-0.5 w-fit py-0 px-1.5 border-slate-200">
                                                        Common
                                                    </Badge>
                                                )}
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-sm text-slate-900">{q.name}</span>`;

// The existing code has: 
// <div className="flex-1 min-w-0">
//     <div className="flex items-center gap-2">
//         <span className="font-medium text-sm text-slate-900">{q.name}</span>

code = code.replace(
    /<div className="flex-1 min-w-0">\s*<div className="flex items-center gap-2">\s*<span className="font-medium text-sm text-slate-900">\{q\.name\}<\/span>/,
    `<div className="flex-1 min-w-0 flex flex-col">\n                                                ${replacementBadge}`
);

fs.writeFileSync(file, code);
