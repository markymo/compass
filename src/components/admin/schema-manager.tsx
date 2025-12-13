"use client";

import { useState, useTransition } from "react";
import { SchemaField, SchemaCategory } from "@/types/schema";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Sparkles, Wand2, Check } from "lucide-react";
import { acceptCategoryProposal, proposeCategoryForField } from "@/actions/schema";

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
        setMappingFieldId(fieldId);
        startTransition(async () => {
            const res = await proposeCategoryForField(fieldId);
            setMappingFieldId(null);
        });
    }

    async function handleAccept(fieldId: string, categoryId: string) {
        startTransition(async () => {
            await acceptCategoryProposal(fieldId, categoryId);
        });
    }

    // Helper to render a single field row
    const FieldRow = ({ field }: { field: SchemaField }) => {
        const proposedCategory = field.proposedCategoryId
            ? categories.find(c => c.id === field.proposedCategoryId)
            : null;

        // Ensure we handle cases where categoryId might be set but invalid (hence why it's here)
        // We fundamentally want to show the actions if this row is being rendered.

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
                                onClick={() => handleAccept(field.id, proposedCategory.id)}
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
                        onClick={() => handleAutoMap(field.id)}
                        disabled={isPending || mappingFieldId === field.id}
                    >
                        {mappingFieldId === field.id ? (
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

            {/* Left Column: Categories & Mapped Fields */}
            <div className="lg:col-span-2 space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold font-serif text-slate-800 dark:text-slate-100">Master Compliance Categories</h2>
                    <Badge variant="outline" className="bg-slate-100">{categories.length} Categories</Badge>
                </div>

                <Accordion type="single" collapsible className="w-full space-y-4">
                    {categories.map((category) => {
                        const schemaFields = categorizedFields[category.id] || [];
                        return (
                            <AccordionItem
                                key={category.id}
                                value={category.id}
                                className="bg-white dark:bg-card border border-slate-200 dark:border-slate-800 rounded-lg px-4 shadow-sm"
                            >
                                <AccordionTrigger className="hover:no-underline py-4">
                                    <div className="flex flex-col items-start gap-1 text-left w-full pr-4">
                                        <div className="flex items-center justify-between w-full">
                                            <span className="font-semibold text-base text-slate-900 dark:text-slate-200">
                                                {category.title}
                                            </span>
                                            {schemaFields.length > 0 && (
                                                <Badge variant="secondary" className="ml-2 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                                    {schemaFields.length}
                                                </Badge>
                                            )}
                                        </div>
                                        <span className="text-xs font-normal text-slate-500 line-clamp-1">
                                            {category.description}
                                        </span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="pb-4 pt-2">
                                    {schemaFields.length > 0 ? (
                                        <div className="space-y-2">
                                            {schemaFields.map((f, idx) => (
                                                <div key={f.id || f.key || idx} className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-zinc-900 text-sm border border-slate-100 dark:border-zinc-800">
                                                    <span className="font-medium">{f.label}</span>
                                                    <code className="text-xs text-muted-foreground">{f.type}</code>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-4 text-xs text-muted-foreground italic bg-slate-50 rounded border border-dashed">
                                            No fields mapped to this category yet.
                                        </div>
                                    )}
                                </AccordionContent>
                            </AccordionItem>
                        );
                    })}
                </Accordion>
            </div>

            {/* Right Column: Uncategorized Fields */}
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 lg:sticky lg:top-24 max-h-[calc(100vh-8rem)] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-amber-500" />
                        Uncategorized Fields
                    </h3>
                    <Badge variant="secondary">{uncategorizedFields.length}</Badge>
                </div>

                {uncategorizedFields.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                        <Check className="w-8 h-8 mx-auto mb-2 text-green-500 opacity-50" />
                        All fields are categorized!
                    </div>
                ) : (
                    <div className="space-y-3">
                        {uncategorizedFields.map((f, idx) => (
                            <FieldRow key={f.id || f.key || idx} field={f} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
