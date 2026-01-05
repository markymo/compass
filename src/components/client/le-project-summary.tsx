import { Badge } from "@/components/ui/badge";
import { Building2, ClipboardCheck, MessageSquare } from "lucide-react";

interface LEProjectSummaryProps {
    name: string;
    jurisdiction?: string | null;
    status: string;
    progress?: {
        filled: number;
        total: number;
    } | null;
    openQueries?: number;
    pendingDocs?: number;
}

export function LEProjectSummary({
    name,
    jurisdiction,
    status,
    progress,
    openQueries = 0,
    pendingDocs = 0
}: LEProjectSummaryProps) {
    const percentage = progress ? Math.round((progress.filled / progress.total) * 100) : 0;

    return (
        <div className="bg-white dark:bg-slate-950 border rounded-xl p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                        <Building2 className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">{name}</h1>
                        <p className="text-slate-500 text-sm">
                            {jurisdiction} • <Badge variant="secondary" className="ml-1 uppercase text-[10px]">{status}</Badge>
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 md:gap-8">
                    <div className="flex flex-col gap-1">
                        <span className="text-xs text-slate-500 uppercase font-semibold">Global Progress</span>
                        <div className="flex items-center gap-3">
                            <div className="w-32 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-blue-600 dark:bg-blue-500 transition-all duration-500"
                                    style={{ width: `${percentage}%` }}
                                />
                            </div>
                            <span className="text-sm font-bold">{percentage}%</span>
                        </div>
                    </div>

                    <div className="h-10 w-px bg-slate-200 dark:bg-slate-800 hidden md:block" />

                    <div className="flex items-center gap-6">
                        <div className="flex flex-col">
                            <span className="text-xs text-slate-500 uppercase font-semibold">Open Queries</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <MessageSquare className="h-4 w-4 text-amber-500" />
                                <span className="text-sm font-bold">{openQueries}</span>
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs text-slate-500 uppercase font-semibold">Pending Docs</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <ClipboardCheck className="h-4 w-4 text-blue-500" />
                                <span className="text-sm font-bold">{pendingDocs}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
