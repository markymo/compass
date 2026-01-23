import {
    getFIOganization,
    getFIEngagements,
    getFIDashboardQuestions,
} from "@/actions/fi";
import { Search, Home, Landmark } from "lucide-react";
import { GuideHeader } from "@/components/layout/GuideHeader";
import { QuestionKanbanCard } from "@/components/fi/question-kanban-card";
import { EngagementList } from "@/components/fi/engagement-list";
import { DashboardFilterBar } from "@/components/fi/dashboard-filter-bar";

export default async function FIDashboard({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
    const org = await getFIOganization();
    const params = await searchParams;

    // 1. Fetch Engagements (for List & Filter Options)
    const allEngagements = await getFIEngagements();

    // 2. Extract Available Filters
    const availableQuestionnaires = Array.from(new Set(
        allEngagements.flatMap(e => e.questionnaires.map(q => q.name))
    )).sort();

    const availableClients = Array.from(new Set(
        allEngagements.map(e => e.clientLE.name)
    )).sort();

    // 3. Filter Engagements for the List (Summary)
    let engagements = allEngagements;
    const filterQ = params.questionnaire as string;
    const filterClient = params.client as string;

    if (filterQ && filterQ !== "all") {
        engagements = engagements.filter(e =>
            e.questionnaires.some(q => q.name === filterQ)
        );
    }

    if (filterClient && filterClient !== "all") {
        engagements = engagements.filter(e =>
            e.clientLE.name === filterClient
        );
    }

    // 4. Fetch Questions for the Kanban (Applying same filters)
    const questions = await getFIDashboardQuestions({
        clientLEId: (filterClient && filterClient !== 'all')
            ? allEngagements.find(e => e.clientLE.name === filterClient)?.clientLEId
            : undefined,
        questionnaireName: (filterQ && filterQ !== 'all') ? filterQ : undefined
    });

    // 5. Group Questions by Status
    const draftQuestions = questions.filter(q => q.status === 'DRAFT');
    const reviewQuestions = questions.filter(q => q.status === 'INTERNAL_REVIEW');
    const sharedQuestions = questions.filter(q => q.status === 'SHARED');
    // const queryQuestions = questions.filter(q => q.status === 'QUERY'); // Maybe group with shared?
    // const doneQuestions = questions.filter(q => q.status === 'DONE');

    if (!org) return <div>Unauthorized</div>;

    return (
        <div className="flex flex-col min-h-screen">
            <GuideHeader
                breadcrumbs={[
                    { label: "My Universe", href: "/app", icon: Home },
                    { label: "Financial Institutions", icon: Landmark }
                ]}
            />
            <div className="space-y-6 animate-in fade-in duration-500 py-6">
                {/* Header */}
                <div className="flex items-center justify-between px-6">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Triage</h1>
                        {/* Placeholder for future status/messages */}
                        <div className="flex items-center gap-4 mt-2">
                            <div className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded border border-slate-200 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                System Operational
                            </div>
                            <div className="text-xs text-slate-400">
                                No new messages.
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                            <input
                                placeholder="Global Search (Entity, Fund)..."
                                className="h-9 w-80 pl-9 pr-4 rounded-full border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white shadow-sm"
                            />
                        </div>
                    </div>
                </div>

                {/* Engagement List Summary (Still useful context) */}
                <div className="px-6">
                    <EngagementList engagements={engagements} />
                </div>

                {/* Filters */}
                <div className="px-6">
                    <DashboardFilterBar
                        availableQuestionnaires={availableQuestionnaires}
                        availableClients={availableClients}
                    />
                </div>

                {/* Kanban Board (Questions) */}
                <div className="overflow-x-auto pb-6 px-6">
                    <div className="flex gap-6 min-w-[1000px]">

                        {/* Column 1: Drafts (Not Started/In Progress) */}
                        <div className="w-1/3 flex flex-col bg-slate-50/50 rounded-xl border border-slate-200/60 p-1">
                            <div className="p-3 pb-2 flex items-center justify-between text-sm font-semibold text-slate-700">
                                <span className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-slate-400" />
                                    Draft / Unanswered
                                </span>
                                <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-xs">
                                    {draftQuestions.length}
                                </span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2 space-y-3 custom-scrollbar max-h-[600px]">
                                {draftQuestions.map(q => (
                                    <QuestionKanbanCard key={q.id} question={q} />
                                ))}
                                {draftQuestions.length === 0 && (
                                    <div className="text-center py-10 text-slate-400 text-xs italic">
                                        No draft questions
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Column 2: Internal Review (Ready for FI Review) */}
                        <div className="w-1/3 flex flex-col bg-slate-50/50 rounded-xl border border-slate-200/60 p-1">
                            <div className="p-3 pb-2 flex items-center justify-between text-sm font-semibold text-slate-700">
                                <span className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-indigo-500" />
                                    Ready for Review
                                </span>
                                <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-xs">
                                    {reviewQuestions.length}
                                </span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2 space-y-3 custom-scrollbar max-h-[600px]">
                                {reviewQuestions.map(q => (
                                    <QuestionKanbanCard key={q.id} question={q} />
                                ))}
                                {reviewQuestions.length === 0 && (
                                    <div className="text-center py-10 text-slate-400 text-xs italic">
                                        Nothing to review
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Column 3: Shared / Done (With Client or Finished) */}
                        <div className="w-1/3 flex flex-col bg-slate-50/50 rounded-xl border border-slate-200/60 p-1">
                            <div className="p-3 pb-2 flex items-center justify-between text-sm font-semibold text-slate-700">
                                <span className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                    Shared / Done
                                </span>
                                <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-xs">
                                    {sharedQuestions.length}
                                </span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2 space-y-3 custom-scrollbar max-h-[600px]">
                                {sharedQuestions.map(q => (
                                    <QuestionKanbanCard key={q.id} question={q} />
                                ))}
                                {sharedQuestions.length === 0 && (
                                    <div className="text-center py-10 text-slate-400 text-xs italic">
                                        No active shared items
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>

    );
}
