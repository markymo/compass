
import { getFIEngagementById } from "@/actions/fi";
import { getQuestionnaireById } from "@/actions/questionnaire";
import { WorkbenchQuestionnaireSwitcher } from "@/components/fi/workbench-questionnaire-switcher";
import { FIBreadcrumb } from "@/components/fi/fi-breadcrumb";
import { SplitViewWorkbench } from "@/components/fi/split-view-workbench";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Flag, ArrowLeft, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Save } from "lucide-react";
import { QuestionnaireQAMode } from "@/components/fi/questionnaire-qa-mode";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function WorkbenchPage({ params }: { params: Promise<{ id: string; itemId: string }> }) {
    const { id, itemId } = await params;

    const engagement = await getFIEngagementById(id);
    const questionnaire = await getQuestionnaireById(itemId);

    if (!engagement || !questionnaire) return notFound();

    // Mode Switching: If it has questions (Instance), show Q&A Mode. Else show Extraction Mode.
    if (questionnaire.questions && questionnaire.questions.length > 0) {
        return (
            <div className="flex flex-col h-full">
                {/* Header */}
                <div className="flex flex-col border-b border-slate-200 bg-white shadow-sm z-10">
                    {/* Breadcrumb Row */}
                    <div className="px-4 pt-4">
                        <FIBreadcrumb
                            items={[
                                { label: `Client: ${engagement.clientLE.name}`, href: `/app/fi/engagements/${id}` },
                                { label: `Workbench: ${questionnaire.name}` }
                            ]}
                            className="mb-2"
                        />
                    </div>

                    <div className="flex items-center justify-between px-4 pb-4">
                        <div className="flex items-center gap-3">
                            <div>
                                <WorkbenchQuestionnaireSwitcher
                                    engagementId={id}
                                    currentQuestionnaireId={itemId}
                                    questionnaires={engagement.questionnaires}
                                />
                            </div>
                        </div>
                        {/* Progress Bar Placeholder */}
                        <div className="flex items-center gap-4">
                            <div className="text-xs text-slate-500">
                                <span className="font-semibold text-slate-900">30%</span> Complete
                            </div>
                            <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="bg-indigo-500 h-full w-[30%]"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden">
                    <QuestionnaireQAMode questions={questionnaire.questions as any[]} />
                </div>
            </div>
        );
    }

    // --- Fallback: Extraction Mode (Original View) ---

    // Mock Extracted Items for Demo
    const extractedItems = (questionnaire.extractedContent as any[]) || [
        { key: "company_name", label: "Legal Name", value: "Acme Hedge Fund", sourcePage: 1, confidence: 0.98 },
        { key: "inc_date", label: "Incorporation Date", value: "2023-01-12", sourcePage: 1, confidence: 0.85 },
        { key: "reg_number", label: "Registration Number", value: "12345678", sourcePage: 1, confidence: 0.99 },
        { key: "address", label: "Registered Address", value: "123 Wall St, New York, NY", sourcePage: 1, confidence: 0.92 },
    ];

    // Left Panel: Document Viewer (Mock)
    const DocumentViewer = (
        <div className="flex flex-col h-full bg-slate-100">
            {/* Toolbar */}
            <div className="flex items-center justify-between p-2 bg-white border-b border-slate-200 shadow-sm z-10">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded">
                        {questionnaire.fileName || "document.pdf"}
                    </span>
                    <Badge variant="outline" className="text-[10px] h-5">Page 1 / 4</Badge>
                </div>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8"><ZoomOut className="w-4 h-4" /></Button>
                    <span className="text-xs text-slate-500 w-12 text-center">100%</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><ZoomIn className="w-4 h-4" /></Button>
                </div>
            </div>

            {/* Content Area (Placeholder) */}
            <div className="flex-1 overflow-auto p-8 flex justify-center">
                <div className="bg-white shadow-[0_0_20px_rgba(0,0,0,0.1)] w-[595px] h-[842px] relative flex flex-col items-center justify-center border border-slate-200">
                    <div className="text-slate-300 pointer-events-none select-none flex flex-col items-center">
                        <FileIcon className="w-24 h-24 mb-4 opacity-20" />
                        <p className="font-medium text-lg">PDF Viewer Placeholder</p>
                        <p className="text-sm">(Rendering {questionnaire.fileName})</p>
                    </div>
                </div>
            </div>
            {/* Pagination */}
            <div className="bg-white border-t border-slate-200 p-2 flex justify-center gap-4">
                <Button variant="ghost" size="sm" disabled><ChevronLeft className="w-4 h-4" /></Button>
                <span className="text-xs self-center">Page 1 of 4</span>
                <Button variant="ghost" size="sm"><ChevronRight className="w-4 h-4" /></Button>
            </div>
        </div>
    );

    // Right Panel: Validation Grid
    const ValidationGrid = (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex flex-col border-b border-slate-100 bg-white">
                <div className="px-4 pt-4">
                    <FIBreadcrumb
                        items={[
                            { label: `Client: ${engagement.clientLE.name}`, href: `/app/fi/engagements/${id}` },
                            { label: `Extraction: ${questionnaire.name}` }
                        ]}
                        className="mb-2"
                    />
                </div>
                <div className="flex items-center justify-between p-4 pt-0">
                    <div className="flex items-center gap-3">
                        <div>
                            <WorkbenchQuestionnaireSwitcher
                                engagementId={id}
                                currentQuestionnaireId={itemId}
                                questionnaires={engagement.questionnaires}
                            />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="gap-2 text-xs">
                            <Flag className="w-3.5 h-3.5" /> Flag All
                        </Button>
                        <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-xs">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Approve All
                        </Button>
                    </div>
                </div>
            </div>

            {/* Grid Content */}
            <div className="flex-1 overflow-y-auto bg-slate-50/30">
                <div className="divide-y divide-slate-100">
                    {extractedItems.map((item: any, idx: number) => (
                        <div key={idx} className="group bg-white p-4 hover:bg-indigo-50/30 transition-colors border-l-4 border-l-transparent hover:border-l-indigo-500">
                            <div className="flex justify-between items-start mb-2">
                                <label className="text-xs font-semibold text-slate-500 uppercase">{item.label || item.key}</label>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button className="p-1 hover:bg-slate-100 rounded text-amber-500"><Flag className="w-4 h-4" /></button>
                                    <button className="p-1 hover:bg-emerald-50 rounded text-emerald-600"><CheckCircle2 className="w-4 h-4" /></button>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-slate-900 bg-slate-100 px-2 py-1 rounded border border-slate-200 w-full">
                                    {item.value || <span className="text-slate-400 italic">Empty</span>}
                                </span>
                            </div>
                            <div className="mt-2 flex justify-between items-center">
                                <span className="text-[10px] text-slate-400">
                                    Source: Page {item.sourcePage || 1} • {Math.round((item.confidence || 0) * 100)}% Confidence
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-slate-200 bg-white shadow-[0_-5px_15px_rgba(0,0,0,0.02)] z-20">
                <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">
                        Changes saved automatically
                    </span>
                    <Button className="w-32 gap-2">
                        <Save className="w-4 h-4" /> Done
                    </Button>
                </div>
            </div>
        </div>
    );

    return (
        <SplitViewWorkbench
            leftPanel={DocumentViewer}
            rightPanel={ValidationGrid}
        />
    );
}

function FileIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
        </svg>
    )
}
