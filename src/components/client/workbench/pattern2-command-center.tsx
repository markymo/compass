"use client";

import { useEffect, useState } from "react";
import { getWorkbenchFields, WorkbenchField } from "@/actions/kyc-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Database, Link as LinkIcon, Edit3, CheckCircle2, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Pattern2Props {
    leId: string;
}

export function Pattern2CommandCenter({ leId }: Pattern2Props) {
    const [fields, setFields] = useState<WorkbenchField[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedFieldKey, setSelectedFieldKey] = useState<string | null>(null);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const data = await getWorkbenchFields(leId);
            setFields(data);
            const mapped = data.filter(f => f.key !== 'UNMAPPED' && f.linkedQuestions.length > 0);
            if (mapped.length > 0) {
                setSelectedFieldKey(mapped[0].key);
            }
        } catch (error) {
            console.error("Failed to load workbench fields", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [leId]);

    if (isLoading) {
        return (
            <div className="flex h-[calc(100vh-140px)] p-6 gap-6">
                <Skeleton className="h-full w-80" />
                <Skeleton className="h-full flex-1" />
            </div>
        );
    }

    const mappedFields = fields.filter(f => f.key !== 'UNMAPPED' && f.linkedQuestions.length > 0);
    const selectedField = mappedFields.find(f => f.key === selectedFieldKey);

    const formatValue = (val: any) => {
        if (!val) return '';
        if (typeof val === 'object') return Object.values(val).filter(Boolean).join(' ');
        return String(val);
    };

    return (
        <div className="flex h-[calc(100vh-140px)] overflow-hidden bg-slate-50/30">
            {/* Left Pane: Master Data List */}
            <div className="w-80 border-r bg-white flex flex-col shrink-0">
                <div className="p-4 border-b bg-slate-50/50">
                    <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                        <Database className="h-4 w-4 text-indigo-500" />
                        Master Data
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">Select a field to view context.</p>
                </div>
                <ScrollArea className="flex-1">
                    <div className="p-2 space-y-1">
                        {mappedFields.map(field => (
                            <button
                                key={field.key}
                                onClick={() => setSelectedFieldKey(field.key)}
                                className={cn(
                                    "w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all flex items-center justify-between group",
                                    selectedFieldKey === field.key
                                        ? "bg-indigo-50 text-indigo-900 font-medium"
                                        : "text-slate-700 hover:bg-slate-100"
                                )}
                            >
                                <span className="truncate pr-2">{field.label}</span>
                                <Badge variant="secondary" className={cn(
                                    "h-5 px-1.5 shrink-0 transition-colors text-[10px]",
                                    selectedFieldKey === field.key ? "bg-indigo-200/50 text-indigo-700" : "bg-slate-200/50 text-slate-500 group-hover:bg-slate-200"
                                )}>
                                    {field.linkedQuestions.length}
                                </Badge>
                            </button>
                        ))}
                    </div>
                </ScrollArea>
            </div>

            {/* Right Pane: Context Inspector */}
            <ScrollArea className="flex-1 bg-slate-50">
                {selectedField ? (
                    <div className="p-8 max-w-3xl mx-auto space-y-8 pb-24">

                        {/* Selected Field Header */}
                        <div>
                            <div className="flex items-center gap-2 mb-2 text-indigo-600 font-medium text-sm">
                                <LinkIcon className="h-4 w-4" />
                                Mapped to {selectedField.linkedQuestions.length} Questions
                            </div>
                            <h1 className="text-3xl font-bold text-slate-900">{selectedField.label}</h1>
                        </div>

                        {/* Master Answer Card */}
                        <Card className="border-indigo-100 shadow-sm overflow-hidden border-2">
                            <CardHeader className="bg-indigo-50/50 pb-4 border-b border-indigo-50">
                                <CardTitle className="text-sm font-semibold text-indigo-900 flex items-center gap-2">
                                    <Database className="h-4 w-4 text-indigo-500" />
                                    Golden Record Answer
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 bg-white">
                                <Input
                                    value={formatValue(selectedField.currentValue)}
                                    readOnly
                                    className="bg-slate-50/50 border-slate-200 text-lg py-6 font-medium text-slate-900 focus-visible:ring-0 shadow-inner"
                                    placeholder="No data recorded..."
                                />
                            </CardContent>
                        </Card>

                        {/* Linked Questions Breakout */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider flex items-center justify-between">
                                Affected Questionnaires
                            </h3>

                            <div className="space-y-3">
                                {selectedField.linkedQuestions.map(q => (
                                    <Card key={q.id} className="border-slate-200 shadow-sm hover:border-slate-300 transition-colors">
                                        <div className="p-5">
                                            <div className="flex items-start justify-between gap-6">
                                                <div className="space-y-2 flex-1">
                                                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                                        <Building2 className="h-3.5 w-3.5" />
                                                        {q.engagementOrgName || q.questionnaireName}
                                                    </div>
                                                    <p className="text-slate-900 font-medium">"{q.text}"</p>
                                                    <div className="text-sm text-slate-500 flex items-center gap-1.5 mt-2 bg-slate-50 w-fit px-2 py-1 rounded border">
                                                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                                        Inheriting Master Data
                                                    </div>
                                                </div>
                                                <Button variant="outline" size="sm" className="shrink-0 gap-1.5 h-8">
                                                    <Edit3 className="h-3.5 w-3.5" />
                                                    Set Override
                                                </Button>
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        </div>

                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                        <Database className="h-12 w-12 mb-4 opacity-20" />
                        <p>Select a field from the menu to inspect mappings.</p>
                    </div>
                )}
            </ScrollArea>
        </div>
    );
}
