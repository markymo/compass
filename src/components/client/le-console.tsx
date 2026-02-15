"use client";

import { useEffect, useState } from "react";
import { getWorkbenchFields, WorkbenchField } from "@/actions/kyc-query";
import { WorkbenchFieldCard } from "./workbench/workbench-field-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { LayoutDashboard, Database, Link as LinkIcon, Users, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LEConsoleProps {
    leId: string;
}

// Map Models to Friendly Categories
const MODEL_CATEGORIES: Record<string, string> = {
    'IdentityProfile': 'Identity',
    'EntityInfoProfile': 'Entity Info',
    'RelationshipProfile': 'Relationships',
    'ConstitutionalProfile': 'Constitutional',
    'ComplianceProfile': 'Compliance',
    'TaxProfile': 'Tax',
    'FinancialProfile': 'Financial',
    'TradingProfile': 'Trading',
    'LeiRegistration': 'LEI Data',
};

export function LEConsole({ leId }: LEConsoleProps) {
    const [fields, setFields] = useState<WorkbenchField[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState<string>("All");

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

    // Grouping Logic
    const groupedFields = fields.reduce((acc, field) => {
        let category = "Other";
        if (field.type === 'GROUP') {
            // Hardcoded group categories for now, or derive from ID?
            if (field.key.includes('ADDRESS')) category = 'Addresses';
            else if (field.key === 'UNMAPPED') category = 'Unmapped';
            else category = 'Groups';
        } else if (field.definition?.model) {
            category = MODEL_CATEGORIES[field.definition.model] || 'Other';
        }

        if (!acc[category]) acc[category] = [];
        acc[category].push(field);
        return acc;
    }, {} as Record<string, WorkbenchField[]>);

    const unmappedField = groupedFields['Unmapped']?.[0];
    const unmappedCount = unmappedField?.linkedQuestions.length || 0;

    // Remove Unmapped from standard categories
    const masterDataCategories = ["All", ...Object.keys(groupedFields).filter(c => c !== 'Unmapped').sort()];

    if (isLoading) {
        return (
            <div className="space-y-4 p-6">
                <Skeleton className="h-10 w-48 mb-6" />
                <div className="flex gap-6">
                    <Skeleton className="h-full w-64 hidden md:block" />
                    <div className="flex-1 space-y-4">
                        <Skeleton className="h-32 w-full" />
                        <Skeleton className="h-32 w-full" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-140px)] flex flex-col">
            <Tabs defaultValue="master-data" className="flex-1 flex flex-col overflow-hidden">
                <div className="px-6 py-2 border-b bg-white flex items-center justify-between shrink-0">
                    <TabsList>
                        <TabsTrigger value="master-data" className="gap-2">
                            <Database className="w-4 h-4" />
                            Master Data
                            <Badge variant="secondary" className="ml-1 text-[10px]">
                                {fields.length - (unmappedField ? 1 : 0)}
                            </Badge>
                        </TabsTrigger>
                        <TabsTrigger value="unmapped" className="gap-2">
                            <LinkIcon className="w-4 h-4" />
                            Unmapped Questions
                            {unmappedCount > 0 && (
                                <Badge variant="destructive" className="ml-1 text-[10px]">
                                    {unmappedCount}
                                </Badge>
                            )}
                        </TabsTrigger>
                    </TabsList>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-normal text-slate-500">
                            {leId.split('-')[0]}
                        </Badge>
                    </div>
                </div>

                {/* TAB 1: MASTER DATA (Matched Fields) */}
                <TabsContent value="master-data" className="flex-1 flex overflow-hidden mt-0">
                    {/* Sidebar / Category Nav */}
                    <div className="w-64 border-r border-slate-200 bg-slate-50/50 flex flex-col hidden md:flex overflow-y-auto">
                        <div className="p-4 space-y-1">
                            <h3 className="mb-2 px-2 text-xs font-semibold uppercase text-slate-500 tracking-wider">
                                Domain Categories
                            </h3>
                            {masterDataCategories.map(cat => (
                                <Button
                                    key={cat}
                                    variant={activeCategory === cat ? "secondary" : "ghost"}
                                    className="w-full justify-start text-sm mb-1"
                                    onClick={() => setActiveCategory(cat)}
                                >
                                    {cat}
                                    {cat !== "All" && (
                                        <Badge variant="secondary" className="ml-auto text-[10px] h-5 px-1.5 bg-slate-200/50">
                                            {groupedFields[cat]?.length || 0}
                                        </Badge>
                                    )}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {/* Main Content */}
                    <ScrollArea className="flex-1 bg-slate-50/30">
                        <div className="p-8 pb-20 max-w-5xl mx-auto">
                            <div className="mb-6">
                                <h2 className="text-xl font-semibold text-slate-900">Mapped Master Data</h2>
                                <p className="text-slate-500 text-sm">
                                    Approved "Golden Record" fields sourced from questionnaires and external data.
                                </p>
                            </div>

                            <div className="space-y-6">
                                {activeCategory === "All"
                                    ? Object.entries(groupedFields)
                                        .filter(([cat]) => cat !== 'Unmapped')
                                        .map(([cat, catFields]) => (
                                            <div key={cat} className="space-y-4">
                                                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider pl-1 border-b pb-1 mb-2">
                                                    {cat}
                                                </h3>
                                                {catFields.map(field => (
                                                    <WorkbenchFieldCard
                                                        key={field.key}
                                                        field={field}
                                                        leId={leId}
                                                        onUpdate={loadData}
                                                    />
                                                ))}
                                            </div>
                                        ))
                                    : (groupedFields[activeCategory] || []).map(field => (
                                        <WorkbenchFieldCard
                                            key={field.key}
                                            field={field}
                                            leId={leId}
                                            onUpdate={loadData}
                                        />
                                    ))
                                }

                                {(!fields.length || (fields.length === 1 && unmappedField)) && (
                                    <div className="text-center py-20">
                                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 mb-4">
                                            <Database className="w-6 h-6 text-slate-400" />
                                        </div>
                                        <h3 className="text-lg font-medium text-slate-900">No Mapped Data Yet</h3>
                                        <p className="text-slate-500 max-w-sm mx-auto mt-2">
                                            Questions have not been mapped to Master Data fields provided yet.
                                            Check the "Unmapped Questions" tab to map them.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </ScrollArea>
                </TabsContent>

                {/* TAB 2: UNMAPPED QUESTIONS */}
                <TabsContent value="unmapped" className="flex-1 overflow-hidden mt-0">
                    <ScrollArea className="h-full bg-slate-50/30">
                        <div className="p-8 max-w-4xl mx-auto">
                            <div className="mb-6">
                                <h2 className="text-xl font-semibold text-slate-900">Unmapped Questions</h2>
                                <p className="text-slate-500 text-sm">
                                    Questions from engagements that are not linked to any Master Data field.
                                </p>
                            </div>

                            {unmappedCount === 0 ? (
                                <div className="text-center py-20 text-slate-400 bg-white border-2 border-dashed border-slate-200 rounded-lg">
                                    <Check className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                    <p>All questions are mapped!</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {unmappedField?.linkedQuestions.map(q => (
                                        <div key={q.id} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col gap-2">
                                            <div className="flex justify-between gap-4">
                                                <p className="font-medium text-slate-900">{q.text}</p>
                                                <Badge variant="outline" className="shrink-0 h-6">
                                                    {q.questionnaireName}
                                                </Badge>
                                            </div>
                                            {q.answer && (
                                                <div className="bg-slate-50 p-2 rounded text-sm text-slate-700 font-mono">
                                                    {q.answer}
                                                </div>
                                            )}
                                            <div className="flex justify-end pt-2">
                                                <Button size="sm" variant="outline" className="text-xs">
                                                    Map to Field
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </TabsContent>
            </Tabs>
        </div>
    );
}
