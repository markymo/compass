const fs = require('fs');
const file = '/home/mark/MEGA/Antiravity/Compass/compass/src/components/client/engagement/questionnaire-mapper.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Import Sheet
content = content.replace(
    'import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";',
    'import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";\nimport { Sheet, SheetContent } from "@/components/ui/sheet";'
);

// 2. Extract editor content lines 711-840 (approx)
const lines = content.split('\n');
const startIdx = lines.findIndex(l => l.includes('<div className="flex-1 overflow-y-auto" ref={editorScrollRef}>'));
const endIdx = lines.findIndex((l, i) => i > startIdx && l.includes(') : (')) - 1; // finds the line before `) : (`

const editorLines = lines.slice(startIdx, endIdx + 1);

const renderFunc = `
    const renderEditorContent = () => {
        if (!selectedQuestion) return null;
        return (
${editorLines.join('\n')}
        );
    };
`;

// Insert renderFunc before `return (`
content = content.replace('    return (', renderFunc + '\n    return (');

// Replace the original inline editor with a call to the func
const originalEditorBlock = editorLines.join('\n');
content = content.replace(originalEditorBlock, '                                    {renderEditorContent()}');

// 3. Add Edit icon to grid rows
const gridRowActions = `                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-600" onClick={() => handleMoveQuestionUp(q.id)}>`;
const editIcon = `                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50" onClick={() => setSelectedQuestionId(q.id)} title="Edit Question">
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
`;
content = content.replace(gridRowActions, editIcon + gridRowActions);

// 4. Add Sheet for grid mode at the end of the component
const componentEnd = `        </div>
    );
}`;
const sheetJSX = `
            {/* GRID VIEW MODAL (Sheet) */}
            {viewMode === "grid" && (
                <Sheet open={!!selectedQuestionId} onOpenChange={(open) => !open && setSelectedQuestionId(null)}>
                    <SheetContent className="w-[600px] sm:max-w-[600px] sm:w-[600px] p-0 flex flex-col bg-slate-50/30 border-l-0 shadow-2xl">
                        {renderEditorContent()}
                    </SheetContent>
                </Sheet>
            )}
`;
content = content.replace(componentEnd, sheetJSX + componentEnd);

fs.writeFileSync(file, content);
console.log("Patched successfully");
