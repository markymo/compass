"use client";

import { useState, useTransition } from "react";
import { SchemaField, SchemaCategory } from "@/types/schema";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, Wand2, Check } from "lucide-react";
import { acceptCategoryProposal, proposeCategoryForField, bulkAutoMapFields } from "@/actions/schema";

interface SchemaManagerProps {
    fields: SchemaField[];
    categories: SchemaCategory[];
    onSeed?: () => void;
}

export function SchemaManager({ fields, categories, onSeed }: SchemaManagerProps) {
    const [isPending, startTransition] = useTransition();
    const [mappingFieldId, setMappingFieldId] = useState<string | null>(null);

    // Group fields by category
    const categorizedFields: Record<string, SchemaField[]> = {};
    const uncategorizedFields: SchemaField[] = [];

    fields.forEach(f => {
        if (f.categoryId && categories.find(c => c.id === f.categoryId)) {
            if (!categorizedFields[f.categoryId!]) {
                categorizedFields[f.categoryId!] = [];
            }
            categorizedFields[f.categoryId!].push(f);
        } else {
            uncategorizedFields.push(f);
        }
    });

    async function handleAutoMap(fieldId: string) {
        if (!fieldId) return; // safety
        setMappingFieldId(fieldId);
        startTransition(async () => {
            const res = await proposeCategoryForField(fieldId);
            setMappingFieldId(null);
            if (!res.success) {
                alert(`Auto-map failed: ${res.error}`);
            }
        });
    }

    async function handleAccept(fieldId: string, categoryId: string) {
        if (!fieldId) return; // safety
        startTransition(async () => {
            await acceptCategoryProposal(fieldId, categoryId);
        });
    }

    async function handleBulkMap() {
        startTransition(async () => {
            const res = await bulkAutoMapFields();
            if (!res.success) {
                alert(`Bulk map failed: ${res.error}`);
            } else {
                // Optional: success toast
            }
        });
    }

    // Helper to render a single field row
    const FieldRow = ({ field }: { field: SchemaField }) => {
        const proposedCategory = field.proposedCategoryId
            ? categories.find(c => c.id === field.proposedCategoryId)
            : null;

        return (
            <div className="flex items-center justify-between p-3 bg-white dark:bg-zinc-900 border rounded-lg shadow-sm group hover:border-blue-200 transition-colors">
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">{field.label}</span>
                        <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500">{field.key}</code>
                    </div>
                    {field.description && (
                        <span className="text-xs text-slate-500 mt-1">{field.description}</span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {/* Proposal State - Show if we have a proposal */}
                    {proposedCategory && (
                        <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/30 px-3 py-1.5 rounded-full border border-amber-200 dark:border-amber-800 animate-in fade-in slide-in-from-right-4">
                            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                            <span className="text-xs font-medium text-amber-900 dark:text-amber-100">
                                Suggested: {proposedCategory.title.split('.')[1] || proposedCategory.title}
                            </span>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 hover:bg-amber-200 dark:hover:bg-amber-800 rounded-full"
                                onClick={() => handleAccept(field.id || field.key, proposedCategory.id)}
                            >
                                <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                            </Button>
                        </div>
                    )}

                    {/* Action - Always allow re-mapping/mapping if it's in this list */}
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1.5"
                        onClick={() => handleAutoMap(field.id || field.key)}
                        disabled={isPending || mappingFieldId === (field.id || field.key)}
                    >
                        {mappingFieldId === (field.id || field.key) ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <Wand2 className="w-3.5 h-3.5 text-indigo-500" />
                        )}
                        {proposedCategory ? "Remap" : "Auto-Map"}
                    </Button>
                </div>
            </div>
        );
    };

    if (categories.length === 0) {
        return (
            <div className="p-8 text-center border rounded-xl bg-slate-50 dark:bg-zinc-900">
                <h3 className="font-semibold text-lg mb-2">Initialize Master Schema</h3>
                <p className="text-muted-foreground mb-4">Seed the database with the standard 17 compliance categories.</p>
                <Button onClick={onSeed} disabled={isPending}>
                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    Seed Standard Categories
                </Button>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

            {/* Left Column: Uncategorized Fields (Main Work Area) */}
            <div className="lg:col-span-2 space-y-6">
                <div className="flex items-center justify-between bg-white dark:bg-card p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-500" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">Uncategorized Fields</h3>
                            <p className="text-sm text-muted-foreground">{uncategorizedFields.length} fields require classification</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={onSeed} title="Refresh Category Definitions">
                            Refresh Definition
                        </Button>
                        {uncategorizedFields.length > 0 && (
                            <Button
                                onClick={handleBulkMap}
                                disabled={isPending}
                                className="bg-indigo-600 hover:bg-indigo-700"
                            >
                                {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
                                Auto-Map All
                            </Button>
                        )}
                    </div>
                </div>

                {uncategorizedFields.length === 0 ? (
                    <div className="text-center py-12 text-sm text-muted-foreground bg-white dark:bg-card border rounded-xl border-dashed">
                        <Check className="w-12 h-12 mx-auto mb-3 text-green-500 opacity-50" />
                        <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">All caught up!</h3>
                        <p>All fields have been successfully categorized.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {uncategorizedFields.map((f, idx) => (
                            <FieldRow key={f.id || f.key || idx} field={f} />
                        ))}
                    </div>
                )}
            </div>

            {/* Right Column: Categories (Reference Panel) */}
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 lg:sticky lg:top-24 max-h-[calc(100vh-8rem)] overflow-y-auto w-full">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-slate-900 dark:text-slate-100">Categories</h2>
                    <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800">{categories.length}</Badge>
                </div>

                <Accordion type="single" collapsible className="w-full space-y-3">
                    {categories.map((category) => {
                        const schemaFields = categorizedFields[category.id] || [];
                        return (
                            <AccordionItem
                                key={category.id}
                                value={category.id}
                                className="bg-white dark:bg-card border border-slate-200 dark:border-slate-800 rounded-lg px-3 shadow-sm"
                            >
                                <AccordionTrigger className="hover:no-underline py-3 text-sm">
                                    <div className="flex flex-col items-start gap-1 text-left w-full pr-2">
                                        <div className="flex items-center justify-between w-full">
                                            <span className="font-medium text-slate-900 dark:text-slate-200">
                                                {category.title.split('. ')[1] || category.title}
                                            </span>
                                            {schemaFields.length > 0 && (
                                                <Badge variant="secondary" className="ml-2 h-5 text-[10px] px-1.5 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                                    {schemaFields.length}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="pb-3 pt-1">
                                    {schemaFields.length > 0 ? (
                                        <div className="space-y-1.5">
                                            {schemaFields.map((f, idx) => (
                                                <div key={f.id || f.key || idx} className="flex items-center justify-between p-1.5 rounded bg-slate-50 dark:bg-zinc-900 text-xs border border-slate-100 dark:border-zinc-800">
                                                    <span className="font-medium truncate max-w-[180px]" title={f.label}>{f.label}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="py-2">
                                            <span className="text-xs font-normal text-slate-500 line-clamp-2">
                                                {category.description}
                                            </span>
                                            {category.examples && category.examples.length > 0 && (
                                                <div className="mt-1 flex flex-wrap gap-1">
                                                    {category.examples.slice(0, 3).map((ex, i) => (
                                                        <span key={i} className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 rounded">
                                                            {ex}
                                                        </span>
                                                    ))}
                                                    {category.examples.length > 3 && (
                                                        <span className="text-[10px] text-slate-400">+ more</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </AccordionContent>
                            </AccordionItem>
                        );
                    })}
                </Accordion>
            </div>
        </div>
    );
}
