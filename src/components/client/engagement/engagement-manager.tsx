"use client"

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus, Search, Loader2, X, FileText, ChevronRight, Folder, Download, Users, MoreVertical, Trash2, ArrowUpRight, Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { createFIEngagement } from "@/actions/client-le";
import { toast } from "sonner";
import { deleteEngagementByClient, searchFIs } from "@/actions/client";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { assignQuestionnaireToEngagement, deleteQuestionnaire } from "@/actions/questionnaire";
import { getDiscoverableReferenceSnapshotsForOrg } from "@/actions/questionnaires-v2";
import { ProgressTracker } from "@/components/shared/progress-tracker";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { usePreferences } from "@/components/providers/user-preferences-provider";
import { InlineDocumentManager, InlineOutputBuilder, InlineTeamManager } from "./inline-engagement-sections";
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

interface EngagementManagerProps {
    leId: string;
    initialEngagements: any[];
    leDueDate: Date | null;
}

export function EngagementManager({ leId, initialEngagements, leDueDate }: EngagementManagerProps) {
    const router = useRouter();
    const [engagements, setEngagements] = useState(initialEngagements);

    useEffect(() => {
        setEngagements(initialEngagements);
    }, [initialEngagements]);

    const { preferences, isLoading, updatePreference } = usePreferences();
    const [expandedEngagements, setExpandedEngagements] = useState<string[]>([]);
    const [isExpandedInit, setIsExpandedInit] = useState(false);
    
    const [expandedSections, setExpandedSections] = useState<Record<string, string[]>>({});
    const [isSectionsInit, setIsSectionsInit] = useState(false);

    useEffect(() => {
        if (!isLoading && !isExpandedInit) {
            setExpandedEngagements(preferences.relationshipsExpandedEngagements || []);
            setIsExpandedInit(true);
        }
        if (!isLoading && !isSectionsInit) {
            setExpandedSections(preferences.relationshipsExpandedSections || {});
            setIsSectionsInit(true);
        }
    }, [isLoading, isExpandedInit, isSectionsInit, preferences.relationshipsExpandedEngagements, preferences.relationshipsExpandedSections]);

    const handleAccordionChange = (val: string[]) => {
        setExpandedEngagements(val);
        updatePreference('relationshipsExpandedEngagements', val);
    };

    const handleSectionsAccordionChange = (engId: string, val: string[]) => {
        const next = { ...expandedSections, [engId]: val };
        setExpandedSections(next);
        updatePreference('relationshipsExpandedSections', next);
    };

    const [isAdding, setIsAdding] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // --- Inline Questionnaire Management State ---
    const [popoversOpen, setPopoversOpen] = useState<Record<string, boolean>>({});
    const [availableQ, setAvailableQ] = useState<Record<string, any[]>>({});
    const [isLoadingAvailable, setIsLoadingAvailable] = useState<Record<string, boolean>>({});
    const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
    const [isRemoving, setIsRemoving] = useState<string | null>(null);
    const [isAddingQ, setIsAddingQ] = useState<string | null>(null);

    const fetchAvailableForEngagement = async (engId: string, fiOrgId: string) => {
        setIsLoadingAvailable(prev => ({ ...prev, [engId]: true }));
        try {
            const snapshots = await getDiscoverableReferenceSnapshotsForOrg(fiOrgId);
            setAvailableQ(prev => ({ ...prev, [engId]: snapshots || [] }));
        } catch (error) {
            console.error("Failed to fetch available questionnaires", error);
        }
        setIsLoadingAvailable(prev => ({ ...prev, [engId]: false }));
    };

    const handleAddQuestionnaire = async (engId: string, templateId: string, templateName: string) => {
        setIsAddingQ(templateId);
        setPopoversOpen(prev => ({ ...prev, [engId]: false }));
        
        toast.promise(assignQuestionnaireToEngagement(templateId, engId), {
            loading: `Adding ${templateName}...`,
            success: (res) => {
                setIsAddingQ(null);
                if (res.success) {
                    router.refresh();
                    return `Added ${templateName}`;
                }
                throw new Error(res.error || "Failed to add questionnaire");
            },
            error: (err) => {
                setIsAddingQ(null);
                return err.message || "Failed to add questionnaire";
            }
        });
    };

    const handleRemoveQuestionnaire = async (engId: string, instanceId: string, instanceName: string) => {
        setConfirmRemoveId(null);
        setIsRemoving(instanceId);
        
        // Optimistic UI Removal
        const previousEngagements = [...engagements];
        setEngagements(prev => prev.map(eng => {
            if (eng.id === engId) {
                const newEng = { ...eng };
                if (newEng.questionnaireInstances) {
                    newEng.questionnaireInstances = newEng.questionnaireInstances.filter((q: any) => q.id !== instanceId);
                } else if (newEng.questionnaires) {
                    newEng.questionnaires = newEng.questionnaires.filter((q: any) => q.id !== instanceId);
                }
                return newEng;
            }
            return eng;
        }));

        toast.promise(deleteQuestionnaire(instanceId), {
            loading: `Removing ${instanceName}...`,
            success: (res) => {
                setIsRemoving(null);
                if (res.success) {
                    router.refresh();
                    return `Removed ${instanceName}`;
                }
                setEngagements(previousEngagements);
                throw new Error(res.error || "Failed to remove questionnaire");
            },
            error: (err) => {
                setIsRemoving(null);
                setEngagements(previousEngagements);
                return err.message || "Failed to remove questionnaire";
            }
        });
    };

    // Initial Mock Data to show something before type
    const initialDirectory = [
        { value: "barclays", label: "Barclays", description: "Global Financial Services" },
        { value: "jpmorgan", label: "J.P. Morgan", description: "Leading Global Financial Services Firm" },
    ];

    const [searchResults, setSearchResults] = useState<{ value: string, label: string, description: string }[]>(initialDirectory);

    const handleAdd = async (fiName: string) => {
        setIsSubmitting(true);
        // Optimistic Update
        const tempId = `temp-${Date.now()}`;
        const newEng = {
            id: tempId,
            status: "PREPARATION",
            org: { name: fiName },
            questionnaires: [],
            _count: { sharedDocuments: 0, invitations: 0, memberships: 0 }
        };

        const previousEngagements = [...engagements as any[]];
        setEngagements([newEng, ...engagements]);
        setIsAdding(false);

        const result = await createFIEngagement(leId, fiName);

        if (result.success && result.engagement) {
            const realEng = {
                ...result.engagement,
                org: { name: fiName },
                questionnaires: [],
                _count: { sharedDocuments: 0, invitations: 0, memberships: 0 }
            };
            setEngagements(prev => prev.map((e: any) => e.id === tempId ? realEng : e));
            toast.success(`Relationship with ${fiName} created`);
        } else {
            setEngagements(previousEngagements);
            toast.error("Failed to create engagement: " + result.error);
        }
        setIsSubmitting(false);
    };

    const handleDelete = async (details: { id: string, name: string }) => {
        const previousEngagements = [...engagements];
        setEngagements(prev => prev.filter((e: any) => e.id !== details.id));
        toast.promise(deleteEngagementByClient(details.id), {
            loading: "Deleting engagement...",
            success: () => "Engagement deleted",
            error: (err) => {
                setEngagements(previousEngagements);
                return "Failed to delete";
            }
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-slate-900">Supplier Relationships</h2>
                </div>
                {!isAdding && (
                    <Button onClick={() => setIsAdding(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white" size="sm" title="Add Supplier">
                        <Plus className="h-4 w-4 mr-1.5" />
                        Relationship
                    </Button>
                )}
            </div>

            {isAdding && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <Card className="border-2 border-indigo-100 shadow-md bg-white overflow-hidden">
                        <div className="[&_[cmdk-item][data-selected='true']]:bg-slate-100 [&_[cmdk-item][data-selected='true']]:text-slate-900">
                            <Command className="rounded-none border-0" shouldFilter={false}>
                                <div className="flex items-center border-b border-slate-100 px-3 overflow-hidden">
                                    <Search className="h-4 w-4 shrink-0 opacity-50 text-slate-500 mr-2" />
                                    <CommandInput
                                        placeholder="Search for a bank to add..."
                                        autoFocus
                                        className="border-0 focus:ring-0 shadow-none px-0 h-12 text-base"
                                        onValueChange={(val) => {
                                            if (val.length > 2) {
                                                searchFIs(val).then((res: any) => setSearchResults(res));
                                            }
                                        }}
                                    />
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="ml-2 h-8 w-8 text-slate-400 hover:text-slate-600"
                                        onClick={() => setIsAdding(false)}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                                <CommandList className="max-h-[220px]">
                                    <CommandEmpty className="py-6 px-4 text-center">
                                        <p className="text-sm text-slate-500 mb-3">Institution not found.</p>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => handleAdd("New Partner Bank")}
                                        >
                                            + Create New Entry
                                        </Button>
                                    </CommandEmpty>
                                    <CommandGroup heading="Available Institutions">
                                        {searchResults.map((framework: any) => (
                                            <CommandItem
                                                key={framework.value}
                                                value={framework.value}
                                                onSelect={() => handleAdd(framework.label)}
                                                className="cursor-pointer py-3"
                                            >
                                                <Building2 className="mr-3 h-4 w-4 text-slate-400" />
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-slate-700">{framework.label}</span>
                                                    <span className="text-xs text-slate-400">{framework.description?.slice(0, 50)}...</span>
                                                </div>
                                                <div className="ml-auto opacity-0 group-data-[selected=true]:opacity-100">
                                                    <Plus className="h-4 w-4 text-slate-400" />
                                                </div>
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </div>
                    </Card>
                </div>
            )}

            {engagements.length > 0 ? (
                <div className="flex flex-col gap-3">
                    {/* --- 2-Tier Header Row --- */}
                    <div className={cn("hidden md:grid items-center px-4 py-2 border-b border-slate-200 bg-slate-50/80 rounded-t-xl border-x border-t", DASHBOARD_GRID_V2)}>
                        {/* 1. Entity */}
                        <div className="flex items-center gap-2 pr-4 pl-1">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-[44px]">Supplier Relationships</span>
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

                    <Accordion 
                        type="multiple" 
                        value={expandedEngagements}
                        onValueChange={handleAccordionChange}
                        className="space-y-3"
                    >
                    {engagements.map((eng: any) => {
                        const orgName = typeof eng.org === 'string' ? eng.org : eng.org?.name;
                        const docCount = eng._count?.sharedDocuments || 0;
                        const teamCount = (eng._count?.memberships || 0) + (eng._count?.invitations || 0);
                        const questionnaires = Array.isArray(eng.questionnaireInstances) && eng.questionnaireInstances.length > 0 
                            ? eng.questionnaireInstances 
                            : (eng.questionnaires || []);
                        const qCount = questionnaires.length || 0;

                        return (
                            <AccordionItem key={eng.id} value={eng.id} className="border border-slate-200 rounded-lg bg-white shadow-sm overflow-hidden data-[state=open]:border-indigo-200 transition-colors">
                                <div className="flex items-start justify-between pr-3 hover:bg-slate-50 transition-colors">
                                    <AccordionTrigger className="hover:no-underline px-4 py-3 flex-1">
                                        <div className={cn("hidden md:grid items-center w-full text-left", DASHBOARD_GRID_V2)}>
                                            {/* Col 1: Entity */}
                                            <div className="flex items-center gap-3 overflow-hidden pr-4">
                                                <div className="h-8 w-8 rounded bg-emerald-50 flex items-center justify-center shrink-0">
                                                    <Building2 className="h-4 w-4 text-emerald-600" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="font-bold text-[15px] text-slate-900 truncate">
                                                            {orgName}
                                                        </h3>
                                                        <Badge variant="outline" className={cn(
                                                            "text-[9px] uppercase font-bold px-1.5 py-0 h-4",
                                                            eng.status === 'INVITED' ? "bg-blue-50 text-blue-700 border-blue-200" :
                                                                "bg-slate-100 text-slate-600 border-slate-200"
                                                        )}>
                                                            {eng.status === 'PREPARATION' ? 'DRAFT' : eng.status}
                                                        </Badge>
                                                    </div>
                                                    <span className="text-xs text-slate-400">Supplier Relationship</span>
                                                </div>
                                            </div>

                                            {/* Col 2: Total Items */}
                                            <div className="text-center font-bold text-slate-700 text-[15px]">
                                                {eng.metrics?.total || 0}
                                            </div>

                                            {/* Col 3: Data Sourcing */}
                                            <div className="border-l border-slate-100 pl-4 flex flex-col justify-center h-full text-sky-500">
                                                {eng.metrics && <MicroChart value={eng.metrics.mapped} total={eng.metrics.total} colorClass="text-sky-500" emptyClass="bg-slate-100" numeratorLabel="Mapped" denominatorLabel="Unmapped" />}
                                            </div>

                                            {/* Col 4: Completion */}
                                            <div className="border-l border-slate-100 pl-4 flex flex-col justify-center h-full text-amber-500">
                                                {eng.metrics && <MicroChart value={eng.metrics.answered} total={eng.metrics.total} colorClass="text-amber-500" emptyClass="bg-slate-100" numeratorLabel="Answered" denominatorLabel="Blank" />}
                                            </div>

                                            {/* Col 5: Sign-Off */}
                                            <div className="border-l border-slate-100 pl-4 pr-1 flex items-center justify-between h-full">
                                                {eng.metrics && (
                                                    <>
                                                        <div className="flex flex-col items-center gap-0.5">
                                                            <span className={cn("text-[13px] font-bold font-mono", eng.metrics.approved > 0 ? "text-indigo-600" : "text-slate-300")}>{eng.metrics.approved}</span>
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Apprv</span>
                                                        </div>
                                                        <div className="flex flex-col items-center gap-0.5">
                                                            <span className={cn("text-[13px] font-bold font-mono", eng.metrics.released > 0 ? "text-emerald-600" : "text-slate-300")}>{eng.metrics.released}</span>
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Relsd</span>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Mobile View */}
                                        <div className="md:hidden flex flex-col text-left w-full gap-3">
                                            <div className="flex items-center justify-between min-w-0 pr-2">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded bg-emerald-50 flex items-center justify-center shrink-0">
                                                        <Building2 className="h-4 w-4 text-emerald-600" />
                                                    </div>
                                                    <h3 className="font-bold text-base text-slate-900 truncate">
                                                        {orgName}
                                                    </h3>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <Badge variant="outline" className={cn(
                                                        "text-[10px] uppercase font-bold px-1.5 py-0",
                                                        eng.status === 'INVITED' ? "bg-blue-50 text-blue-700 border-blue-200" :
                                                            "bg-slate-100 text-slate-600 border-slate-200"
                                                    )}>
                                                        {eng.status === 'PREPARATION' ? 'DRAFT' : eng.status}
                                                    </Badge>
                                                </div>
                                            </div>
                                            {eng.metrics && (
                                                <div className="w-full pr-2">
                                                    <ProgressTracker metrics={eng.metrics} variant={"v2" as any} className="w-full bg-slate-50/50" />
                                                </div>
                                            )}
                                        </div>
                                    </AccordionTrigger>
                                    
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-slate-400 mt-3">
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem
                                                className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
                                                onClick={() => handleDelete({ id: eng.id, name: orgName })}
                                            >
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Delete Relationship
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>

                                <AccordionContent className="border-t border-slate-100 bg-slate-50/30 pb-4 pt-3 px-4">
                                    <div className="flex flex-col gap-2">
                                        {/* Nested Accordion for Sections */}
                                        <Accordion 
                                            type="multiple" 
                                            value={expandedSections[eng.id] || []} 
                                            onValueChange={(val) => handleSectionsAccordionChange(eng.id, val)} 
                                            className="w-full flex flex-col gap-2"
                                        >
                                            <AccordionItem value="questionnaires" className="border border-slate-200 rounded-md overflow-hidden bg-white shadow-sm data-[state=open]:border-indigo-200 transition-colors">
                                                <div className="flex items-center justify-between bg-slate-50/50 pr-4 w-full border-b border-transparent">
                                                    <AccordionTrigger className="hover:no-underline px-4 py-3 text-sm font-semibold text-slate-700 flex-1 hover:bg-slate-50/80">
                                                        <div className="flex items-center gap-2">
                                                            <FileText className="w-4 h-4 text-indigo-500" />
                                                            Questionnaires
                                                            <Badge variant="secondary" className="ml-2 bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0">{qCount}</Badge>
                                                        </div>
                                                    </AccordionTrigger>
                                                    <div className="shrink-0 z-10 relative">
                                                        <Popover 
                                                            open={popoversOpen[eng.id] || false} 
                                                            onOpenChange={(val) => { 
                                                                setPopoversOpen(prev => ({ ...prev, [eng.id]: val })); 
                                                                if (val) fetchAvailableForEngagement(eng.id, eng.fiOrgId); 
                                                            }}
                                                        >
                                                            <PopoverTrigger asChild>
                                                                <Button variant="outline" size="sm" className="h-7 text-xs px-2 text-indigo-600 border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700">
                                                                    <Plus className="h-3 w-3 mr-1" />
                                                                    Add
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-[300px] p-0" align="end" onClick={(e) => e.stopPropagation()}>
                                                                <Command>
                                                                    <CommandInput placeholder="Search available questionnaires..." />
                                                                    <CommandList>
                                                                        <CommandEmpty>
                                                                            {isLoadingAvailable[eng.id] ? "Loading..." : "No questionnaires found."}
                                                                        </CommandEmpty>
                                                                        <CommandGroup>
                                                                            {(availableQ[eng.id] || []).map((snapshot) => (
                                                                                <CommandItem
                                                                                    key={snapshot.id}
                                                                                    value={`${snapshot.id} ${snapshot.name} ${snapshot.referenceCode || ""} ${snapshot.functionalCode || ""}`}
                                                                                    onSelect={() => handleAddQuestionnaire(eng.id, snapshot.id, snapshot.name)}
                                                                                    className="flex flex-col items-start py-3 cursor-pointer"
                                                                                    disabled={isAddingQ === snapshot.id}
                                                                                >
                                                                                    <div className="flex items-center w-full">
                                                                                        <FileText className="mr-2 h-4 w-4 text-indigo-500 shrink-0" />
                                                                                        <span className="font-medium truncate flex-1">{snapshot.name}</span>
                                                                                        {isAddingQ === snapshot.id && <Loader2 className="ml-2 h-4 w-4 animate-spin text-indigo-500" />}
                                                                                    </div>
                                                                                    {snapshot.referenceCode && (
                                                                                        <span className="text-[10px] text-slate-400 mt-1 ml-6">{snapshot.referenceCode}</span>
                                                                                    )}
                                                                                </CommandItem>
                                                                            ))}
                                                                        </CommandGroup>
                                                                    </CommandList>
                                                                </Command>
                                                            </PopoverContent>
                                                        </Popover>
                                                    </div>
                                                </div>
                                                <AccordionContent className="border-t border-slate-100 p-0">
                                                    {qCount > 0 ? (
                                                        <div className="divide-y divide-slate-100">
                                                            {questionnaires.map((q: any) => (
                                                                <div key={q.id} className="p-3 hover:bg-slate-50 transition-colors group/card">
                                                                    <div className={cn("hidden md:grid items-center gap-2", DASHBOARD_GRID_V2)}>
                                                                        {/* Col 1: Name */}
                                                                        <div className="flex items-center gap-3 overflow-hidden pr-4 pl-4">
                                                                            <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                                                                            <div className="min-w-0 flex-1">
                                                                                <div className="flex items-center gap-2">
                                                                                    <div className="flex flex-col">
                                                                                        <span className="font-medium text-[13.5px] text-slate-800 truncate group-hover/card:text-indigo-600 transition-colors" title={q.name}>{q.name}</span>
                                                                                        {q.referenceCode && <span className="text-[10px] text-slate-400 font-mono tracking-tight">{q.referenceCode}</span>}
                                                                                    </div>
                                                                                    {q.status === 'DIGITIZING' && (
                                                                                        <Badge variant="outline" className="w-fit text-[9px] h-[16px] py-0 bg-indigo-50 text-indigo-600 border-indigo-200 animate-pulse">
                                                                                            Digitizing
                                                                                        </Badge>
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

                                                                        {/* Col 5: Sign-Off & Action */}
                                                                        <div className="border-l border-slate-100 pl-4 pr-1 flex items-center justify-between h-full">
                                                                            {q.metrics && (
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
                                                                            )}
                                                                            <div className="pl-4 flex items-center gap-1">
                                                                                {confirmRemoveId === q.id ? (
                                                                                    <div className="flex items-center gap-1 animate-in fade-in zoom-in duration-200">
                                                                                        <Button 
                                                                                            variant="ghost" 
                                                                                            size="sm"
                                                                                            onClick={() => handleRemoveQuestionnaire(eng.id, q.id, q.name)}
                                                                                            className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 px-2 text-xs"
                                                                                            disabled={isRemoving === q.id}
                                                                                        >
                                                                                            {isRemoving === q.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Yes"}
                                                                                        </Button>
                                                                                        <Button 
                                                                                            variant="ghost" 
                                                                                            size="sm"
                                                                                            onClick={() => setConfirmRemoveId(null)}
                                                                                            className="text-slate-500 hover:text-slate-700 hover:bg-slate-100 h-8 px-2 text-xs"
                                                                                            disabled={isRemoving === q.id}
                                                                                        >
                                                                                            No
                                                                                        </Button>
                                                                                    </div>
                                                                                ) : (
                                                                                    <>
                                                                                        <Link 
                                                                                            href={`/app/le/${leId}/workbench4?rel=${encodeURIComponent(orgName || "Unknown")}&q=${encodeURIComponent(q.name)}`}
                                                                                            className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
                                                                                            title="Review questionnaire"
                                                                                        >
                                                                                            <ArrowUpRight className="h-4 w-4" />
                                                                                        </Link>
                                                                                        <Button 
                                                                                            variant="ghost" 
                                                                                            size="icon" 
                                                                                            className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                                                                            onClick={() => setConfirmRemoveId(q.id)}
                                                                                            title="Remove Questionnaire"
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
                                                                        <div className="flex items-center gap-3 pr-4 pl-2">
                                                                            <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                                                                            <div className="min-w-0 flex-1">
                                                                                <div className="flex items-center justify-between w-full">
                                                                                    <span className="font-medium text-[13.5px] text-slate-800 truncate transition-colors">{q.name}</span>
                                                                                    <div className="shrink-0">
                                                                                        {confirmRemoveId === q.id ? (
                                                                                            <div className="flex items-center gap-1">
                                                                                                <Button variant="ghost" size="sm" onClick={() => handleRemoveQuestionnaire(eng.id, q.id, q.name)} className="text-red-600 h-6 px-2 text-xs" disabled={isRemoving === q.id}>Yes</Button>
                                                                                                <Button variant="ghost" size="sm" onClick={() => setConfirmRemoveId(null)} className="text-slate-500 h-6 px-2 text-xs" disabled={isRemoving === q.id}>No</Button>
                                                                                            </div>
                                                                                        ) : (
                                                                                            <div className="flex items-center gap-1">
                                                                                                <Link href={`/app/le/${leId}/workbench4?rel=${encodeURIComponent(orgName || "Unknown")}&q=${encodeURIComponent(q.name)}`} className="h-6 w-6 inline-flex items-center justify-center rounded-md text-slate-400"><ArrowUpRight className="h-3 w-3" /></Link>
                                                                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400" onClick={() => setConfirmRemoveId(q.id)}><Trash2 className="h-3 w-3" /></Button>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        {q.metrics && (
                                                                            <ProgressTracker metrics={q.metrics} variant={"v2" as any} className="w-full bg-slate-50/50" />
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="text-sm text-slate-500 flex items-center justify-center py-4 bg-slate-50/50">
                                                            No questionnaires active.
                                                        </div>
                                                    )}
                                                </AccordionContent>
                                        </AccordionItem>

                                        {/* Documents Accordion */}
                                        <AccordionItem value="documents" className="border border-slate-200 rounded-md overflow-hidden bg-white shadow-sm data-[state=open]:border-emerald-200 transition-colors">
                                            <div className="flex items-center justify-between bg-slate-50/50 pr-4 w-full border-b border-transparent">
                                                <AccordionTrigger className="hover:no-underline px-4 py-3 text-sm font-semibold text-slate-700 flex-1 hover:bg-slate-50/80">
                                                    <div className="flex items-center gap-3">
                                                        <Folder className="w-4 h-4 text-emerald-500" />
                                                        Documents
                                                        <Badge variant="secondary" className="ml-2 bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0">{docCount}</Badge>
                                                    </div>
                                                </AccordionTrigger>
                                            </div>
                                            <AccordionContent className="p-0 border-t border-slate-100">
                                                {(expandedSections[eng.id] || []).includes("documents") && (
                                                    <InlineDocumentManager engagementId={eng.id} />
                                                )}
                                            </AccordionContent>
                                        </AccordionItem>

                                        {/* Output Accordion */}
                                        <AccordionItem value="output" className="border border-slate-200 rounded-md overflow-hidden bg-white shadow-sm data-[state=open]:border-amber-200 transition-colors">
                                            <div className="flex items-center justify-between bg-slate-50/50 pr-4 w-full border-b border-transparent">
                                                <AccordionTrigger className="hover:no-underline px-4 py-3 text-sm font-semibold text-slate-700 flex-1 hover:bg-slate-50/80">
                                                    <div className="flex items-center gap-3">
                                                        <Download className="w-4 h-4 text-amber-500" />
                                                        Output
                                                        <Badge variant="outline" className={cn(
                                                            "ml-2 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0",
                                                            eng.status === 'PREPARATION' ? "bg-slate-100 text-slate-600 border-slate-200" : "bg-amber-50 text-amber-700 border-amber-200"
                                                        )}>
                                                            {eng.status === 'PREPARATION' ? 'Draft' : 'Pending'}
                                                        </Badge>
                                                    </div>
                                                </AccordionTrigger>
                                            </div>
                                            <AccordionContent className="p-0 border-t border-slate-100">
                                                {(expandedSections[eng.id] || []).includes("output") && (
                                                    <InlineOutputBuilder engagementId={eng.id} questionnaires={eng.questionnaires || []} />
                                                )}
                                            </AccordionContent>
                                        </AccordionItem>

                                        {/* Team Accordion */}
                                        <AccordionItem value="team" className="border border-slate-200 rounded-md overflow-hidden bg-white shadow-sm data-[state=open]:border-blue-200 transition-colors">
                                            <div className="flex items-center justify-between bg-slate-50/50 pr-4 w-full border-b border-transparent">
                                                <AccordionTrigger className="hover:no-underline px-4 py-3 text-sm font-semibold text-slate-700 flex-1 hover:bg-slate-50/80">
                                                    <div className="flex items-center gap-3">
                                                        <Users className="w-4 h-4 text-blue-500" />
                                                        Team
                                                        <Badge variant="secondary" className="ml-2 bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0">{teamCount}</Badge>
                                                    </div>
                                                </AccordionTrigger>
                                            </div>
                                            <AccordionContent className="p-0 border-t border-slate-100 bg-slate-50/50">
                                                {(expandedSections[eng.id] || []).includes("team") && (
                                                    <InlineTeamManager engagementId={eng.id} orgName={orgName || "Unknown"} />
                                                )}
                                            </AccordionContent>
                                        </AccordionItem>
                                        </Accordion>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        );
                    })}
                    </Accordion>
                </div>
            ) : (
                !isAdding && (
                    <div className="text-center py-20 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                        <p className="text-slate-500">No active relationships found.</p>
                        <Button variant="link" onClick={() => setIsAdding(true)} className="mt-2 text-indigo-600">
                            Add your first partner
                        </Button>
                    </div>
                )
            )}
        </div>
    );
}
