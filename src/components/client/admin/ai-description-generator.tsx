"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Wand2, CheckCircle2, AlertCircle, Play, Sparkles } from "lucide-react";
import { generateFieldDescription, updateFieldDescription } from "@/actions/master-data-ai";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { useRouter } from "next/navigation";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface AIDescriptionGeneratorProps {
    fields: any[]; // Expecting MasterFieldDefinition objects
}

const DEFAULT_PROMPT = `You are a data architect defining a canonical master data dictionary for a B2B SaaS platform.

Provide a precise, formal definition for the field "{{fieldName}}" within the category "{{category}}". 
Declared data type: "{{dataType}}".

Constraints:
- Strict limit: 1–2 sentences.
- No examples.
- No usage guidance.
- No implementation notes.
- Define the business meaning only (what the field represents in the real world).
- Avoid process language (e.g., "used to", "allows", "captures", "tracks").
- Do not wrap the response in quotes.`;

export function AIDescriptionGenerator({ fields }: AIDescriptionGeneratorProps) {
    const router = useRouter();
    const [promptTemplate, setPromptTemplate] = useState(DEFAULT_PROMPT);
    const [isGenerating, setIsGenerating] = useState(false);

    // Status tracking
    const [progress, setProgress] = useState(0);
    const [completed, setCompleted] = useState(0);
    const [failed, setFailed] = useState(0);
    const [totalTarget, setTotalTarget] = useState(0);
    const [currentField, setCurrentField] = useState<string | null>(null);

    const emptyFields = fields.filter((f: any) => !f.notes || f.notes.trim() === "");

    const handleGenerate = async () => {
        if (emptyFields.length === 0) {
            toast.info("All fields already have descriptions.");
            return;
        }

        setIsGenerating(true);
        setTotalTarget(emptyFields.length);
        setCompleted(0);
        setFailed(0);
        setProgress(0);

        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < emptyFields.length; i++) {
            const field = emptyFields[i];
            setCurrentField(field.fieldName);

            try {
                // 1. Generate Description
                const res = await generateFieldDescription(
                    promptTemplate,
                    field.fieldName,
                    field.category || 'General',
                    field.appDataType || 'String'
                );

                if (res.success && res.description) {
                    // 2. Save to DB
                    const updateRes = await updateFieldDescription(field.fieldNo, res.description);
                    if (updateRes.success) {
                        successCount++;
                        setCompleted(successCount);
                    } else {
                        failCount++;
                        setFailed(failCount);
                        console.error(`Failed to save ${field.fieldName}: ${updateRes.error}`);
                    }
                } else {
                    failCount++;
                    setFailed(failCount);
                    console.error(`Failed to generate ${field.fieldName}: ${res.error}`);
                }
            } catch (err) {
                failCount++;
                setFailed(failCount);
                console.error(`Error processing ${field.fieldName}:`, err);
            }

            setProgress(Math.round(((i + 1) / emptyFields.length) * 100));
        }

        setCurrentField(null);
        setIsGenerating(false);
        toast.success(`Generated ${successCount} descriptions. Failed: ${failCount}.`);

        // Refresh the page data so table updates
        router.refresh();
    };

    return (
        <Accordion type="single" collapsible className="mb-6 border border-indigo-100 dark:border-indigo-900/50 shadow-sm rounded-xl bg-gradient-to-br from-indigo-50/50 to-white dark:from-indigo-950/20 dark:to-slate-950 px-4">
            <AccordionItem value="ai-generator" className="border-none">
                <AccordionTrigger className="hover:no-underline py-4">
                    <div className="flex flex-col text-left">
                        <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-400 font-semibold text-lg">
                            <Sparkles className="h-5 w-5 text-indigo-500" />
                            AI Description Generator (for testing purposes)
                        </div>
                        <span className="text-sm font-normal text-slate-500 dark:text-slate-400 mt-1.5">
                            Automatically generate semantic definitions for fields that are missing notes.
                            <strong> {emptyFields.length} out of {fields.length}</strong> fields currently need descriptions.
                        </span>
                    </div>
                </AccordionTrigger>
                <AccordionContent>
                    <div className="pt-2 pb-4 space-y-4">
                    <div>
                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2 block">
                            System Prompt Template
                        </label>
                        <Textarea
                            className="font-mono text-xs bg-white dark:bg-slate-900 h-32"
                            value={promptTemplate}
                            onChange={(e) => setPromptTemplate(e.target.value)}
                            disabled={isGenerating}
                        />
                        <p className="text-[11px] text-slate-500 mt-1.5">
                            Available variables: <code className="bg-slate-100 px-1 py-0.5 rounded">{'{{fieldName}}'}</code>, <code className="bg-slate-100 px-1 py-0.5 rounded">{'{{category}}'}</code>, <code className="bg-slate-100 px-1 py-0.5 rounded">{'{{dataType}}'}</code>
                        </p>
                    </div>

                    {isGenerating && (
                        <div className="bg-white dark:bg-slate-900 border rounded-lg p-4 space-y-3">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-600 font-medium">
                                    {currentField ? (
                                        <span className="flex items-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                                            Generating: {currentField}...
                                        </span>
                                    ) : (
                                        "Finishing up..."
                                    )}
                                </span>
                                <span className="font-mono text-xs text-slate-500">
                                    {completed} / {totalTarget} Completed
                                </span>
                            </div>
                            <Progress value={progress} className="h-2" />
                            {failed > 0 && (
                                <p className="text-xs text-amber-600 flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3" /> {failed} generation errors encountered
                                </p>
                            )}
                        </div>
                    )}

                    <div className="flex justify-end pt-2">
                        <Button
                            onClick={handleGenerate}
                            disabled={isGenerating || emptyFields.length === 0}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <Play className="mr-2 h-4 w-4" />
                                    Generate Descriptions ({emptyFields.length})
                                </>
                            )}
                        </Button>
                    </div>
                    </div>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    );
}
