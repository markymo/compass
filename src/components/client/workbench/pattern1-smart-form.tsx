"use client";

import { useEffect, useState } from "react";
import { getWorkbenchFields, WorkbenchField } from "@/actions/kyc-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Database, Zap, Sparkles } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Pattern1Props {
    leId: string;
}

export function Pattern1SmartForm({ leId }: Pattern1Props) {
    const [fields, setFields] = useState<WorkbenchField[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const data = await getWorkbenchFields(leId);
            setFields(data);
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
            <div className="p-8 max-w-3xl mx-auto space-y-6">
                <Skeleton className="h-8 w-64 mb-8" />
                {[1, 2, 3].map(i => (
                    <Card key={i}><CardContent className="p-6"><Skeleton className="h-12 w-full" /></CardContent></Card>
                ))}
            </div>
        );
    }

    const mappedFields = fields.filter(f => f.key !== 'UNMAPPED' && f.linkedQuestions.length > 0);

    const formatValue = (val: any) => {
        if (!val) return '';
        if (typeof val === 'object') return Object.values(val).filter(Boolean).join(' ');
        return String(val);
    };

    return (
        <ScrollArea className="h-[calc(100vh-140px)] bg-slate-50/50">
            <div className="max-w-3xl mx-auto p-8 pb-20">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                        <Sparkles className="h-6 w-6 text-indigo-500" />
                        Unified Entity Profile
                    </h1>
                    <p className="text-slate-500 mt-2">
                        This smart form automatically answers questions across all your bank relationships using your Master Data.
                        Expand any field to see the linked questions and set manual overrides if needed.
                    </p>
                </div>

                <div className="space-y-4">
                    {mappedFields.map((field) => (
                        <Card key={field.key} className="overflow-hidden border-slate-200 shadow-sm transition-all focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500">
                            <div className="p-5 flex flex-col md:flex-row md:items-start gap-4">
                                {/* Field Label & Badge */}
                                <div className="md:w-1/3 shrink-0 pt-2">
                                    <label className="text-sm font-semibold text-slate-900 block mb-1.5">
                                        {field.label}
                                    </label>
                                    <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-100 font-normal gap-1 px-2 py-0.5" title={`${field.linkedQuestions.length} questions map to this field`}>
                                        <Zap className="h-3 w-3" />
                                        Answers {field.linkedQuestions.length} Questions
                                    </Badge>
                                </div>

                                {/* Master Value Input */}
                                <div className="flex-1">
                                    <div className="relative">
                                        <Input
                                            value={formatValue(field.currentValue)}
                                            readOnly
                                            className="bg-white border-slate-200 pl-9 font-medium text-slate-900"
                                            placeholder="No master data..."
                                        />
                                        <Database className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                    </div>

                                    {/* Progressive Disclosure Accordion for Overrides */}
                                    <Accordion type="single" collapsible className="w-full mt-3">
                                        <AccordionItem value="overrides" className="border-none">
                                            <AccordionTrigger className="py-2.5 px-4 bg-slate-50 hover:bg-slate-100 rounded-lg text-xs font-medium text-slate-600 [&[data-state=open]]:rounded-b-none border border-transparent [&[data-state=open]]:border-slate-200 transition-all">
                                                View & Override Bank Questions
                                            </AccordionTrigger>
                                            <AccordionContent className="bg-slate-50 border border-t-0 border-slate-200 rounded-b-lg p-0">
                                                <div className="divide-y divide-slate-100">
                                                    {field.linkedQuestions.map(q => (
                                                        <div key={q.id} className="p-4 flex flex-col gap-3">
                                                            <div className="flex items-start justify-between gap-4">
                                                                <div>
                                                                    <div className="font-semibold text-xs text-slate-900 uppercase tracking-wider mb-1">
                                                                        {q.engagementOrgName || q.questionnaireName}
                                                                    </div>
                                                                    <p className="text-sm text-slate-600 font-medium">"{q.text}"</p>
                                                                </div>
                                                                <div className="flex items-center gap-2 shrink-0 bg-white border px-3 py-1.5 rounded-full shadow-sm">
                                                                    <span className="text-xs font-medium text-slate-500">Sync Config</span>
                                                                    <Switch defaultChecked id={`sync-${q.id}`} />
                                                                </div>
                                                            </div>
                                                            {/* Placeholder for the overridden input, hidden by default unless switch is off (mocked for now) */}
                                                            {/* <Input defaultValue={q.answer || ''} placeholder="Type custom answer for this bank..." className="bg-white mt-1" /> */}
                                                        </div>
                                                    ))}
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    </Accordion>
                                </div>
                            </div>
                        </Card>
                    ))}

                    {mappedFields.length === 0 && !isLoading && (
                        <div className="text-center py-12 text-slate-500 border-2 border-dashed rounded-xl">
                            No mapped fields found yet.
                        </div>
                    )}
                </div>
            </div>
        </ScrollArea>
    );
}
