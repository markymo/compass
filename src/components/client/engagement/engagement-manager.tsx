"use client"

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, ArrowUpRight, Plus, Search, Check, Loader2, X } from "lucide-react";
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
import { MoreVertical, Trash2 } from "lucide-react";

interface EngagementManagerProps {
    leId: string;
    initialEngagements: any[];
}

export function EngagementManager({ leId, initialEngagements }: EngagementManagerProps) {
    const [engagements, setEngagements] = useState(initialEngagements);
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
            status: "PREPARATION", // New status
            org: { name: fiName },
            questionnaires: []
        };

        const previousEngagements = [...engagements as any[]];
        setEngagements([newEng, ...engagements]);
        setIsAdding(false);

        // Server Action
        const result = await createFIEngagement(leId, fiName);

        if (result.success && result.engagement) {
            const realEng = {
                ...result.engagement,
                org: { name: fiName },
                questionnaires: []
            };
            // Replace temp with real
            setEngagements(prev => prev.map(e => e.id === tempId ? realEng : e));
            toast.success(`Relationship with ${fiName} created`);
        } else {
            // Rollback
            setEngagements(previousEngagements);
            toast.error("Failed to create engagement: " + result.error);
        }
        setIsSubmitting(false);
    };

    const handleDelete = async (details: { id: string, name: string }) => {
        const previousEngagements = [...engagements];
        // Optimistic delete
        setEngagements(prev => prev.filter(e => e.id !== details.id));

        toast.promise(deleteEngagementByClient(details.id), {
            loading: "Deleting engagement...",
            success: () => "Engagement deleted",
            error: (err) => {
                setEngagements(previousEngagements); // Rollback
                return "Failed to delete";
            }
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-slate-900">Supplier Relationships</h2>
                    <p className="text-sm text-slate-500">Manage your connections with connected supply chain partners.</p>
                </div>
                {!isAdding && (
                    <Button onClick={() => setIsAdding(true)} variant="outline" size="icon" title="Add Supplier">
                        <Plus className="h-4 w-4" />
                    </Button>
                )}
            </div>

            {/* Inline Add Interface */}
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
                                                searchFIs(val).then(res => setSearchResults(res));
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
                                        {searchResults.map((framework) => (
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

            {/* List */}
            <div className="grid gap-4">
                {engagements.map((eng) => (
                    <Card key={eng.id} className="hover:border-indigo-300 transition-colors group border-slate-200 shadow-sm">
                        <CardContent className="p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-start md:items-center gap-4">
                                <div className="h-10 w-10 md:h-12 md:w-12 rounded bg-slate-100 flex items-center justify-center shrink-0">
                                    <Building2 className="h-5 w-5 md:h-6 md:w-6 text-slate-400" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-bold text-base md:text-lg text-slate-900 truncate">
                                        <Link
                                            href={eng.id.startsWith("temp-") ? "#" : `/app/le/${leId}/engagement-new/${eng.id}?tab=overview`}
                                            className="hover:underline hover:text-indigo-600 transition-colors"
                                        >
                                            {typeof eng.org === 'string' ? eng.org : eng.org?.name}
                                        </Link>
                                    </h3>
                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                        {/* Status Badge */}
                                        <Badge variant="outline" className={cn(
                                            "text-[10px] uppercase font-bold px-1.5 py-0",
                                            eng.status === 'INVITED' ? "bg-blue-50 text-blue-700 border-blue-200" :
                                                eng.status === 'CONNECTED' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                                    "bg-slate-100 text-slate-600 border-slate-200"
                                        )}>
                                            {eng.status === 'PREPARATION' ? 'DRAFT' : eng.status}
                                        </Badge>

                                        <span className="text-slate-400 text-xs hidden md:inline">•</span>
                                        <span className="text-xs text-slate-500">{eng.questionnaires?.length || 0} Questionnaires</span>
                                    </div>
                                </div>
                            </div>

                            {/* Actions / Buttons */}
                            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 no-scrollbar">
                                <Link href={eng.id.startsWith("temp-") ? "#" : `/app/le/${leId}/engagement-new/${eng.id}?tab=manage`} className="flex-1 md:flex-none">
                                    <Button
                                        variant="ghost"
                                        disabled={eng.id.startsWith("temp-")}
                                        className="w-full md:w-auto text-slate-600 hover:text-indigo-600 hover:bg-slate-50 text-xs md:text-sm whitespace-nowrap"
                                    >
                                        Manage Qs
                                    </Button>
                                </Link>
                                <Link href={eng.id.startsWith("temp-") ? "#" : `/app/le/${leId}/engagement-new/${eng.id}?tab=workbench`} className="flex-1 md:flex-none">
                                    <Button
                                        variant="outline"
                                        disabled={eng.id.startsWith("temp-")}
                                        className="w-full md:w-auto gap-2 group-hover:bg-indigo-50 group-hover:text-indigo-600 group-hover:border-indigo-200 text-xs md:text-sm whitespace-nowrap"
                                    >
                                        {eng.id.startsWith("temp-") ? (
                                            <>
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                Creating...
                                            </>
                                        ) : (
                                            <>
                                                Workbench
                                                <ArrowUpRight className="h-3 w-3" />
                                            </>
                                        )}
                                    </Button>
                                </Link>

                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem
                                            className="text-red-600 focus:text-red-600 focus:bg-red-50"
                                            onClick={() => handleDelete({ id: eng.id, name: typeof eng.org === 'string' ? eng.org : eng.org?.name })}
                                        >
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Delete Relationship
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {engagements.length === 0 && !isAdding && (
                    <div className="text-center py-20 bg-slate-50 rounded-xl border-2 border-dashed">
                        <p className="text-slate-500">No active relationships found.</p>
                        <Button variant="link" onClick={() => setIsAdding(true)} className="mt-2">
                            Add your first partner
                        </Button>
                    </div>
                )}
            </div>
        </div >
    );
}
