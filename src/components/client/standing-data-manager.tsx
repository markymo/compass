"use client"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { MASTER_SCHEMA_CATEGORIES } from "@/data/master-schema-categories";
import { StandingDataProperty } from "./standing-data-property";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";

interface StandingDataManagerProps {
    clientLEId: string;
    requirements: any[];
    standingData: Record<string, any>;
}

export function StandingDataManager({ clientLEId, requirements, standingData }: StandingDataManagerProps) {
    // 1. Group requirements by category
    const groupedRequirements: Record<string, any[]> = {};
    const uncategorized: any[] = [];

    requirements.forEach(req => {
        if (req.categoryId) {
            if (!groupedRequirements[req.categoryId]) groupedRequirements[req.categoryId] = [];
            groupedRequirements[req.categoryId].push(req);
        } else {
            uncategorized.push(req);
        }
    });

    return (
        <div className="space-y-6">
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl flex items-start gap-3 border border-slate-200 dark:border-slate-800">
                <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    <strong>Manage your core records.</strong> These details are automatically shared with your financial partners to satisfy their compliance requirements. Updates are saved in real-time.
                </div>
            </div>

            <Accordion type="multiple" defaultValue={MASTER_SCHEMA_CATEGORIES.map(c => c.id)} className="space-y-4">
                {MASTER_SCHEMA_CATEGORIES.map(category => {
                    const fields = groupedRequirements[category.id];
                    if (!fields || fields.length === 0) return null;

                    return (
                        <AccordionItem key={category.id} value={category.id} className="border-none">
                            <AccordionTrigger className="hover:no-underline py-2 px-0 bg-transparent">
                                <div className="flex items-center gap-3">
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">{category.title}</h3>
                                    <Badge variant="secondary" className="rounded-full h-5 px-2 text-[10px] font-bold">
                                        {fields.length}
                                    </Badge>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="pt-2 pb-6 grid gap-4 md:grid-cols-2">
                                {fields.map(field => {
                                    // Parse initial data (handle both string legacy and new object)
                                    let initialData = standingData[field.key] || null;
                                    if (typeof initialData === 'string') {
                                        initialData = {
                                            value: initialData,
                                            status: initialData ? "VERIFIED" : "MISSING",
                                            updatedAt: ""
                                        };
                                    }

                                    return (
                                        <StandingDataProperty
                                            key={field.key}
                                            clientLEId={clientLEId}
                                            propertyKey={field.key}
                                            label={field.label}
                                            initialData={initialData}
                                            requiredBy={field.requiredBy}
                                        />
                                    );
                                })}
                            </AccordionContent>
                        </AccordionItem>
                    );
                })}

                {/* Uncategorized */}
                {uncategorized.length > 0 && (
                    <AccordionItem value="uncategorized" className="border-none">
                        <AccordionTrigger className="hover:no-underline py-2 px-0">
                            <div className="flex items-center gap-3">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Other Information</h3>
                                <Badge variant="secondary" className="rounded-full h-5 px-2 text-[10px] font-bold">
                                    {uncategorized.length}
                                </Badge>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-2 pb-6 grid gap-4 md:grid-cols-2">
                            {uncategorized.map(field => {
                                let initialData = standingData[field.key] || null;
                                if (typeof initialData === 'string') {
                                    initialData = {
                                        value: initialData,
                                        status: initialData ? "VERIFIED" : "MISSING",
                                        updatedAt: new Date().toISOString()
                                    };
                                }

                                return (
                                    <StandingDataProperty
                                        key={field.key}
                                        clientLEId={clientLEId}
                                        propertyKey={field.key}
                                        label={field.label}
                                        initialData={initialData}
                                        requiredBy={field.requiredBy}
                                    />
                                );
                            })}
                        </AccordionContent>
                    </AccordionItem>
                )}
            </Accordion>
        </div>
    );
}
