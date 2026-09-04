"use client"

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus, Search, Loader2, X, FileText, ChevronRight, Folder, Download, Users, MoreVertical, Trash2, ArrowUpRight, Check, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { createFIEngagement } from "@/actions/client-le";
import { toast } from "sonner";
import { deleteEngagementByClient, searchFIs } from "@/actions/client";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
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
import { QuestionStateMetricStrip, QuestionStateMetricHeader } from "@/components/shared/question-state-metric-strip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { usePreferences } from "@/components/providers/user-preferences-provider";
import { InlineDocumentManager, InlineOutputBuilder, InlineTeamManager } from "./inline-engagement-sections";
import { RelationshipOverviewSection } from "./relationship-overview-section";
import { CreateApprovalDialog } from "@/components/client/approvals/create-approval-dialog";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
const DASHBOARD_GRID_V2 = "grid-cols-[1fr_432px_240px]";

interface EngagementManagerProps {
    leId: string;
    initialEngagements: any[];
    leDueDate: Date | null;
    commonQuestionnaires?: any[];
}

export function EngagementManager({ leId, initialEngagements, leDueDate, commonQuestionnaires = [] }: EngagementManagerProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const targetEngagementId = searchParams?.get("engagementId");

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
            let initialExpanded = preferences.relationshipsExpandedEngagements || [];
            if (targetEngagementId && !initialExpanded.includes(targetEngagementId)) {
                initialExpanded = [...initialExpanded, targetEngagementId];
            }
            setExpandedEngagements(initialExpanded);
            setIsExpandedInit(true);
        } else if (targetEngagementId && isExpandedInit) {
            setExpandedEngagements(prev => prev.includes(targetEngagementId) ? prev : [...prev, targetEngagementId]);
        }
        if (!isLoading && !isSectionsInit) {
            setExpandedSections(preferences.relationshipsExpandedSections || {});
            setIsSectionsInit(true);
        }
    }, [isLoading, isExpandedInit, isSectionsInit, preferences.relationshipsExpandedEngagements, preferences.relationshipsExpandedSections, targetEngagementId]);

    useEffect(() => {
        if (targetEngagementId) {
            const timer = setTimeout(() => {
                const el = document.getElementById(`engagement-${targetEngagementId}`);
                if (el) {
                    el.scrollIntoView({ behavior: "smooth", block: "start" });
                }
            }, 200);
            return () => clearTimeout(timer);
        }
    }, [targetEngagementId]);

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
    const [approvalTarget, setApprovalTarget] = useState<{ relationshipId: string; questionnaireId: string } | null>(null);

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

    // --- Search-first Organization State ---
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<{ value: string; label: string; description: string }[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    const handleOpenAddChange = (open: boolean) => {
        setIsAdding(open);
        if (!open) {
            setSearchQuery("");
            setSearchResults([]);
            setIsSearching(false);
        }
    };

    const handleSearchValueChange = async (val: string) => {
        setSearchQuery(val);
        if (!val.trim()) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }
        setIsSearching(true);
        try {
            const res = await searchFIs(val);
            setSearchResults(res || []);
        } catch (error) {
            console.error("Search FIs failed", error);
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    const handleAdd = async (fiOrgId: string, fiName: string) => {
        const isAlreadyAdded = engagements.some((eng: any) => 
            eng.fiOrgId === fiOrgId || eng.org?.id === fiOrgId
        );
        if (isAlreadyAdded) {
            toast.info(`Relationship with ${fiName} is already active.`);
            return;
        }

        setIsSubmitting(true);
        // Optimistic Update
        const tempId = `temp-${Date.now()}`;
        const newEng = {
            id: tempId,
            fiOrgId: fiOrgId,
            status: "PREPARATION",
            org: { id: fiOrgId, name: fiName },
            questionnaires: [],
            _count: { sharedDocuments: 0, invitations: 0, memberships: 0 }
        };

        const previousEngagements = [...engagements as any[]];
        setEngagements([newEng, ...engagements]);
        setIsAdding(false);
        setSearchQuery("");
        setSearchResults([]);

        const result = await createFIEngagement(leId, fiOrgId);

        if (result.success && result.engagement) {
            const realEng = {
                ...result.engagement,
                fiOrgId: fiOrgId,
                org: result.engagement.org || { id: fiOrgId, name: fiName },
                questionnaires: [],
                _count: { sharedDocuments: 0, invitations: 0, memberships: 0 }
            };
            if (result.actionType === "RESTORED") {
                setEngagements(prev => prev.map((e: any) => e.id === tempId ? realEng : e));
                toast.success(`Relationship with ${fiName} restored`);
            } else if (result.actionType === "ALREADY_EXISTS") {
                setEngagements(prev => {
                    const filtered = prev.filter((e: any) => e.id !== tempId && e.fiOrgId !== fiOrgId && e.org?.id !== fiOrgId);
                    return [realEng, ...filtered];
                });
                toast.info(result.message || `Relationship with ${fiName} is already active.`);
            } else {
                setEngagements(prev => prev.map((e: any) => e.id === tempId ? realEng : e));
                toast.success(`Relationship with ${fiName} created`);
            }
        } else {
            setEngagements(previousEngagements);
            toast.error("Failed to add relationship: " + (result.error || "Unknown error"));
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-semibold text-foreground">Supplier Relationships</h2>
                </div>
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleOpenAddChange(true)} 
                    className="h-7 text-xs px-2 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-700 dark:hover:text-indigo-300 w-fit"
                    title="Add Supplier Relationship"
                >
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                </Button>
            </div>

            <Dialog open={isAdding} onOpenChange={handleOpenAddChange}>
                <DialogContent className="sm:max-w-lg p-0 overflow-hidden bg-card text-card-foreground border-border">
                    <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
                        <DialogTitle className="text-lg font-bold text-foreground">Add Supplier Relationship</DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            Search for a financial institution to add a relationship to this legal entity.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="p-0">
                        <Command className="rounded-none border-0 bg-card text-card-foreground" shouldFilter={false}>
                            <div className="flex items-center border-b border-border px-4 overflow-hidden">
                                <Search className="h-4 w-4 shrink-0 text-muted-foreground mr-2" />
                                <CommandInput
                                    placeholder="Search financial institutions..."
                                    autoFocus
                                    value={searchQuery}
                                    onValueChange={handleSearchValueChange}
                                    className="border-0 focus:ring-0 shadow-none px-0 h-12 text-base text-foreground bg-transparent"
                                />
                                {isSearching && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground ml-2" />}
                            </div>
                            <CommandList className="max-h-[260px] min-h-[120px] p-2">
                                {!searchQuery.trim() ? (
                                    <div className="py-10 px-4 text-center text-xs text-muted-foreground">
                                        Type an institution name to search matching organizations.
                                    </div>
                                ) : isSearching ? (
                                    <div className="py-10 px-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                                        Searching institutions...
                                    </div>
                                ) : searchResults.length === 0 ? (
                                    <CommandEmpty className="py-8 px-4 text-center">
                                        <p className="text-sm text-muted-foreground">
                                            No financial institutions found matching &quot;{searchQuery}&quot;.
                                        </p>
                                    </CommandEmpty>
                                ) : (
                                    searchResults.map((framework: any) => {
                                        const isAlreadyAdded = engagements.some((eng: any) => 
                                            eng.fiOrgId === framework.value || eng.org?.id === framework.value
                                        );

                                        return (
                                            <CommandItem
                                                key={framework.value}
                                                value={framework.value}
                                                disabled={isAlreadyAdded}
                                                onSelect={() => {
                                                    if (!isAlreadyAdded) {
                                                        handleAdd(framework.value, framework.label);
                                                    }
                                                }}
                                                className={cn(
                                                    "py-3 px-3 rounded-md flex items-center justify-between transition-colors",
                                                    isAlreadyAdded
                                                        ? "opacity-60 cursor-not-allowed bg-muted/80"
                                                        : "cursor-pointer hover:bg-muted"
                                                )}
                                            >
                                                <div className="flex items-center min-w-0 flex-1 mr-3">
                                                    <Building2 className="mr-3 h-4 w-4 text-muted-foreground shrink-0" />
                                                    <div className="flex flex-col flex-1 min-w-0">
                                                        <span className="font-medium text-foreground truncate">{framework.label}</span>
                                                        {framework.description && (
                                                            <span className="text-xs text-muted-foreground truncate">{framework.description}</span>
                                                        )}
                                                    </div>
                                                </div>
                                                {isAlreadyAdded ? (
                                                    <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium shrink-0 bg-muted px-2 py-0.5 rounded border border-border">
                                                        <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                                        <span>Already added</span>
                                                    </div>
                                                ) : (
                                                    <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
                                                )}
                                            </CommandItem>
                                        );
                                    })
                                )}
                            </CommandList>
                        </Command>
                    </div>
                </DialogContent>
            </Dialog>

            {engagements.length > 0 ? (
                <Card className="overflow-hidden border border-border bg-card shadow-none rounded-xl">
                    {/* --- Grouped 2-Tier Header Row --- */}
                    <div className={cn("hidden md:grid items-center px-4 py-2.5 bg-muted/40 border-b border-border text-foreground", DASHBOARD_GRID_V2)}>
                        {/* 1. Entity */}
                        <div className="flex items-center gap-2 pl-7">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Supplier Relationships</span>
                        </div>

                        {/* 2. Grouped Canonical Metrics (Questions & Answers) */}
                        <QuestionStateMetricHeader />

                        {/* 3. Status & Actions */}
                        <div className="flex flex-col gap-1 text-right justify-end pr-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-transparent select-none">Status</span>
                            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Status / Actions</span>
                        </div>
                    </div>

                    <Accordion 
                        type="multiple" 
                        value={expandedEngagements}
                        onValueChange={handleAccordionChange}
                        className="divide-y divide-border"
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
                            <AccordionItem key={eng.id} id={`engagement-${eng.id}`} value={eng.id} className="border-none bg-card transition-colors">
                                <div className="flex items-center justify-between hover:bg-muted/30 transition-colors">
                                    <AccordionPrimitive.Header className="flex flex-1 w-full">
                                        <div className="flex items-center w-full px-4 py-2.5">
                                            {/* Desktop View */}
                                            <div className="hidden md:flex items-center w-full">
                                                <AccordionPrimitive.Trigger className="flex-1 grid grid-cols-[1fr_432px] items-center text-left hover:no-underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/20 [&[data-state=open]_.chevron-icon]:rotate-90">
                                                    {/* Col 1: Entity */}
                                                    <div className="flex items-center gap-3 overflow-hidden pr-4 min-w-0">
                                                        <ChevronRight className="chevron-icon h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200" />
                                                        <div className="h-7 w-7 rounded bg-muted text-muted-foreground flex items-center justify-center shrink-0 border border-border/60">
                                                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <h3 className="font-semibold text-sm text-foreground truncate">
                                                                    {orgName}
                                                                </h3>
                                                                <Badge variant="outline" className={cn(
                                                                    "text-[9px] uppercase font-semibold px-1.5 py-0 h-4 border-border",
                                                                    eng.status === 'INVITED' ? "bg-muted text-muted-foreground" :
                                                                        "bg-muted/40 text-muted-foreground"
                                                                )}>
                                                                    {eng.status === 'PREPARATION' ? 'DRAFT' : eng.status}
                                                                </Badge>
                                                            </div>
                                                            <span className="text-[11px] text-muted-foreground">Supplier Relationship</span>
                                                        </div>
                                                    </div>

                                                    {/* Col 2: Canonical Metrics (Home 54 / 3 aggregate format) */}
                                                    {eng.v2Metrics ? (
                                                        <QuestionStateMetricStrip
                                                            metrics={eng.v2Metrics}
                                                            variant="table-row"
                                                            showQuestionnairesCount={true}
                                                            linkContext={{
                                                                leId,
                                                                relationshipId: eng.id,
                                                                relationshipName: orgName,
                                                            }}
                                                        />
                                                    ) : (
                                                        <div className="text-right font-bold font-mono text-sm text-foreground pr-3">
                                                            {eng.metrics?.total || 0}
                                                        </div>
                                                    )}
                                                </AccordionPrimitive.Trigger>

                                                {/* Col 3: Status & Actions (outside trigger, demoted) */}
                                                <div className="w-[240px] shrink-0 flex items-center justify-end gap-3 text-right">
                                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                        <span className={cn("font-mono font-medium", eng.metrics?.approved > 0 ? "text-slate-700 dark:text-zinc-200" : "text-muted-foreground/60")}>
                                                            {eng.metrics?.approved || 0}
                                                        </span> Approved · <span className={cn("font-mono font-medium", eng.metrics?.released > 0 ? "text-slate-700 dark:text-zinc-200" : "text-muted-foreground/60")}>
                                                            {eng.metrics?.released || 0}
                                                        </span> Released
                                                    </span>
                                                    <div className="shrink-0 flex items-center">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                                                                    <MoreVertical className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem
                                                                    className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                                                                    onClick={() => handleDelete({ id: eng.id, name: orgName })}
                                                                >
                                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                                    Delete Relationship
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Mobile View */}
                                            <div className="md:hidden flex flex-col text-left w-full gap-3 py-1">
                                                <AccordionPrimitive.Trigger className="flex flex-col text-left w-full gap-3 focus-visible:outline-none">
                                                    <div className="flex items-center justify-between min-w-0 pr-2">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-8 w-8 rounded bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                                                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                                            </div>
                                                            <h3 className="font-semibold text-sm text-foreground truncate">
                                                                {orgName}
                                                            </h3>
                                                        </div>
                                                        <Badge variant="outline" className="text-[9px] uppercase font-semibold px-1.5 py-0 h-4 border-border text-muted-foreground">
                                                            {eng.status === 'PREPARATION' ? 'DRAFT' : eng.status}
                                                        </Badge>
                                                    </div>
                                                    {eng.v2Metrics ? (
                                                        <div className="w-full pr-2">
                                                            <QuestionStateMetricStrip
                                                                metrics={eng.v2Metrics}
                                                                variant="card-row"
                                                                showQuestionnairesCount={true}
                                                                linkContext={{
                                                                    leId,
                                                                    relationshipId: eng.id,
                                                                    relationshipName: orgName,
                                                                }}
                                                                className="w-full bg-muted/40 p-2 rounded"
                                                            />
                                                        </div>
                                                    ) : eng.metrics ? (
                                                        <div className="w-full pr-2">
                                                            <ProgressTracker metrics={eng.metrics} variant={"v2" as any} className="w-full bg-muted/50" />
                                                        </div>
                                                    ) : null}
                                                </AccordionPrimitive.Trigger>
                                                <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                                                    <span>{eng.metrics?.approved || 0} Approved · {eng.metrics?.released || 0} Released</span>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
                                                                <MoreVertical className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem
                                                                className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                                                                onClick={() => handleDelete({ id: eng.id, name: orgName })}
                                                            >
                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                                Delete Relationship
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </div>
                                        </div>
                                    </AccordionPrimitive.Header>
                                </div>

                                <AccordionContent className="border-t border-border bg-card text-card-foreground pb-2 pt-0 px-0">
                                    {(() => {
                                        const engExpandedSections = expandedSections[eng.id] !== undefined ? expandedSections[eng.id] : ["overview"];
                                        
                                        return (
                                            <Accordion 
                                                type="multiple" 
                                                value={engExpandedSections} 
                                                onValueChange={(val) => handleSectionsAccordionChange(eng.id, val)} 
                                                className="w-full divide-y divide-border"
                                            >
                                                {/* Section 1: Overview */}
                                                <AccordionItem value="overview" className="border-0">
                                                    <AccordionPrimitive.Header className="flex items-center justify-between px-4 py-2.5 bg-muted/50 hover:bg-muted transition-colors group cursor-pointer border-b border-transparent">
                                                        <AccordionPrimitive.Trigger className="flex flex-1 items-center gap-3 py-1 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/20 rounded-sm [&[data-state=open]>svg]:rotate-90">
                                                            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200" />
                                                            <span className="font-semibold text-sm text-foreground">Overview</span>
                                                        </AccordionPrimitive.Trigger>
                                                    </AccordionPrimitive.Header>
                                                    <AccordionContent className="pl-7 sm:pl-9 pr-4 py-3 border-t border-border bg-card text-card-foreground">
                                                         <RelationshipOverviewSection 
                                                             orgName={orgName || "Supplier"}
                                                             createdAt={eng.createdAt}
                                                             hasSupplierAccess={(eng._count?.memberships || 0) > 0 || eng.status === 'ACTIVE'}
                                                             unansweredCount={eng.v2Metrics ? eng.v2Metrics.unanswered : eng.metrics ? Math.max(0, (eng.metrics.total || 0) - (eng.metrics.answered || 0)) : 24}
                                                             clientLEId={leId}
                                                         />
                                                    </AccordionContent>
                                                </AccordionItem>

                                                {/* Section 2: Questionnaires */}
                                                <AccordionItem value="questionnaires" className="border-0">
                                                    <AccordionPrimitive.Header className="flex items-center justify-between px-4 py-2.5 bg-muted/50 hover:bg-muted transition-colors group cursor-pointer border-b border-transparent">
                                                        <AccordionPrimitive.Trigger className="flex flex-1 items-center gap-3 py-1 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/20 rounded-sm [&[data-state=open]>svg]:rotate-90">
                                                            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200" />
                                                            <span className="font-semibold text-sm text-foreground">Questionnaires</span>
                                                            <Badge variant="secondary" className="bg-muted text-muted-foreground text-[10px] font-bold uppercase tracking-wider px-1.5 py-0">{qCount}</Badge>
                                                        </AccordionPrimitive.Trigger>
                                                        <div onClick={(e) => e.stopPropagation()} className="shrink-0 z-10 pr-2">
                                                            <Popover 
                                                                open={popoversOpen[eng.id] || false} 
                                                                onOpenChange={(val) => { 
                                                                    setPopoversOpen(prev => ({ ...prev, [eng.id]: val })); 
                                                                    if (val) fetchAvailableForEngagement(eng.id, eng.fiOrgId); 
                                                                }}
                                                            >
                                                                <PopoverTrigger asChild>
                                                                    <Button variant="outline" size="sm" className="h-7 text-xs px-2 text-foreground border-border hover:bg-muted">
                                                                        <Plus className="h-3 w-3 mr-1" />
                                                                        Add
                                                                    </Button>
                                                                </PopoverTrigger>
                                                                <PopoverContent className="w-[300px] p-0 bg-card text-card-foreground border-border" align="end" onClick={(e) => e.stopPropagation()}>
                                                                    <Command className="bg-card text-card-foreground">
                                                                        <CommandInput placeholder="Search available questionnaires..." className="text-foreground bg-transparent" />
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
                                                                                        onPointerDown={(e) => {
                                                                                            e.preventDefault();
                                                                                            handleAddQuestionnaire(eng.id, snapshot.id, snapshot.name);
                                                                                        }}
                                                                                        className="flex flex-col items-start py-3 cursor-pointer hover:bg-muted"
                                                                                        disabled={isAddingQ === snapshot.id}
                                                                                    >
                                                                                        <div className="flex items-center w-full">
                                                                                            <FileText className="mr-2 h-4 w-4 text-indigo-500 shrink-0" />
                                                                                            <span className="font-medium truncate flex-1 text-foreground">{snapshot.name}</span>
                                                                                            {isAddingQ === snapshot.id && <Loader2 className="ml-2 h-4 w-4 animate-spin text-indigo-500" />}
                                                                                        </div>
                                                                                        {snapshot.referenceCode && (
                                                                                            <span className="text-[10px] text-muted-foreground mt-1 ml-6">{snapshot.referenceCode}</span>
                                                                                        )}
                                                                                    </CommandItem>
                                                                                ))}
                                                                            </CommandGroup>
                                                                        </CommandList>
                                                                    </Command>
                                                                </PopoverContent>
                                                            </Popover>
                                                        </div>
                                                    </AccordionPrimitive.Header>
                                                    <AccordionContent className="px-4 py-2 border-t border-border bg-card text-card-foreground">
                                                        {qCount > 0 ? (
                                                            <div className="divide-y divide-border">
                                                                {questionnaires.map((q: any) => (
                                                                    <div key={q.id} className="py-2.5 hover:bg-muted/40 transition-colors group/card">
                                                                        <div className={cn("hidden md:grid items-center", DASHBOARD_GRID_V2)}>
                                                                            {/* Col 1: Questionnaire Name + Ref (indented pl-7) */}
                                                                            <div className="flex items-center gap-3 overflow-hidden min-w-0 pl-7 pr-4">
                                                                                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                                                                                <div className="min-w-0 flex-1 flex flex-col">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className="font-medium text-sm text-foreground truncate group-hover/card:text-indigo-600 dark:group-hover/card:text-indigo-400 transition-colors" title={q.name}>
                                                                                            {q.name}
                                                                                        </span>
                                                                                        {q.status === 'DIGITIZING' && (
                                                                                            <Badge variant="outline" className="w-fit text-[9px] h-[16px] py-0 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 animate-pulse">
                                                                                                Digitizing
                                                                                            </Badge>
                                                                                        )}
                                                                                    </div>
                                                                                    {q.referenceCode && (
                                                                                        <span className="text-[10px] text-muted-foreground font-mono tracking-tight">
                                                                                            {q.referenceCode}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </div>

                                                                            {/* Col 2: Canonical Metrics (Home 5-part block, single question count, no / 1) */}
                                                                            {q.v2Metrics ? (
                                                                                <QuestionStateMetricStrip
                                                                                    metrics={q.v2Metrics}
                                                                                    variant="table-row"
                                                                                    showQuestionnairesCount={false}
                                                                                    linkContext={{
                                                                                        leId,
                                                                                        relationshipId: eng.id,
                                                                                        questionnaireId: q.id,
                                                                                        relationshipName: orgName,
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
                                                                                <div className="shrink-0 flex items-center gap-1">
                                                                                    {confirmRemoveId === q.id ? (
                                                                                        <div className="flex items-center gap-1 animate-in fade-in zoom-in duration-200">
                                                                                            <Button 
                                                                                                variant="ghost" 
                                                                                                size="sm" 
                                                                                                onClick={() => handleRemoveQuestionnaire(eng.id, q.id, q.name)} 
                                                                                                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 h-7 px-2 text-xs" 
                                                                                                disabled={isRemoving === q.id}
                                                                                            >
                                                                                                {isRemoving === q.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Yes"}
                                                                                            </Button>
                                                                                            <Button 
                                                                                                variant="ghost" 
                                                                                                size="sm" 
                                                                                                onClick={() => setConfirmRemoveId(null)} 
                                                                                                className="text-muted-foreground hover:text-foreground hover:bg-muted h-7 px-2 text-xs" 
                                                                                                disabled={isRemoving === q.id}
                                                                                            >
                                                                                                No
                                                                                            </Button>
                                                                                        </div>
                                                                                    ) : (
                                                                                        <>
                                                                                            <Button
                                                                                                variant="ghost"
                                                                                                size="sm"
                                                                                                onClick={() => setApprovalTarget({ relationshipId: eng.id, questionnaireId: q.id })}
                                                                                                className="h-7 text-xs text-muted-foreground hover:text-foreground px-2 flex items-center gap-1 font-medium shrink-0"
                                                                                                title="Approve Questionnaire"
                                                                                            >
                                                                                                <ShieldCheck className="h-3.5 w-3.5" />
                                                                                                Approve
                                                                                            </Button>
                                                                                            <Link 
                                                                                                href={`/app/le/${leId}/workbench4?rel=${encodeURIComponent(orgName || "Unknown")}&q=${encodeURIComponent(q.name)}`}
                                                                                                className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
                                                                                                title="Review questionnaire"
                                                                                            >
                                                                                                <ArrowUpRight className="h-4 w-4" />
                                                                                            </Link>
                                                                                            <Button 
                                                                                                variant="ghost" 
                                                                                                size="icon" 
                                                                                                className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
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
                                                                        <div className="md:hidden flex flex-col gap-3 py-1">
                                                                            <div className="flex items-center justify-between gap-3">
                                                                                <div className="flex items-center gap-3 min-w-0">
                                                                                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                                                                                    <div className="flex flex-col gap-0.5 min-w-0">
                                                                                        <span className="font-medium text-sm text-foreground truncate">{q.name}</span>
                                                                                        {q.referenceCode && (
                                                                                            <span className="text-[10px] text-muted-foreground font-mono">{q.referenceCode}</span>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                                <div className="shrink-0 flex items-center gap-1">
                                                                                    {confirmRemoveId === q.id ? (
                                                                                        <div className="flex items-center gap-1">
                                                                                            <Button variant="ghost" size="sm" onClick={() => handleRemoveQuestionnaire(eng.id, q.id, q.name)} className="text-red-600 h-6 px-2 text-xs" disabled={isRemoving === q.id}>Yes</Button>
                                                                                            <Button variant="ghost" size="sm" onClick={() => setConfirmRemoveId(null)} className="text-muted-foreground h-6 px-2 text-xs" disabled={isRemoving === q.id}>No</Button>
                                                                                        </div>
                                                                                    ) : (
                                                                                        <>
                                                                                            <Button
                                                                                                variant="ghost"
                                                                                                size="sm"
                                                                                                onClick={() => setApprovalTarget({ relationshipId: eng.id, questionnaireId: q.id })}
                                                                                                className="h-7 text-xs text-muted-foreground hover:text-foreground px-2 flex items-center gap-1 font-medium shrink-0"
                                                                                                title="Approve Questionnaire"
                                                                                            >
                                                                                                <ShieldCheck className="h-3.5 w-3.5" />
                                                                                                Approve
                                                                                            </Button>
                                                                                            <Link href={`/app/le/${leId}/workbench4?rel=${encodeURIComponent(orgName || "Unknown")}&q=${encodeURIComponent(q.name)}`} className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0">
                                                                                                <ArrowUpRight className="h-4 w-4" />
                                                                                            </Link>
                                                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0" onClick={() => setConfirmRemoveId(q.id)}>
                                                                                                <Trash2 className="h-4 w-4" />
                                                                                            </Button>
                                                                                        </>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                            {q.v2Metrics ? (
                                                                                <QuestionStateMetricStrip
                                                                                    metrics={q.v2Metrics}
                                                                                    variant="card-row"
                                                                                    linkContext={{
                                                                                        leId,
                                                                                        relationshipId: eng.id,
                                                                                        questionnaireId: q.id,
                                                                                        relationshipName: orgName,
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
                                                        ) : (
                                                            <div className="text-sm text-muted-foreground py-3">
                                                                No questionnaires assigned to this relationship yet.
                                                            </div>
                                                        )}
                                                    </AccordionContent>
                                                </AccordionItem>

                                                {/* Section 3: Documents */}
                                                <AccordionItem value="documents" className="border-0">
                                                    <AccordionPrimitive.Header className="flex items-center justify-between px-4 py-2.5 bg-muted/50 hover:bg-muted transition-colors group cursor-pointer border-b border-transparent">
                                                        <AccordionPrimitive.Trigger className="flex flex-1 items-center gap-3 py-1 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/20 rounded-sm [&[data-state=open]>svg]:rotate-90">
                                                            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200" />
                                                            <span className="font-semibold text-sm text-foreground">Documents</span>
                                                            <Badge variant="secondary" className="bg-muted text-muted-foreground text-[10px] font-bold uppercase tracking-wider px-1.5 py-0">{docCount}</Badge>
                                                        </AccordionPrimitive.Trigger>
                                                    </AccordionPrimitive.Header>
                                                    <AccordionContent className="pl-7 sm:pl-9 pr-4 py-3 border-t border-border bg-card text-card-foreground">
                                                        {engExpandedSections.includes("documents") && (
                                                            <InlineDocumentManager engagementId={eng.id} />
                                                        )}
                                                    </AccordionContent>
                                                </AccordionItem>

                                                {/* Section 4: Output */}
                                                <AccordionItem value="output" className="border-0">
                                                    <AccordionPrimitive.Header className="flex items-center justify-between px-4 py-2.5 bg-muted/50 hover:bg-muted transition-colors group cursor-pointer border-b border-transparent">
                                                        <AccordionPrimitive.Trigger className="flex flex-1 items-center gap-3 py-1 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/20 rounded-sm [&[data-state=open]>svg]:rotate-90">
                                                            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200" />
                                                            <span className="font-semibold text-sm text-foreground">Output</span>
                                                            <Badge variant="outline" className={cn(
                                                                "text-[10px] font-bold uppercase tracking-wider px-1.5 py-0",
                                                                eng.status === 'PREPARATION' ? "bg-muted text-muted-foreground border-border" : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                                                            )}>
                                                                {eng.status === 'PREPARATION' ? 'Draft' : 'Pending'}
                                                            </Badge>
                                                        </AccordionPrimitive.Trigger>
                                                    </AccordionPrimitive.Header>
                                                    <AccordionContent className="pl-7 sm:pl-9 pr-4 py-3 border-t border-border bg-card text-card-foreground">
                                                        {engExpandedSections.includes("output") && (
                                                            <InlineOutputBuilder engagementId={eng.id} questionnaires={eng.questionnaires || []} commonQuestionnaires={commonQuestionnaires} />
                                                        )}
                                                    </AccordionContent>
                                                </AccordionItem>

                                                {/* Section 5: Team */}
                                                <AccordionItem value="team" className="border-0">
                                                    <AccordionPrimitive.Header className="flex items-center justify-between px-4 py-2.5 bg-muted/50 hover:bg-muted transition-colors group cursor-pointer border-b border-transparent">
                                                        <AccordionPrimitive.Trigger className="flex flex-1 items-center gap-3 py-1 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/20 rounded-sm [&[data-state=open]>svg]:rotate-90">
                                                            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200" />
                                                            <span className="font-semibold text-sm text-foreground">Team</span>
                                                            <Badge variant="secondary" className="bg-muted text-muted-foreground text-[10px] font-bold uppercase tracking-wider px-1.5 py-0">{teamCount}</Badge>
                                                        </AccordionPrimitive.Trigger>
                                                    </AccordionPrimitive.Header>
                                                    <AccordionContent className="pl-7 sm:pl-9 pr-4 py-3 border-t border-border bg-card text-card-foreground">
                                                        {engExpandedSections.includes("team") && (
                                                            <InlineTeamManager engagementId={eng.id} orgName={orgName || "Unknown"} />
                                                        )}
                                                    </AccordionContent>
                                                </AccordionItem>
                                            </Accordion>
                                        );
                                    })()}
                                </AccordionContent>
                            </AccordionItem>
                        );
                    })}
                    </Accordion>
                </Card>
            ) : (
                !isAdding && (
                    <div className="text-center py-20 bg-card text-card-foreground rounded-md border-2 border-dashed border-border">
                        <p className="text-muted-foreground">No active relationships found.</p>
                        <Button 
                            onClick={() => handleOpenAddChange(true)} 
                            className="mt-3 bg-indigo-600 hover:bg-indigo-700 text-white" 
                            size="sm"
                        >
                            <Plus className="h-4 w-4 mr-1.5" />
                            Add your first Relationship
                        </Button>
                    </div>
                )
            )}

            <CreateApprovalDialog
                open={Boolean(approvalTarget)}
                onOpenChange={(open) => !open && setApprovalTarget(null)}
                clientLEId={leId}
                initialRelationships={engagements}
                initialRelationshipId={approvalTarget?.relationshipId}
                initialQuestionnaireId={approvalTarget?.questionnaireId}
            />
        </div>
    );
}
