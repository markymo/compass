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
                                            value={snapshot.name}
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
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
            </div>

            {linked.length > 0 ? (
                <div className="grid gap-4">
                    {linked.map((q: any) => (
                        <Card key={q.id} className="hover:border-indigo-300 transition-colors group border-slate-200 shadow-sm">
                            <CardContent className="p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-start md:items-center gap-4">
                                    <div className="h-10 w-10 md:h-12 md:w-12 rounded bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                        <FileText className="h-5 w-5 md:h-6 md:w-6" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-base md:text-lg text-slate-900 truncate">
                                            {q.name}
                                        </h3>
                                        <div className="flex flex-wrap items-center gap-2 mt-1">
                                            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] uppercase font-bold px-1.5 py-0">
                                                GLOBAL TEMPLATE
                                            </Badge>
                                            {q.referenceCode && (
                                                <span className="text-xs text-slate-500 ml-2">{q.referenceCode}</span>
                                            )}
                                        </div>
                                        {q.metrics && (
                                            <div className="flex items-center gap-6 mt-1">
                                                <div className="flex-1 min-w-0">
                                                    <ProgressTracker metrics={q.metrics} variant={"v2" as any} className="w-full bg-slate-50/20" />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 w-full md:w-auto pb-1 md:pb-0">
                                    <Link 
                                        href={`/app/le/${leId}/workbench4?rel=Common&q=${encodeURIComponent(q.name)}`}
                                        className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                                        title="Open in Data Workbench"
                                    >
                                        <ArrowUpRight className="h-4 w-4" />
                                    </Link>
                                    {confirmRemoveId === q.id ? (
                                        <div className="flex items-center gap-1 animate-in fade-in zoom-in duration-200">
                                            <span className="text-xs text-slate-500 mr-1">Sure?</span>
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
                                        <Button 
                                            variant="ghost" 
                                            size="icon"
                                            onClick={() => setConfirmRemoveId(q.id)}
                                            className="text-slate-400 hover:text-red-600 hover:bg-red-50 h-8 w-8"
                                            title="Remove"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
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
