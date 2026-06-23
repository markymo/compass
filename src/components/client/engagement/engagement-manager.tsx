"use client"

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus, Search, Loader2, X, FileText, ChevronRight, Folder, Download, Users, MoreVertical, Trash2, ArrowUpRight } from "lucide-react";
import Link from "next/link";
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
import { ProgressTracker } from "@/components/shared/progress-tracker";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface EngagementManagerProps {
    leId: string;
    initialEngagements: any[];
    leDueDate: Date | null;
}

export function EngagementManager({ leId, initialEngagements, leDueDate }: EngagementManagerProps) {
    const [engagements, setEngagements] = useState(initialEngagements);

    useEffect(() => {
        setEngagements(initialEngagements);
    }, [initialEngagements]);

    const [isAdding, setIsAdding] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

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
                <Accordion 
                    type="multiple" 
                    defaultValue={engagements.map((e: any) => e.id)} 
                    className="space-y-4"
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
                                <div className="flex items-center justify-between pr-4 hover:bg-slate-50 transition-colors">
                                    <AccordionTrigger className="hover:no-underline px-4 py-4 flex-1">
                                        <div className="flex flex-col md:flex-row md:items-center gap-4 text-left w-full">
                                            <div className="flex items-center gap-4 min-w-0 flex-1">
                                                <div className="h-10 w-10 rounded bg-indigo-50 flex items-center justify-center shrink-0">
                                                    <Building2 className="h-5 w-5 text-indigo-500" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <h3 className="font-bold text-lg text-slate-900 truncate">
                                                        {orgName}
                                                    </h3>
                                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                                        <Badge variant="outline" className={cn(
                                                            "text-[10px] uppercase font-bold px-1.5 py-0",
                                                            eng.status === 'INVITED' ? "bg-blue-50 text-blue-700 border-blue-200" :
                                                                "bg-slate-100 text-slate-600 border-slate-200"
                                                        )}>
                                                            {eng.status === 'PREPARATION' ? 'DRAFT' : eng.status}
                                                        </Badge>
                                                        {qCount > 0 && (
                                                            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                                                {qCount} Questionnaire{qCount !== 1 ? 's' : ''}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            {eng.metrics && (
                                                <div className="w-full md:w-48 md:mr-4 shrink-0 mt-3 md:mt-0">
                                                    <ProgressTracker metrics={eng.metrics} variant={"v2" as any} className="w-full bg-white border border-slate-100 rounded-md p-1.5" />
                                                </div>
                                            )}
                                        </div>
                                    </AccordionTrigger>
                                    
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-slate-400">
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

                                <AccordionContent className="border-t border-slate-100 bg-slate-50/30 pb-4 pt-4 px-4 md:px-6">
                                    <Accordion type="multiple" defaultValue={["questionnaires", "documents", "output", "team"]} className="w-full space-y-3">
                                        
                                        {/* Questionnaires Section */}
                                        <AccordionItem value="questionnaires" className="border border-slate-200 rounded-md overflow-hidden bg-white shadow-sm">
                                            <AccordionTrigger className="hover:no-underline px-4 py-3 text-sm font-semibold text-slate-700 bg-slate-50/50">
                                                <div className="flex items-center gap-2">
                                                    <FileText className="w-4 h-4 text-indigo-500" />
                                                    Questionnaires
                                                    <Badge variant="secondary" className="ml-2 bg-indigo-50 text-indigo-700 text-xs px-1.5 py-0">{qCount}</Badge>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="p-4 border-t border-slate-100">
                                                {qCount > 0 ? (
                                                    <div className="space-y-3">
                                                        {questionnaires.map((q: any) => (
                                                            <div key={q.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-md border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                                                                <div className="flex-1">
                                                                    <div className="font-medium text-sm text-slate-900 flex items-center gap-2">
                                                                        {q.name}
                                                                        {q.status === 'DIGITIZING' && (
                                                                            <Badge variant="outline" className="text-[10px] h-4 py-0 bg-indigo-50 text-indigo-600 border-indigo-200 animate-pulse">
                                                                                Digitizing
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-xs text-slate-500 mt-1">{q.status || 'In Progress'}</div>
                                                                </div>
                                                                <div className="flex items-center gap-2 sm:shrink-0">
                                                                    <Link href={`/app/le/${leId}/engagement-new/${eng.id}?tab=manage`}>
                                                                        <Button variant="outline" size="sm" className="h-8 text-xs bg-white">
                                                                            Review questionnaire
                                                                            <ArrowUpRight className="ml-1 w-3 h-3" />
                                                                        </Button>
                                                                    </Link>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="text-sm text-slate-500 flex flex-col items-center justify-center py-4 bg-slate-50/50 rounded-md border border-slate-100 border-dashed">
                                                        No questionnaires active.
                                                    </div>
                                                )}
                                            </AccordionContent>
                                        </AccordionItem>

                                        {/* Documents Section */}
                                        <AccordionItem value="documents" className="border border-slate-200 rounded-md overflow-hidden bg-white shadow-sm">
                                            <AccordionTrigger className="hover:no-underline px-4 py-3 text-sm font-semibold text-slate-700 bg-slate-50/50">
                                                <div className="flex items-center gap-2">
                                                    <Folder className="w-4 h-4 text-emerald-500" />
                                                    Documents
                                                    {docCount > 0 && <Badge variant="secondary" className="ml-2 bg-emerald-50 text-emerald-700 text-xs px-1.5 py-0">{docCount}</Badge>}
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="p-4 border-t border-slate-100">
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50 rounded-md p-3 border border-slate-100">
                                                    <div className="text-sm text-slate-600">
                                                        {docCount > 0 ? (
                                                            <span className="font-medium text-slate-900">{docCount} document{docCount !== 1 ? 's' : ''}</span>
                                                        ) : (
                                                            "No documents shared yet."
                                                        )}
                                                        {docCount > 0 && " currently uploaded for this relationship."}
                                                    </div>
                                                    <Link href={`/app/le/${leId}/engagement-new/${eng.id}?tab=documents`} className="sm:shrink-0">
                                                        <Button variant="secondary" size="sm" className="h-8 text-xs w-full sm:w-auto bg-white border border-slate-200 shadow-sm">
                                                            Manage documents
                                                        </Button>
                                                    </Link>
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>

                                        {/* Output Section */}
                                        <AccordionItem value="output" className="border border-slate-200 rounded-md overflow-hidden bg-white shadow-sm">
                                            <AccordionTrigger className="hover:no-underline px-4 py-3 text-sm font-semibold text-slate-700 bg-slate-50/50">
                                                <div className="flex items-center gap-2">
                                                    <Download className="w-4 h-4 text-amber-500" />
                                                    Output
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="p-4 border-t border-slate-100">
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50 rounded-md p-3 border border-slate-100">
                                                    <div className="text-sm text-slate-600">
                                                        Output pack configuration and exports are managed here.
                                                    </div>
                                                    <Link href={`/app/le/${leId}/engagement-new/${eng.id}?tab=output`} className="sm:shrink-0">
                                                        <Button variant="secondary" size="sm" className="h-8 text-xs w-full sm:w-auto bg-white border border-slate-200 shadow-sm">
                                                            Prepare output pack
                                                        </Button>
                                                    </Link>
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>

                                        {/* Team Section */}
                                        <AccordionItem value="team" className="border border-slate-200 rounded-md overflow-hidden bg-white shadow-sm">
                                            <AccordionTrigger className="hover:no-underline px-4 py-3 text-sm font-semibold text-slate-700 bg-slate-50/50">
                                                <div className="flex items-center gap-2">
                                                    <Users className="w-4 h-4 text-blue-500" />
                                                    Team
                                                    {teamCount > 0 && <Badge variant="secondary" className="ml-2 bg-blue-50 text-blue-700 text-xs px-1.5 py-0">{teamCount}</Badge>}
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="p-4 border-t border-slate-100">
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50 rounded-md p-3 border border-slate-100">
                                                    <div className="text-sm text-slate-600">
                                                        {teamCount > 0 ? (
                                                            <span className="font-medium text-slate-900">{teamCount} member{teamCount !== 1 ? 's' : ''}</span>
                                                        ) : (
                                                            "No team members invited."
                                                        )}
                                                        {teamCount > 0 && " with access to this relationship."}
                                                    </div>
                                                    <Link href={`/app/le/${leId}/engagement-new/${eng.id}?tab=team`} className="sm:shrink-0">
                                                        <Button variant="secondary" size="sm" className="h-8 text-xs w-full sm:w-auto bg-white border border-slate-200 shadow-sm">
                                                            Manage team
                                                        </Button>
                                                    </Link>
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>

                                    </Accordion>
                                </AccordionContent>
                            </AccordionItem>
                        );
                    })}
                </Accordion>
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
