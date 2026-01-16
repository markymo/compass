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

interface EngagementManagerProps {
    leId: string;
    initialEngagements: any[];
}

export function EngagementManager({ leId, initialEngagements }: EngagementManagerProps) {
    const [engagements, setEngagements] = useState(initialEngagements);
    const [isAdding, setIsAdding] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Mock Directory Data - In reality this would come from an API
    const directory = [
        { value: "barclays", label: "Barclays" },
        { value: "jpmorgan", label: "J.P. Morgan" },
        { value: "goldman", label: "Goldman Sachs" },
        { value: "citie", label: "Citi" },
        { value: "hsbc", label: "HSBC" },
        { value: "deutsche", label: "Deutsche Bank" },
        { value: "ubs", label: "UBS" },
    ];

    const handleAdd = async (fiName: string) => {
        setIsSubmitting(true);

        // Optimistic Update
        const tempId = `temp-${Date.now()}`;
        const newEng = {
            id: tempId,
            status: "PENDING",
            org: { name: fiName },
            questionnaires: []
        };

        const previousEngagements = [...engagements];
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

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-slate-900">Banking Relationships</h2>
                    <p className="text-sm text-slate-500">Manage your connections with financial institutions.</p>
                </div>
                {!isAdding && (
                    <Button onClick={() => setIsAdding(true)} variant="outline" size="icon" title="Add Financial Institution">
                        <Plus className="h-4 w-4" />
                    </Button>
                )}
            </div>

            {/* Inline Add Interface */}
            {isAdding && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <Card className="border-2 border-indigo-100 shadow-md bg-white overflow-hidden">
                        {/* We use a custom wrapper to override the 'orange' accent color locally */}
                        <div className="[&_[cmdk-item][data-selected='true']]:bg-slate-100 [&_[cmdk-item][data-selected='true']]:text-slate-900">
                            <Command className="rounded-none border-0">
                                <div className="flex items-center border-b border-slate-100 px-3 overflow-hidden">
                                    <Search className="h-4 w-4 shrink-0 opacity-50 text-slate-500 mr-2" />
                                    <CommandInput
                                        placeholder="Search for a bank to add..."
                                        autoFocus
                                        className="border-0 focus:ring-0 shadow-none px-0 h-12 text-base"
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
                                        {directory.map((framework) => (
                                            <CommandItem
                                                key={framework.value}
                                                value={framework.label}
                                                onSelect={() => handleAdd(framework.label)}
                                                className="cursor-pointer py-3"
                                            >
                                                <Building2 className="mr-3 h-4 w-4 text-slate-400" />
                                                <span className="font-medium text-slate-700">{framework.label}</span>
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
                        <CardContent className="p-6 flex items-center justify-between">
                            <div className="flex items-center gap-5">
                                <div className="h-12 w-12 rounded bg-slate-100 flex items-center justify-center">
                                    <Building2 className="h-6 w-6 text-slate-400" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-slate-900">
                                        {typeof eng.org === 'string' ? eng.org : eng.org?.name}
                                    </h3>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <Badge variant="outline" className={cn(
                                            "text-[10px] uppercase",
                                            eng.status === 'PENDING' ? "bg-amber-50 text-amber-700 border-amber-200" : ""
                                        )}>
                                            {eng.status}
                                        </Badge>
                                        <span className="text-slate-400 text-xs">•</span>
                                        <span className="text-xs text-slate-500">{eng.questionnaires?.length || 0} Questionnaires</span>
                                    </div>
                                </div>
                            </div>
                            <Link href={eng.id.startsWith("temp-") ? "#" : `/app/le/${leId}/engagement-new/${eng.id}`}>
                                <Button
                                    variant="outline"
                                    disabled={eng.id.startsWith("temp-")}
                                    className="gap-2 group-hover:bg-indigo-50 group-hover:text-indigo-600 group-hover:border-indigo-200"
                                >
                                    {eng.id.startsWith("temp-") ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Creating...
                                        </>
                                    ) : (
                                        <>
                                            Open Workbench
                                            <ArrowUpRight className="h-4 w-4" />
                                        </>
                                    )}
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                ))}

                {engagements.length === 0 && !isAdding && (
                    <div className="text-center py-20 bg-slate-50 rounded-xl border-2 border-dashed">
                        <p className="text-slate-500">No active engagements found.</p>
                        <Button variant="link" onClick={() => setIsAdding(true)} className="mt-2">
                            Add your first partner
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
