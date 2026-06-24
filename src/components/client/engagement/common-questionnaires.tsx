"use client"

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, ArrowUpRight, Plus, Search, Check, Trash2, Loader2, X } from "lucide-react";
import Link from "next/link";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { getAvailableCommonQuestionnaires, addCommonQuestionnaire, removeCommonQuestionnaire } from "@/actions/client-le";
import { toast } from "sonner";
import { ProgressTracker } from "@/components/shared/progress-tracker";
import { cn } from "@/lib/utils";

const DASHBOARD_GRID_V2 = "grid-cols-[minmax(350px,1fr)_60px_160px_160px_150px]";

function MicroChart({ value, total, colorClass, emptyClass, numeratorLabel, denominatorLabel }: { value: number, total: number, colorClass: string, emptyClass: string, numeratorLabel: string, denominatorLabel: string }) {
    if (total === 0) {
        return <div className="text-[10px] text-slate-300 h-full w-full flex items-center pr-4 italic">No data</div>;
    }
    
    const percent = Math.min(100, Math.max(0, (value / total) * 100));
    
    return (
        <div className="flex flex-col gap-1 w-full pr-4 mt-0.5">
            <div className="flex justify-between items-baseline leading-none">
                <span className={cn("text-xs font-bold font-mono", percent > 0 ? colorClass : "text-slate-300")}>
                    {value}
                </span>
                <span className="text-[9px] text-slate-400 font-medium font-mono uppercase tracking-tighter">
                    {(total - value)} {denominatorLabel}
                </span>
            </div>
            <div className={cn("h-1 w-full rounded-full overflow-hidden flex", emptyClass)}>
                <div className={cn("h-full transition-all duration-500")} style={{ width: `${percent}%`, backgroundColor: 'currentColor' }} />
            </div>
        </div>
    );
}

interface CommonQuestionnairesProps {
    leId: string;
    initialQuestionnaires: any[];
}

export function CommonQuestionnaires({ leId, initialQuestionnaires }: CommonQuestionnairesProps) {
    const [linked, setLinked] = useState(initialQuestionnaires || []);
    const [available, setAvailable] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

    useEffect(() => {
        setLinked(initialQuestionnaires || []);
    }, [initialQuestionnaires]);

    const fetchAvailable = async () => {
        setIsLoading(true);
        const res = await getAvailableCommonQuestionnaires(leId);
        if (res.success && res.snapshots) {
            setAvailable(res.snapshots);
        }
        setIsLoading(false);
    };

    const handleAdd = async (snapshot: any) => {
        // Optimistic UI
        if (linked.find((q: any) => q.id === snapshot.id)) {
             toast.error("Already added");
             return;
        }

        const prev = [...linked];
        setLinked([...linked, snapshot]);
        setOpen(false);

        const res = await addCommonQuestionnaire(leId, snapshot.id);
        if (res.success) {
            toast.success(`Added ${snapshot.name}`);
        } else {
            setLinked(prev);
            toast.error("Failed to add questionnaire");
        }
    };

    const handleRemove = async (id: string, name: string) => {
        const prev = [...linked];
        setLinked(linked.filter((q: any) => q.id !== id));

        toast.promise(removeCommonQuestionnaire(leId, id), {
            loading: "Removing...",
            success: `Removed ${name}`,
            error: () => {
                setLinked(prev);
                return "Failed to remove";
            }
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-semibold text-slate-900">Common Questionnaires</h2>
                    <p className="text-sm text-slate-500 mt-1">Core questionnaires shared across all of your suppliers.</p>
                </div>
                
                <Popover open={open} onOpenChange={(val) => { setOpen(val); if (val) fetchAvailable(); }}>
                    <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full md:w-[300px] justify-between text-slate-600 border-slate-300">
                            Search and add...
                            <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full md:w-[400px] p-0" align="end">
                        <Command>
                            <CommandInput placeholder="Search global questionnaires..." />
                            <CommandList>
                                <CommandEmpty>
                                    {isLoading ? "Loading..." : "No questionnaires found."}
                                </CommandEmpty>
                                <CommandGroup>
                                    {available.map((snapshot) => (
                                        <CommandItem
                                            key={snapshot.id}
                                            value={`${snapshot.name} ${snapshot.description || ""}`}
                                            onSelect={() => handleAdd(snapshot)}
                                            className="flex flex-col items-start py-3 cursor-pointer"
                                        >
                                            <div className="flex items-center w-full">
                                                <FileText className="mr-2 h-4 w-4 text-indigo-500 shrink-0" />
                                                <span className="font-medium truncate flex-1">{snapshot.name}</span>
                                                {linked.find((q: any) => q.id === snapshot.id) && (
                                                    <Check className="ml-2 h-4 w-4 text-indigo-600 shrink-0" />
                                                )}
                                            </div>
                                            {snapshot.referenceCode && (
                                                <span className="text-xs text-slate-400 mt-1 ml-6">{snapshot.referenceCode}</span>
                                            )}
                                            {snapshot.description && (
                                                <span className="text-xs text-slate-500 mt-0.5 ml-6 line-clamp-1">{snapshot.description}</span>
                                            )}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
            </div>

            {linked.length > 0 ? (
                <div className="flex flex-col gap-3">
                    {/* --- 2-Tier Header Row --- */}
                    <div className={cn("hidden md:grid items-center px-4 py-2 border-b border-slate-200 bg-slate-50/80 rounded-t-xl border-x border-t", DASHBOARD_GRID_V2)}>
                        {/* 1. Entity */}
                        <div className="flex items-center gap-2 pr-4 pl-1">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-[44px]">Common Questionnaires</span>
                        </div>

                        {/* 2. Anchor (Total) */}
                        <div className="text-center pb-0.5">
                            <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Total</span>
                        </div>

                        {/* 3. Sourcing Group */}
                        <div className="flex flex-col border-l border-slate-200 pl-4 h-full">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-[2px]">Data Sourcing</span>
                            <div className="flex justify-between pr-4 items-end">
                                <span className="text-[10px] font-bold text-sky-600 uppercase">Mapped</span>
                            </div>
                        </div>

                        {/* 4. Completion Group */}
                        <div className="flex flex-col border-l border-slate-200 pl-4 h-full">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-[2px]">Completion</span>
                            <div className="flex justify-between pr-4 items-end">
                                <span className="text-[10px] font-bold text-amber-600 uppercase">Answered</span>
                            </div>
                        </div>

                        {/* 5. Workflow Group */}
                        <div className="flex flex-col border-l border-slate-200 pl-4 h-full">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-[2px]">Sign-Off</span>
                            <div className="flex justify-between pr-[18px] items-end">
                                <span className="text-[10px] font-bold text-indigo-600 uppercase">Apprv</span>
                                <span className="text-[10px] font-bold text-emerald-600 uppercase">Relsd</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-3">
                        {linked.map((q: any) => (
                            <div key={q.id} className="p-3 rounded-lg border border-slate-200 bg-white shadow-sm hover:border-indigo-300 transition-colors group/card">
                                <div className={cn("hidden md:grid items-center gap-2", DASHBOARD_GRID_V2)}>
                                    {/* Col 1: Name and Badges */}
                                    <div className="flex items-center gap-3 overflow-hidden pr-4 pl-1">
                                        <div className="h-8 w-8 rounded bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                            <FileText className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-col gap-0.5 min-w-0">
                                                <h3 className="font-semibold text-[13.5px] text-slate-900 group-hover/card:text-indigo-600 transition-colors leading-none truncate" title={q.name}>{q.name}</h3>
                                                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                                    <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[9px] uppercase font-bold px-1.5 py-0 h-4 shrink-0">
                                                        COMMON TEMPLATE
                                                    </Badge>
                                                    {q.referenceCode && (
                                                        <span className="text-[10px] text-slate-500 shrink-0">{q.referenceCode}</span>
                                                    )}
                                                </div>
                                                {q.description && (
                                                    <span className="text-xs text-slate-500 mt-0.5 truncate">{q.description}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Col 2: Total */}
                                    <div className="text-center font-bold text-slate-600 text-[14px]">
                                        {q.metrics?.total || 0}
                                    </div>

                                    {/* Col 3: Data Sourcing */}
                                    <div className="border-l border-slate-100 pl-4 flex flex-col justify-center h-full text-sky-500">
                                        {q.metrics && <MicroChart value={q.metrics.mapped} total={q.metrics.total} colorClass="text-sky-500" emptyClass="bg-slate-100" numeratorLabel="Mapped" denominatorLabel="Unmapped" />}
                                    </div>

                                    {/* Col 4: Completion */}
                                    <div className="border-l border-slate-100 pl-4 flex flex-col justify-center h-full text-amber-500">
                                        {q.metrics && <MicroChart value={q.metrics.answered} total={q.metrics.total} colorClass="text-amber-500" emptyClass="bg-slate-100" numeratorLabel="Answered" denominatorLabel="Blank" />}
                                    </div>

                                    {/* Col 5: Sign-Off and Actions */}
                                    <div className="border-l border-slate-100 pl-4 pr-1 flex items-center justify-between h-full">
                                        {q.metrics ? (
                                            <>
                                                <div className="flex flex-col items-center gap-0.5">
                                                    <span className={cn("text-[13px] font-bold font-mono", q.metrics.approved > 0 ? "text-indigo-600" : "text-slate-300")}>{q.metrics.approved}</span>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Apprv</span>
                                                </div>
                                                <div className="flex flex-col items-center gap-0.5">
                                                    <span className={cn("text-[13px] font-bold font-mono", q.metrics.released > 0 ? "text-emerald-600" : "text-slate-300")}>{q.metrics.released}</span>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Relsd</span>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-xs text-slate-500 italic pr-4">No data</div>
                                        )}
                                        <div className="shrink-0 flex items-center gap-1 pl-4">
                                            {confirmRemoveId === q.id ? (
                                                <div className="flex items-center gap-1 animate-in fade-in zoom-in duration-200">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm"
                                                        onClick={() => { setConfirmRemoveId(null); handleRemove(q.id, q.name); }}
                                                        className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 px-2 text-xs"
                                                    >
                                                        Yes
                                                    </Button>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm"
                                                        onClick={() => setConfirmRemoveId(null)}
                                                        className="text-slate-500 hover:text-slate-700 hover:bg-slate-100 h-8 px-2 text-xs"
                                                    >
                                                        No
                                                    </Button>
                                                </div>
                                            ) : (
                                                <>
                                                    <Link 
                                                        href={`/app/le/${leId}/workbench4?rel=Common&q=${encodeURIComponent(q.name)}`}
                                                        className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                                                        title="Review in Question Bank"
                                                    >
                                                        <ArrowUpRight className="h-4 w-4" />
                                                    </Link>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                                        onClick={() => setConfirmRemoveId(q.id)}
                                                        title="Remove Common Questionnaire"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Mobile View */}
                                <div className="md:hidden flex flex-col gap-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                                <FileText className="h-4 w-4" />
                                            </div>
                                            <div className="flex flex-col gap-0.5 min-w-0">
                                                <h3 className="font-semibold text-sm text-slate-900 leading-none truncate">{q.name}</h3>
                                                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                                    <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] uppercase font-bold px-1.5 py-0">
                                                        COMMON TEMPLATE
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>
                                        {confirmRemoveId === q.id ? (
                                            <div className="flex items-center gap-1 animate-in fade-in zoom-in duration-200">
                                                <Button variant="ghost" size="sm" onClick={() => { setConfirmRemoveId(null); handleRemove(q.id, q.name); }} className="text-red-600 h-6 px-2 text-xs">Yes</Button>
                                                <Button variant="ghost" size="sm" onClick={() => setConfirmRemoveId(null)} className="text-slate-500 h-6 px-2 text-xs">No</Button>
                                            </div>
                                        ) : (
                                            <div className="shrink-0 flex items-center gap-1">
                                                <Link href={`/app/le/${leId}/workbench4?rel=Common&q=${encodeURIComponent(q.name)}`} className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-400">
                                                    <ArrowUpRight className="h-4 w-4" />
                                                </Link>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400" onClick={() => setConfirmRemoveId(q.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                    {q.metrics && (
                                        <ProgressTracker metrics={q.metrics} variant={"v2" as any} className="w-full bg-slate-50/50" />
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                 <div className="text-center py-10 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                     <p className="text-slate-500">No Common Questionnaires added yet.</p>
                     <p className="text-sm text-slate-400 mt-1">Search above to add standard questionnaires.</p>
                 </div>
            )}
        </div>
    );
}
