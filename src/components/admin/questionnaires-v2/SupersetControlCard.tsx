"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { QV2Row, generateSupersetAction } from "@/actions/questionnaires-v2";
import { Sparkles, FileCheck, ExternalLink, RefreshCw, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface SupersetControlCardProps {
    activeMasterFieldCount: number;
    existingSuperset: QV2Row | null;
}

function DialogShell({ children, onBackdropClick }: { children: React.ReactNode; onBackdropClick?: () => void }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" onClick={onBackdropClick} />
            <div className="relative bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-sm">{children}</div>
        </div>
    );
}

export function SupersetControlCard({ activeMasterFieldCount, existingSuperset }: SupersetControlCardProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [showConfirm, setShowConfirm] = useState(false);

    function handleGenerate() {
        startTransition(async () => {
            try {
                const res = await generateSupersetAction();
                if (res.success && res.questionnaireId) {
                    toast.success("Superset Working Copy ready");
                    router.push(`/app/admin/questionnaires/${res.questionnaireId}`);
                } else {
                    toast.error("Failed to generate Superset", { description: res.error });
                }
            } catch (err: any) {
                toast.error("Error generating Superset", { description: err.message });
            }
        });
    }

    function handleRefresh() {
        startTransition(async () => {
            try {
                const res = await generateSupersetAction({ force: true });
                if (res.success && res.questionnaireId) {
                    toast.success("Superset Working Copy refreshed");
                    setShowConfirm(false);
                    router.push(`/app/admin/questionnaires/${res.questionnaireId}`);
                } else {
                    toast.error("Failed to refresh Superset", { description: res.error });
                }
            } catch (err: any) {
                toast.error("Error refreshing Superset", { description: err.message });
            }
        });
    }

    if (!existingSuperset) {
        return (
            <div className="bg-slate-50 border border-slate-200 border-b-0 px-5 py-3.5 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3 max-w-2xl">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                        <Sparkles className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                                Superset from Master Schema
                            </h2>
                            <span className="text-[11px] font-medium bg-blue-100/60 text-blue-700 px-2 py-0.5 rounded-full">
                                {activeMasterFieldCount} active Master Fields
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                            Creates a Working Copy containing exactly one directly mapped question for every active Master Field.
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleGenerate}
                    disabled={isPending}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 transition-colors shrink-0 shadow-sm cursor-pointer"
                >
                    {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    Generate Superset from Master Schema
                </button>
            </div>
        );
    }

    return (
        <div className="bg-slate-50 border border-slate-200 border-b-0 px-5 py-3.5 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3 max-w-2xl">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                    <FileCheck className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                            Superset from Master Schema
                        </h2>
                        <span className="text-[11px] font-medium bg-emerald-100/60 text-emerald-700 px-2 py-0.5 rounded-full">
                            Active Working Copy ({existingSuperset.questionCount} questions)
                        </span>
                        <span className="text-[11px] text-slate-400">
                            {activeMasterFieldCount} active fields
                        </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        A Superset Working Copy is active in your library. You can open it in the Mapper or refresh it from the current active Master Fields.
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
                <button
                    onClick={() => router.push(`/app/admin/questionnaires/${existingSuperset.id}`)}
                    disabled={isPending}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
                >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open Superset
                </button>
                <button
                    onClick={() => setShowConfirm(true)}
                    disabled={isPending}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
                >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Refresh from Master Schema
                </button>
            </div>

            {showConfirm && (
                <DialogShell onBackdropClick={!isPending ? () => setShowConfirm(false) : undefined}>
                    <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-slate-100">
                        <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                            <AlertTriangle className="w-4 h-4 text-amber-600" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-slate-900">Refresh Superset from Master Schema?</h2>
                            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                                This will replace the existing Superset Working Copy with fresh questions mapped to the current active Master Fields ({activeMasterFieldCount} fields).
                            </p>
                        </div>
                    </div>
                    <div className="px-5 pt-4 pb-2 space-y-3">
                        <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                            <p className="text-xs text-amber-800 leading-relaxed font-medium">
                                Warning: Any custom edits or manual modifications made to this Working Copy will be overwritten.
                            </p>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                            Reference Snapshots, published questionnaires, and historical records will remain untouched.
                        </p>
                    </div>
                    <div className="flex items-center justify-end gap-2 px-5 pb-5 pt-3">
                        <button
                            onClick={() => setShowConfirm(false)}
                            disabled={isPending}
                            className="text-xs font-medium text-slate-600 hover:text-slate-900 px-4 py-2 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleRefresh}
                            disabled={isPending}
                            className="flex items-center gap-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 shadow-sm"
                        >
                            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                            {isPending ? "Refreshing…" : "Refresh Superset"}
                        </button>
                    </div>
                </DialogShell>
            )}
        </div>
    );
}
