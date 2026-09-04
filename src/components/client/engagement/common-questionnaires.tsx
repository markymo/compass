"use client"

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, ArrowUpRight, ArrowRight, Plus, Search, Check, Trash2, Loader2, X, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { getAvailableCommonQuestionnaires, addCommonQuestionnaire, removeCommonQuestionnaire } from "@/actions/client-le";
import { toast } from "sonner";
import { ProgressTracker } from "@/components/shared/progress-tracker";
import { QuestionStateMetricStrip, QuestionStateMetricHeader } from "@/components/shared/question-state-metric-strip";
import { cn } from "@/lib/utils";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-dialogs";
import { CreateApprovalDialog } from "@/components/client/approvals/create-approval-dialog";

const DASHBOARD_GRID_V2 = "grid-cols-[1fr_432px_300px] gap-4";

interface CommonQuestionnairesProps {
    leId: string;
    initialQuestionnaires: any[];
}

export function CommonQuestionnaires({ leId, initialQuestionnaires }: CommonQuestionnairesProps) {
    const [linked, setLinked] = useState(initialQuestionnaires || []);
    const [available, setAvailable] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [activePopover, setActivePopover] = useState<'header' | 'empty' | null>(null);
    const [addingId, setAddingId] = useState<string | null>(null);
    const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);
    const [approvalQuestionnaireId, setApprovalQuestionnaireId] = useState<string | null>(null);

    useEffect(() => {
        setLinked(initialQuestionnaires || []);
    }, [initialQuestionnaires]);

    const fetchAvailable = async () => {
        setIsLoading(true);
        try {
            const res = await getAvailableCommonQuestionnaires(leId);
            if (res.success && res.snapshots) {
                setAvailable(res.snapshots);
            } else {
                toast.error(res.error || "Failed to load questionnaires");
            }
        } catch (error) {
            console.error("Error fetching questionnaires:", error);
            toast.error("Failed to load questionnaires");
        } finally {
            setIsLoading(false);
        }
    };

    const handleAdd = async (snapshot: any) => {
        if (addingId) return;

        // Optimistic UI check for existing linked instance or reference snapshot
        if (linked.find((q: any) => q.id === snapshot.id || q.sourceId === snapshot.id)) {
             toast.error("Already added");
             return;
        }

        setAddingId(snapshot.id);
        const prev = [...linked];
        setLinked([...linked, snapshot]);
        setActivePopover(null);

        try {
            const res = await addCommonQuestionnaire(leId, snapshot.id);
            if (res.success) {
                toast.success(`Added ${snapshot.name}`);
            } else {
                setLinked(prev);
                toast.error(res.error || "Failed to add questionnaire");
            }
        } catch (error) {
            setLinked(prev);
            toast.error("Failed to add questionnaire");
        } finally {
            setAddingId(null);
        }
    };

    const handleRemoveConfirm = async () => {
        if (!removeTarget) return;
        const { id, name } = removeTarget;
        const prev = [...linked];
        setLinked(linked.filter((q: any) => q.id !== id));

        toast.promise(removeCommonQuestionnaire(leId, id), {
            loading: "Removing...",
            success: `Removed ${name}`,
            error: () => {
                setLinked(prev);
                return "Failed to remove questionnaire";
            }
        });
    };

    const renderPopoverContent = (align: "end" | "center") => (
        <PopoverContent className="w-full md:w-[400px] p-0" align={align}>
            <Command>
                <CommandInput placeholder="Search global questionnaires..." />
                <CommandList>
                    <CommandEmpty>
                        {isLoading ? "Loading..." : "No questionnaires found."}
                    </CommandEmpty>
                    <CommandGroup>
                        {available.map((snapshot) => {
                            const isLinked = linked.some((q: any) => q.id === snapshot.id || q.sourceId === snapshot.id);
                            const isAddingThis = addingId === snapshot.id;

                            return (
                                <CommandItem
                                    key={snapshot.id}
                                    value={`${snapshot.id} ${snapshot.name} ${snapshot.referenceCode || ""} ${snapshot.functionalCode || ""} ${snapshot.description || ""}`}
                                    onSelect={() => handleAdd(snapshot)}
                                    onPointerDown={(e) => {
                                        e.preventDefault();
                                        handleAdd(snapshot);
                                    }}
                                    className="flex flex-col items-start py-3 cursor-pointer"
                                    disabled={isAddingThis}
                                >
                                    <div className="flex items-center w-full">
                                        <FileText className="mr-2 h-4 w-4 text-indigo-500 shrink-0" />
                                        <span className="font-medium truncate flex-1">{snapshot.name}</span>
                                        {isAddingThis ? (
                                            <Loader2 className="ml-2 h-4 w-4 animate-spin text-indigo-500 shrink-0" />
                                        ) : isLinked ? (
                                            <Check className="ml-2 h-4 w-4 text-indigo-600 shrink-0" />
                                        ) : null}
                                    </div>
                                    {snapshot.referenceCode && (
                                        <span className="text-xs text-slate-400 mt-1 ml-6">{snapshot.referenceCode}</span>
                                    )}
                                    {snapshot.description && (
                                        <span className="text-xs text-slate-500 mt-0.5 ml-6 line-clamp-1">{snapshot.description}</span>
                                    )}
                                </CommandItem>
                            );
                        })}
                    </CommandGroup>
                </CommandList>
            </Command>
        </PopoverContent>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-semibold text-foreground">Common Questionnaires</h2>
                    <p className="text-sm text-muted-foreground mt-1">Core questionnaires shared across all of your suppliers.</p>
                </div>
                
                <Popover
                    open={activePopover === 'header'}
                    onOpenChange={(val) => {
                        setActivePopover(val ? 'header' : null);
                        if (val) fetchAvailable();
                    }}
                >
                    <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 text-xs px-2 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-700 dark:hover:text-indigo-300 w-fit">
                            <Plus className="h-3 w-3 mr-1" />
                            Add
                        </Button>
                    </PopoverTrigger>
                    {renderPopoverContent("end")}
                </Popover>
            </div>

            {linked.length > 0 ? (
                <Card className="overflow-hidden border border-border bg-card shadow-none rounded-xl">
                    {/* --- Grouped 2-Tier Header Row --- */}
                    <div className={cn("hidden md:grid items-center px-4 py-2.5 bg-muted/40 border-b border-border text-foreground", DASHBOARD_GRID_V2)}>
                        {/* 1. Entity */}
                        <div className="flex items-center gap-2 pl-2">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Questionnaire</span>
                        </div>

                        {/* 2. Grouped Canonical Metrics (Questions & Answers) */}
                        <QuestionStateMetricHeader />

                        {/* 3. Status & Actions */}
                        <div className="flex flex-col gap-1 text-right justify-end pr-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-transparent select-none">Status</span>
                            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Status / Actions</span>
                        </div>
                    </div>

                    {/* --- Rows --- */}
                    <div className="divide-y divide-border">
                        {linked.map((q: any) => (
                            <div key={q.id} className="px-4 py-2.5 hover:bg-muted/30 transition-colors group/row">
                                <div className={cn("hidden md:grid items-center", DASHBOARD_GRID_V2)}>
                                    {/* Col 1: Questionnaire Name + Ref */}
                                    <div className="flex items-center gap-3 overflow-hidden min-w-0 pl-2 pr-4">
                                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                                        <div className="min-w-0 flex-1 flex flex-col">
                                            <span className="font-medium text-sm text-foreground truncate group-hover/row:text-indigo-600 dark:group-hover/row:text-indigo-400 transition-colors" title={q.name}>
                                                {q.name}
                                            </span>
                                            {q.referenceCode && (
                                                <span className="text-[10px] text-muted-foreground font-mono tracking-tight">
                                                    {q.referenceCode}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Col 2: Canonical Metrics (Home 5-part block, no / 1) */}
                                    {q.v2Metrics ? (
                                        <QuestionStateMetricStrip
                                            metrics={q.v2Metrics}
                                            variant="table-row"
                                            showQuestionnairesCount={false}
                                            linkContext={{
                                                leId,
                                                relationshipName: "Common",
                                                questionnaireName: q.name,
                                            }}
                                        />
                                    ) : (
                                        <div className="text-right font-bold font-mono text-sm text-foreground pr-3">
                                            {q.metrics?.total || 0}
                                        </div>
                                    )}

                                    {/* Col 3: Status & Actions (demoted, outside metric block) */}
                                    <div className="flex items-center justify-end gap-3 text-right">
                                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                                            <span className={cn("font-mono font-medium", q.metrics?.approved > 0 ? "text-slate-700 dark:text-zinc-200" : "text-muted-foreground/60")}>
                                                {q.metrics?.approved || 0}
                                            </span> Approved · <span className={cn("font-mono font-medium", q.metrics?.released > 0 ? "text-slate-700 dark:text-zinc-200" : "text-muted-foreground/60")}>
                                                {q.metrics?.released || 0}
                                            </span> Released
                                        </span>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setApprovalQuestionnaireId(q.id)}
                                                className="h-7 text-xs text-muted-foreground hover:text-foreground px-2 flex items-center gap-1 font-medium"
                                                title="Approve Common Questionnaire"
                                            >
                                                <ShieldCheck className="h-3.5 w-3.5" />
                                                Approve
                                            </Button>
                                            <Link 
                                                href={`/app/le/${leId}/workbench4?rel=Common&q=${encodeURIComponent(q.name)}`}
                                                className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
                                                title="Review in Question Bank"
                                            >
                                                <ArrowRight className="h-4 w-4" />
                                            </Link>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                                                onClick={() => setRemoveTarget({ id: q.id, name: q.name })}
                                                title="Remove Common Questionnaire"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Mobile View */}
                                <div className="md:hidden flex flex-col gap-3 py-1">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="h-8 w-8 rounded bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                                                <FileText className="h-4 w-4" />
                                            </div>
                                            <div className="flex flex-col gap-0.5 min-w-0">
                                                <h3 className="font-semibold text-sm text-foreground leading-none truncate">{q.name}</h3>
                                                {q.referenceCode && (
                                                    <span className="text-[10px] text-muted-foreground shrink-0 font-mono">{q.referenceCode}</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="shrink-0 flex items-center gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setApprovalQuestionnaireId(q.id)}
                                                className="h-7 text-xs text-muted-foreground hover:text-foreground px-2 flex items-center gap-1 font-medium"
                                                title="Approve Common Questionnaire"
                                            >
                                                <ShieldCheck className="h-3.5 w-3.5" />
                                                Approve
                                            </Button>
                                            <Link href={`/app/le/${leId}/workbench4?rel=Common&q=${encodeURIComponent(q.name)}`} className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground">
                                                <ArrowRight className="h-4 w-4" />
                                            </Link>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setRemoveTarget({ id: q.id, name: q.name })}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                    {q.v2Metrics ? (
                                        <QuestionStateMetricStrip
                                            metrics={q.v2Metrics}
                                            variant="card-row"
                                            showQuestionnairesCount={false}
                                            linkContext={{
                                                leId,
                                                relationshipName: "Common",
                                                questionnaireName: q.name,
                                            }}
                                            className="w-full bg-muted/40 p-2 rounded"
                                        />
                                    ) : q.metrics ? (
                                        <ProgressTracker metrics={q.metrics} variant={"v2" as any} className="w-full bg-muted/50" />
                                    ) : null}
                                    <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                                        <span>{q.metrics?.approved || 0} Approved · {q.metrics?.released || 0} Released</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            ) : (
                 <div className="text-center py-10 bg-card text-card-foreground rounded-md border border-dashed border-border">
                     <p className="font-medium text-foreground">No Common Questionnaires added yet.</p>
                     <p className="text-sm text-muted-foreground mt-1 mb-4">Use the + Add button to search and add standard questionnaires.</p>
                     <Popover
                         open={activePopover === 'empty'}
                         onOpenChange={(val) => {
                             setActivePopover(val ? 'empty' : null);
                             if (val) fetchAvailable();
                         }}
                     >
                         <PopoverTrigger asChild>
                             <Button variant="outline" size="sm" className="h-8 text-xs px-3 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-700 dark:hover:text-indigo-300">
                                 <Plus className="h-3.5 w-3.5 mr-1.5" />
                                 Add Questionnaire
                             </Button>
                         </PopoverTrigger>
                         {renderPopoverContent("center")}
                     </Popover>
                 </div>
            )}

            <ConfirmDeleteDialog
                open={removeTarget !== null}
                onOpenChange={(open) => { if (!open) setRemoveTarget(null); }}
                itemName={removeTarget?.name}
                title="Remove Common Questionnaire?"
                description={removeTarget ? `This will remove "${removeTarget.name}" from your common questionnaires list.` : ""}
                confirmLabel="Remove Questionnaire"
                onConfirm={handleRemoveConfirm}
                isLoading={isLoading}
            />

            <CreateApprovalDialog
                open={Boolean(approvalQuestionnaireId)}
                onOpenChange={(open) => !open && setApprovalQuestionnaireId(null)}
                clientLEId={leId}
                initialQuestionnaireId={approvalQuestionnaireId || undefined}
            />
        </div>
    );
}
