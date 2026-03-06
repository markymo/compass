"use client";

import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, Sparkles, AlertCircle, CheckCircle2, ChevronRight, Search, LayoutList, LayoutTemplate, Check, Plus, Settings, Pencil, Paperclip, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

// --- Inline Text Editor Component ---
function InlineTextEditor({ value, onSave, className }: { value: string, onSave: (val: string) => void, className?: string }) {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(value);

    // Sync if external value changes while not editing
    useEffect(() => {
        if (!isEditing) setEditValue(value);
    }, [value, isEditing]);

    const handleSave = () => {
        setIsEditing(false);
        if (editValue.trim() && editValue !== value) {
            onSave(editValue.trim());
        } else {
            setEditValue(value); // Revert on empty or unchanged
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') {
            setIsEditing(false);
            setEditValue(value);
        }
    };

    if (isEditing) {
        return (
            <input
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                className={cn("w-full bg-slate-50 border border-indigo-300 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-100", className)}
            />
        );
    }

    return (
        <div
            onClick={() => setIsEditing(true)}
            className={cn("cursor-text hover:bg-slate-100/50 rounded px-1 -mx-1 transition-colors group relative min-h-[20px] min-w-[50px] inline-block", className)}
            title="Click to edit short name"
        >
            {value || <span className="text-slate-400/60 italic text-xs">Add short name...</span>}
            <Pencil className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 absolute -right-4 top-1" />
        </div>
    );
}
// ------------------------------------

// Server Actions
import { saveQuestionnaireChanges, analyzeQuestionnaire, getOrgCustomFields, getQuestionnaireById, createCustomFieldDefinition, compactifyQuestion, getMasterSchemaContext } from "@/actions/questionnaire";

interface QuestionnaireMapperProps {
    questionnaireId: string;
    onBack: () => void;
    standingData?: any;
}

export function QuestionnaireMapper({ questionnaireId, onBack, standingData }: QuestionnaireMapperProps) {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);

    // Data State
    const [questionnaire, setQuestionnaire] = useState<any>(null);
    const [questions, setQuestions] = useState<any[]>([]);
    const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
    const [filter, setFilter] = useState("");
    const [viewMode, setViewMode] = useState<"split" | "grid">("grid"); // Default to Grid

    // UX State
    const [confidenceThreshold, setConfidenceThreshold] = useState(70); // Default 70%

    // Custom Fields
    const [customFields, setCustomFields] = useState<any[]>([]);

    // Master Schema Context
    const [masterFields, setMasterFields] = useState<any[]>([]);
    const [masterGroups, setMasterGroups] = useState<any[]>([]);

    // Generation State
    const [generatingCompact, setGeneratingCompact] = useState<Record<string, boolean>>({});

    useEffect(() => {
        loadData();
    }, [questionnaireId]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [qData, schemaContext] = await Promise.all([
                getQuestionnaireById(questionnaireId),
                getMasterSchemaContext()
            ]);

            if (qData) {
                setQuestionnaire(qData);
                // Sort by order
                const sorted = [...(qData.questions || [])].sort((a: any, b: any) => a.order - b.order);
                setQuestions(sorted);
                if (sorted.length > 0) setSelectedQuestionId(sorted[0].id);

                // Fetch custom fields
                if (qData.fiOrgId) {
                    loadCustomFields(qData.fiOrgId);
                }
            }

            if (schemaContext) {
                setMasterFields(schemaContext.masterFields);
                setMasterGroups(schemaContext.masterGroups);
            }
        } catch (e) {
            toast.error("Failed to load questionnaire data");
        } finally {
            setLoading(false);
        }
    };

    const loadCustomFields = async (orgId: string) => {
        try {
            const fields = await getOrgCustomFields(orgId);
            setCustomFields(fields);
        } catch (e) {
            console.error("Failed to load custom fields", e);
        }
    };

    // Auto-generate missing compact texts after load
    useEffect(() => {
        if (!loading && questions.length > 0) {
            const missing = questions.filter((q: any) => !q.compactText && q.text);
            if (missing.length > 0) {
                missing.forEach(((q: any, idx: any)) => {
                    // Stagger generation slightly to avoid hammering the server all at exactly same ms
                    setTimeout(() => {
                        handleGenerateCompactText(q.id, q.text, true);
                    }, idx * 500);
                });
            }
        }
    }, [loading, questions.length]); // Only trigger once load finishes

    const handleGenerateCompactText = async (id: string, text: string, silent: boolean = false) => {
        if (!text) return;
        setGeneratingCompact(prev => ({ ...prev, [id]: true }));
        try {
            const result = await compactifyQuestion(text);
            if (result.success && result.compactText) {
                updateQuestion(id, { compactText: result.compactText });
                if (!silent) toast.success("Generated short name");
            } else if (!silent) {
                toast.error(result.error || "Failed to generate");
            }
        } catch (e) {
            if (!silent) toast.error("Error generating short name");
        } finally {
            setGeneratingCompact(prev => ({ ...prev, [id]: false }));
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (!questionnaire) return;

            // Map back to format expected by backend
            const itemsToSave = questions.map((q: any) => ({
                type: "question",
                text: q.text,
                originalText: q.originalText || q.text,
                compactText: q.compactText || null, // DO NOT hard-save substring fallback
                order: q.order,
                masterFieldNo: q.masterFieldNo,
                masterQuestionGroupId: q.masterQuestionGroupId,
                customFieldDefinitionId: q.customFieldDefinitionId,
                // Persist AI metadata if useful, though backend might not store it on 'Question' model directly unless schema updated
                // For now, we only save the IDs
            }));

            const result = await saveQuestionnaireChanges(questionnaire.id, itemsToSave);
            if (result.success) {
                toast.success("Mappings saved successfully");
            } else {
                toast.error(result.error || "Failed to save");
            }
        } catch (error) {
            toast.error("Error saving changes");
        } finally {
            setSaving(false);
        }
    };

    const handleAutoMap = async () => {
        if (!confirm(`Auto-Map will use AI to suggest mappings with >${confidenceThreshold}% confidence. Continue?`)) return;
        setAnalyzing(true);
        try {
            const result = await analyzeQuestionnaire(questionnaire.id);
            if (result && result.suggestions) {
                const newQuestions = [...questions];
                let count = 0;

                result.suggestions.forEach((sug: any) => {
                    const match = newQuestions.find((q: any) => q.text === sug.text || q.originalText === sug.text);

                    if (match) {
                        // Apply Threshold
                        const confidence = (sug.confidence || 0) * 100;
                        if (confidence < confidenceThreshold) {
                            // Skip if below threshold
                            return;
                        }

                        // Attach confidence score to question state for UI display
                        match.aiConfidence = confidence; // Augment local state

                        // Priority 1: Master Key
                        if (sug.suggestedKey) {
                            const isGroup = masterGroups.find((g: any) => g.key === sug.suggestedKey);
                            const isField = masterFields.find((f: any) => f.fieldNo === parseInt(sug.suggestedKey));

                            if (isGroup) {
                                match.masterQuestionGroupId = sug.suggestedKey;
                                match.masterFieldNo = null;
                                match.customFieldDefinitionId = null;
                                count++;
                            } else if (isField) {
                                match.masterFieldNo = parseInt(sug.suggestedKey);
                                match.masterQuestionGroupId = null;
                                match.customFieldDefinitionId = null;
                                count++;
                            }
                        }
                    }
                });
                setQuestions(newQuestions);
                toast.success(`Mapped ${count} questions (>${confidenceThreshold}%)`);
            }
        } catch (e) {
            toast.error("Auto-map failed");
        } finally {
            setAnalyzing(false);
        }
    };

    const updateQuestion = (id: string, updates: any) => {
        setQuestions(prev => prev.map((q: any) => {
            if (q.id === id) {
                const updated = { ...q, ...updates };
                // Mutually exclusive logic
                if (updates.masterFieldNo) {
                    updated.masterQuestionGroupId = null;
                    updated.customFieldDefinitionId = null;
                }
                if (updates.masterQuestionGroupId) {
                    updated.masterFieldNo = null;
                    updated.customFieldDefinitionId = null;
                }
                if (updates.customFieldDefinitionId) {
                    updated.masterFieldNo = null;
                    updated.masterQuestionGroupId = null;
                }
                return updated;
            }
            return q;
        }));
    };

    const handleAddQuestion = () => {
        const newOrder = questions.length > 0 ? Math.max(...questions.map((q: any) => q.order)) + 1 : 1;
        const newQuestion: any = {
            id: `temp-${Date.now()}`,
            text: "New Question",
            originalText: "New Question",
            compactText: null, // Default to null so UI falls back
            order: newOrder,
            questionnaireId: questionnaire.id,
        };
        setQuestions([...questions, newQuestion]);
    };

    const handleRemoveQuestion = (id: string) => {
        setQuestions(prev => {
            const index = prev.findIndex(q => q.id === id);
            if (index === -1) return prev;

            const newQuestions = prev.filter((q: any) => q.id !== id);

            // Re-order remaining questions
            const reordered = newQuestions.map(((q: any, i: any)) => ({
                ...q,
                order: i + 1
            }));

            // If the deleted question was selected, clear selection or select another
            if (selectedQuestionId === id) {
                if (reordered.length === 0) {
                    setSelectedQuestionId('');
                } else {
                    const nextToSelect = Math.min(index, reordered.length - 1);
                    setSelectedQuestionId(reordered[nextToSelect].id);
                }
            }

            return reordered;
        });
    };

    const handleMoveQuestionUp = (id: string) => {
        setQuestions(prev => {
            const index = prev.findIndex(q => q.id === id);
            if (index <= 0) return prev; // Already at top

            const newQuestions = [...prev];
            // Swap with previous
            const temp = newQuestions[index - 1];
            newQuestions[index - 1] = newQuestions[index];
            newQuestions[index] = temp;

            // Re-assign orders based on new array position
            return newQuestions.map(((q: any, i: any)) => ({ ...q, order: i + 1 }));
        });
    };

    const handleMoveQuestionDown = (id: string) => {
        setQuestions(prev => {
            const index = prev.findIndex(q => q.id === id);
            if (index === -1 || index >= prev.length - 1) return prev; // Already at bottom

            const newQuestions = [...prev];
            // Swap with next
            const temp = newQuestions[index + 1];
            newQuestions[index + 1] = newQuestions[index];
            newQuestions[index] = temp;

            // Re-assign orders based on new array position
            return newQuestions.map(((q: any, i: any)) => ({ ...q, order: i + 1 }));
        });
    };

    const handleCreateCustomField = async (label: string) => {
        if (!questionnaire?.fiOrgId) return;
        const toastId = toast.loading("Creating field...");
        try {
            const res = await createCustomFieldDefinition(questionnaire.fiOrgId, label, "Text");
            if (res.success && res.data) {
                toast.dismiss(toastId);
                toast.success(`Created field "${label}"`);

                // Add to local list
                const newField = res.data;
                setCustomFields(prev => [...prev, newField].sort(((a: any, b: any)) => a.label.localeCompare(b.label)));

                // Select it
                if (selectedQuestionId) {
                    updateQuestion(selectedQuestionId, { customFieldDefinitionId: newField.id });
                }
            } else {
                toast.error("Failed create field");
            }
        } catch (e) {
            toast.error("Error creating field");
        }
    };

    const selectedQuestion = questions.find((q: any) => q.id === selectedQuestionId);

    const filteredQuestions = questions.filter((q: any) =>
        (q.text || "").toLowerCase().includes(filter.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex h-[400px] items-center justify-center text-slate-400">
                <Loader2 className="h-8 w-8 animate-spin mb-2" />
                <span className="sr-only">Loading...</span>
            </div>
        )
    }

    if (!questionnaire) return null;

    // ... existing render logic ...

    return (
        <div className="flex flex-col flex-1 border rounded-xl overflow-hidden bg-white shadow-sm mb-12">
            {/* HEADER */}
            <div className="flex items-center justify-between p-4 border-b bg-slate-50/50">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 text-slate-500">
                        ← Back
                    </Button>
                    <div className="h-4 w-px bg-slate-200" />

                    {/* View Switcher */}
                    <div className="flex bg-slate-100 p-0.5 rounded-lg border">
                        <button
                            onClick={() => setViewMode("grid")}
                            className={cn(
                                "p-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5",
                                viewMode === "grid" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                            )}
                        >
                            <LayoutList className="w-3.5 h-3.5" />
                            Grid
                        </button>
                        <button
                            onClick={() => setViewMode("split")}
                            className={cn(
                                "p-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5",
                                viewMode === "split" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                            )}
                        >
                            <LayoutTemplate className="w-3.5 h-3.5" />
                            Split
                        </button>
                    </div>

                    <div className="h-4 w-px bg-slate-200" />

                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-700">Auto-Map:</span>
                        <div className="flex items-center gap-2">
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={confidenceThreshold}
                                onChange={(e) => setConfidenceThreshold(parseInt(e.target.value))}
                                className="w-24 accent-indigo-600 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                            />
                            <Badge variant="outline" className="w-10 justify-center bg-white">
                                {confidenceThreshold}%
                            </Badge>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleAutoMap} disabled={analyzing} className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                        {analyzing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                        Auto-Map
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={saving} className="bg-slate-900 text-white hover:bg-slate-800">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                        Save
                    </Button>
                </div>
            </div>

            {/* CONTENT AREA */}
            <div className="flex flex-1 overflow-hidden">
                {viewMode === "grid" ? (
                    // GRID VIEW (Inline Speed Mode)
                    <div className="flex-1 flex flex-col bg-slate-50/30">
                        {/* Filter Bar */}
                        <div className="p-2 border-b bg-white flex items-center gap-2">
                            <Search className="h-4 w-4 text-slate-400 ml-2" />
                            <Input
                                placeholder="Filter questions..."
                                className="border-none shadow-none focus-visible:ring-0 h-9"
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                            />
                            <div className="text-xs text-slate-400 font-medium px-4">
                                {filteredQuestions.length} Questions
                            </div>
                        </div>

                        {/* Table Header */}
                        <div className="grid grid-cols-[60px_1fr_180px_200px_60px_100px_120px] gap-4 px-6 py-3 bg-slate-50 border-b text-xs font-semibold text-slate-500 uppercase tracking-wider items-center">
                            <div>Order</div>
                            <div>Question Text</div>
                            <div>Compact Label</div>
                            <div>Mapping</div>
                            <div className="flex justify-center" title="Allow File Attachments">
                                <Paperclip className="h-4 w-4" />
                            </div>
                            <div>Status</div>
                            <div className="text-right">Actions</div>
                        </div>

                        {/* Table Body */}
                        <div className="flex-1 overflow-y-auto">
                            <div className="divide-y divide-slate-100">
                                {filteredQuestions.map((q: any) => {
                                    const isMapped = q.masterFieldNo || q.masterQuestionGroupId || q.customFieldDefinitionId;

                                    // Determine current value for selector
                                    const mappingValue =
                                        q.masterFieldNo ? `master:${q.masterFieldNo}` :
                                            q.masterQuestionGroupId ? `group:${q.masterQuestionGroupId}` :
                                                q.customFieldDefinitionId ? `custom:${q.customFieldDefinitionId}` :
                                                    null;

                                    return (
                                        <div key={q.id} className="grid grid-cols-[60px_1fr_180px_200px_60px_100px_120px] gap-4 px-6 py-3 items-center hover:bg-white transition-colors group">
                                            <div className="text-xs text-slate-400 font-mono">#{q.order}</div>
                                            <div className="text-sm text-slate-700 font-medium pr-8 relative">
                                                <InlineTextEditor
                                                    value={q.text || ""}
                                                    onSave={(newText) => updateQuestion(q.id, { text: newText })}
                                                    className="line-clamp-2"
                                                />
                                            </div>
                                            <div className="text-sm text-slate-700 font-medium relative pr-8 pl-1">
                                                <div className="flex items-center gap-1 group/compact w-full relative">
                                                    <InlineTextEditor
                                                        value={q.compactText || ""}
                                                        onSave={(newText) => updateQuestion(q.id, { compactText: newText })}
                                                        className="line-clamp-1 italic text-slate-500 text-xs flex-1 max-w-[calc(100%-24px)]"
                                                    />
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className={cn(
                                                            "h-6 w-6 absolute right-0 transition-opacity",
                                                            q.compactText ? "opacity-0 group-hover/compact:opacity-100" : "opacity-100"
                                                        )}
                                                        onClick={() => handleGenerateCompactText(q.id, q.text)}
                                                        disabled={generatingCompact[q.id] || !q.text}
                                                        title="Generate Short Name via AI"
                                                    >
                                                        {generatingCompact[q.id] ? (
                                                            <Loader2 className="h-3 w-3 animate-spin text-indigo-500" />
                                                        ) : (
                                                            <RefreshCw className="h-3 w-3 text-slate-400 hover:text-indigo-600" />
                                                        )}
                                                    </Button>
                                                </div>
                                            </div>
                                            <div>
                                                <FieldSelector
                                                    value={mappingValue}
                                                    onSelect={(val, type, label) => {
                                                        if (type === 'create') handleCreateCustomField(label!);
                                                        else if (type === 'master') updateQuestion(q.id, { masterFieldNo: parseInt(val), masterQuestionGroupId: null, customFieldDefinitionId: null });
                                                        else if (type === 'group') updateQuestion(q.id, { masterQuestionGroupId: val, masterFieldNo: null, customFieldDefinitionId: null });
                                                        else if (type === 'custom') updateQuestion(q.id, { customFieldDefinitionId: val, masterFieldNo: null, masterQuestionGroupId: null });
                                                        else if (type === 'clear') updateQuestion(q.id, { masterFieldNo: null, masterQuestionGroupId: null, customFieldDefinitionId: null });
                                                    }}
                                                    customFields={customFields}
                                                    compact
                                                />
                                            </div>
                                            <div className="flex justify-center">
                                                <Switch
                                                    checked={q.allowAttachments || false}
                                                    onCheckedChange={(checked) => updateQuestion(q.id, { allowAttachments: checked })}
                                                    className="scale-75"
                                                />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {isMapped ? (
                                                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1 pl-1 pr-2 py-0.5 h-6">
                                                        <CheckCircle2 className="h-3 w-3" />
                                                        Mapped
                                                    </Badge>
                                                ) : (
                                                    <span className="text-xs text-slate-400 group-hover:text-slate-500">-</span>
                                                )}
                                            </div>
                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-600" onClick={() => handleMoveQuestionUp(q.id)}>
                                                    <ChevronRight className="h-4 w-4 -rotate-90" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-600" onClick={() => handleMoveQuestionDown(q.id)}>
                                                    <ChevronRight className="h-4 w-4 rotate-90" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-500 hover:bg-red-50" onClick={() => handleRemoveQuestion(q.id)}>
                                                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4"><path d="M5.5 1C5.22386 1 5 1.22386 5 1.5C5 1.77614 5.22386 2 5.5 2H9.5C9.77614 2 10 1.77614 10 1.5C10 1.22386 9.77614 1 9.5 1H5.5ZM3 3.5C3 3.22386 3.22386 3 3.5 3H11.5C11.7761 3 12 3.22386 12 3.5C12 3.77614 11.7761 4 11.5 4H11V12C11 12.5523 10.5523 13 10 13H5C4.44772 13 4 12.5523 4 12V4H3.5C3.22386 4 3 3.77614 3 3.5ZM5 4H10V12H5V4Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                                <Button variant="outline" size="sm" onClick={handleAddQuestion} className="w-full border-dashed border-slate-300 text-slate-500 hover:text-slate-800 hover:border-slate-400 bg-transparent h-10">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Question Manually
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    // SPLIT VIEW (Original Focus Mode)
                    <>
                        {/* LEFT: LIST */}
                        <div className="w-1/3 border-r bg-slate-50 flex flex-col min-w-[320px]">
                            {/* ... existing list code ... */}
                            <div className="p-3 border-b bg-white">
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                    <Input
                                        placeholder="Filter questions..."
                                        className="pl-9 bg-white border-slate-200"
                                        value={filter}
                                        onChange={(e) => setFilter(e.target.value)}
                                    />
                                </div>
                            </div>
                            <ScrollArea className="flex-1">
                                <div className="divide-y divide-slate-100">
                                    {filteredQuestions.map((q: any) => {
                                        const isMapped = q.masterFieldNo || q.masterQuestionGroupId || q.customFieldDefinitionId;
                                        return (
                                            <button
                                                key={q.id}
                                                onClick={() => setSelectedQuestionId(q.id)}
                                                className={cn(
                                                    "w-full text-left p-4 hover:bg-white transition-colors flex gap-3 text-sm relative group",
                                                    selectedQuestionId === q.id ? "bg-white shadow-sm z-10" : ""
                                                )}
                                            >
                                                {selectedQuestionId === q.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500" />}
                                                <span className="font-mono text-slate-400 text-xs mt-0.5 opacity-70 w-6 shrink-0">#{q.order}</span>
                                                <div className="flex-1 min-w-0 pr-16 relative">
                                                    <p className={cn("line-clamp-2 leading-relaxed transition-all", selectedQuestionId === q.id ? "text-slate-900 font-medium" : "text-slate-600 group-hover:pr-12")}>
                                                        {q.text}
                                                    </p>
                                                    {isMapped && (
                                                        <div className="mt-2 flex items-center gap-2">
                                                            <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-normal bg-green-50 text-green-700 border-green-100 gap-1 opacity-90">
                                                                <CheckCircle2 className="h-3 w-3" />
                                                                Mapped
                                                            </Badge>
                                                            {q.aiConfidence && (
                                                                <span className={cn(
                                                                    "text-[10px] font-medium opacity-80",
                                                                    q.aiConfidence >= 80 ? "text-green-600" : "text-yellow-600"
                                                                )}>
                                                                    {Math.round(q.aiConfidence)}% match
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Hover Actions */}
                                                <div
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center opacity-0 group-hover:opacity-100 transition-all bg-gradient-to-l from-white via-white to-transparent pl-4"
                                                    onClick={(e) => e.stopPropagation()} /* Prevent row selection when clicking buttons */
                                                >
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-slate-600" onClick={() => handleMoveQuestionUp(q.id)} title="Move Up">
                                                        <ChevronRight className="h-3.5 w-3.5 -rotate-90" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-slate-600" onClick={() => handleMoveQuestionDown(q.id)} title="Move Down">
                                                        <ChevronRight className="h-3.5 w-3.5 rotate-90" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-500 hover:bg-red-50 ml-0.5" onClick={() => handleRemoveQuestion(q.id)} title="Delete Question">
                                                        <svg width="12" height="12" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-3 w-3"><path d="M5.5 1C5.22386 1 5 1.22386 5 1.5C5 1.77614 5.22386 2 5.5 2H9.5C9.77614 2 10 1.77614 10 1.5C10 1.22386 9.77614 1 9.5 1H5.5ZM3 3.5C3 3.22386 3.22386 3 3.5 3H11.5C11.7761 3 12 3.22386 12 3.5C12 3.77614 11.7761 4 11.5 4H11V12C11 12.5523 10.5523 13 10 13H5C4.44772 13 4 12.5523 4 12V4H3.5C3.22386 4 3 3.77614 3 3.5ZM5 4H10V12H5V4Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
                                                    </Button>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </ScrollArea>
                            <div className="p-3 border-t bg-white">
                                <Button variant="outline" size="sm" onClick={handleAddQuestion} className="w-full border-dashed border-slate-300 text-slate-500 hover:text-slate-800 hover:border-slate-400 bg-transparent">
                                    <Plus className="h-3.5 w-3.5 mr-2" />
                                    Add Question
                                </Button>
                            </div>
                            {/* Stats Footer */}
                            <div className="p-3 border-t bg-slate-100/50 flex justify-between items-center text-xs text-slate-500 font-medium">
                                <span>{filteredQuestions.length} Questions</span>
                                <span>{questions.filter((q: any) => q.masterFieldNo || q.masterQuestionGroupId || q.customFieldDefinitionId).length} Mapped</span>
                            </div>
                        </div>

                        {/* RIGHT: EDITOR */}
                        <div className="flex-1 flex flex-col bg-slate-50/30">
                            {selectedQuestion ? (
                                <div className="flex-1 overflow-y-auto p-8" >
                                    <div className="max-w-2xl mx-auto space-y-8">
                                        <div className="space-y-4">
                                            <Badge variant="outline" className="bg-white text-slate-500 border-slate-200 shadow-sm">
                                                Question #{selectedQuestion.order}
                                            </Badge>
                                            <div className="space-y-3">
                                                <Label className="text-slate-500 uppercase text-xs font-bold tracking-wider">Question Text</Label>
                                                <div className="p-6 bg-white rounded-xl border shadow-sm text-lg font-medium text-slate-900 leading-relaxed group relative pr-10">
                                                    <InlineTextEditor
                                                        value={selectedQuestion.text || ""}
                                                        onSave={(newText) => updateQuestion(selectedQuestion.id, { text: newText })}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <LayoutList className="h-5 w-5 text-indigo-600" />
                                                <h3 className="font-semibold text-slate-900">Map to Data Field</h3>
                                            </div>

                                            {/* UNIFIED FIELD SELECTOR */}
                                            <div className="bg-white rounded-xl border shadow-sm p-1">
                                                <FieldSelector
                                                    value={
                                                        selectedQuestion.masterFieldNo ? `master:${selectedQuestion.masterFieldNo}` :
                                                            selectedQuestion.masterQuestionGroupId ? `group:${selectedQuestion.masterQuestionGroupId}` :
                                                                selectedQuestion.customFieldDefinitionId ? `custom:${selectedQuestion.customFieldDefinitionId}` :
                                                                    null
                                                    }
                                                    onSelect={(val, type, label) => {
                                                        if (type === 'create') {
                                                            handleCreateCustomField(label!);
                                                        } else if (type === 'master') {
                                                            updateQuestion(selectedQuestion.id, { masterFieldNo: parseInt(val) });
                                                        } else if (type === 'group') {
                                                            updateQuestion(selectedQuestion.id, { masterQuestionGroupId: val });
                                                        } else if (type === 'custom') {
                                                            updateQuestion(selectedQuestion.id, { customFieldDefinitionId: val });
                                                        } else if (type === 'clear') {
                                                            updateQuestion(selectedQuestion.id, { masterFieldNo: null, masterQuestionGroupId: null, customFieldDefinitionId: null });
                                                        }
                                                    }}
                                                    customFields={customFields}
                                                />
                                            </div>

                                            {/* Mapping Details */}
                                            {/* ... existing details ... */}
                                            {selectedQuestion.masterFieldNo && (
                                                <div className="bg-green-50 border border-green-100 rounded-lg p-4 flex gap-3 items-start">
                                                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                                                    <div>
                                                        <h4 className="text-sm font-semibold text-green-900">Mapped to Standard Field</h4>
                                                        <p className="text-sm text-green-700 mt-1">
                                                            Values will be synced with the Master Data profile.
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Configuration Details */}
                                        <div className="space-y-4 pt-4 border-t border-slate-100">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Settings className="h-5 w-5 text-indigo-600" />
                                                <h3 className="font-semibold text-slate-900">Question Settings</h3>
                                            </div>

                                            <div className="bg-white rounded-xl border shadow-sm p-5 flex items-center justify-between">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <Paperclip className="h-4 w-4 text-slate-500" />
                                                        <span className="font-medium text-slate-900">Allow File Attachments</span>
                                                    </div>
                                                    <p className="text-sm text-slate-500 max-w-sm">
                                                        Enable suppliers to upload supporting documents alongside their text answer.
                                                    </p>
                                                </div>
                                                <Switch
                                                    checked={selectedQuestion.allowAttachments || false}
                                                    onCheckedChange={(checked) => updateQuestion(selectedQuestion.id, { allowAttachments: checked })}
                                                />
                                            </div>

                                            <div className="bg-white rounded-xl border shadow-sm p-5 flex flex-col gap-3">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium text-slate-900">Compact Label (Kanban Display)</span>
                                                    </div>
                                                    <p className="text-sm text-slate-500">
                                                        A short description of the question (max ~30 chars) used for the kanban card headers.
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2 max-w-md">
                                                    <Input
                                                        value={selectedQuestion.compactText || ""}
                                                        onChange={(e) => updateQuestion(selectedQuestion.id, { compactText: e.target.value })}
                                                        placeholder="E.g. Code of Conduct Policy"
                                                        className="flex-1"
                                                    />
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        className="shrink-0"
                                                        onClick={() => handleGenerateCompactText(selectedQuestion.id, selectedQuestion.text)}
                                                        disabled={generatingCompact[selectedQuestion.id] || !selectedQuestion.text}
                                                        title="Auto-generate with AI"
                                                    >
                                                        {generatingCompact[selectedQuestion.id] ? (
                                                            <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                                                        ) : (
                                                            <RefreshCw className="h-4 w-4 text-slate-500" />
                                                        )}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>

                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 flex items-center justify-center text-slate-400 flex-col gap-4">
                                    <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                                        <Search className="h-8 w-8 opacity-20" />
                                    </div>
                                    <p>Select a question to edit mappings</p>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );

    // SUB-COMPONENT: UNIFIED FIELD SELECTOR
    function FieldSelector({ value, onSelect, customFields, compact = false }: {
        value: string | null;
        onSelect: (val: string, type: 'master' | 'group' | 'custom' | 'create' | 'clear', label?: string) => void;
        customFields: any[];
        compact?: boolean;
    }) {
        const [open, setOpen] = useState(false);
        const [search, setSearch] = useState("");

        // Flatten Options
        const masterOptions = useMemo(() => masterFields.map((f: any) => ({
            value: `master:${f.fieldNo.toString()}`,
            label: f.fieldName,
            type: 'master',
            meta: `Standard Field ${f.fieldNo}`,
            description: f.notes
        })), [masterFields]);

        const groupOptions = useMemo(() => masterGroups.map((g: any) => ({
            value: `group:${g.key}`,
            label: g.fieldName || g.key,
            type: 'group',
            meta: 'Composite Field',
            description: g.notes
        })), [masterGroups]);

        const customOptions = useMemo(() => customFields.map((f: any) => ({
            value: `custom:${f.id}`,
            label: f.label,
            type: 'custom',
            meta: `Custom Field (${f.dataType})`,
            description: f.description
        })), [customFields]);

        const allOptions = [...groupOptions, ...masterOptions, ...customOptions];
        const selectedOption = allOptions.find((o: any) => o.value === value);

        return (
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="ghost"
                        role="combobox"
                        aria-expanded={open}
                        className={cn(
                            "w-full justify-between font-normal text-left hover:bg-slate-50",
                            compact ? "h-8 px-2 py-0" : "h-auto py-3 px-4"
                        )}
                    >
                        {selectedOption ? (
                            <div className={cn("flex items-start gap-0.5 min-w-0 flex-1", compact ? "flex-row items-center gap-2" : "flex-col")}>
                                <span className={cn("font-medium text-slate-900 truncate", compact ? "text-xs" : "")}>{selectedOption.label}</span>
                                {!compact && <span className="text-xs text-slate-400">{selectedOption.meta}</span>}
                            </div>
                        ) : (
                            <span className="text-slate-400 truncate">Select field...</span>
                        )}
                        <ChevronRight className="ml-2 h-4 w-4 shrink-0 opacity-50 rotate-90" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0 bg-white shadow-xl z-50 max-h-[400px]" align="start">
                    <Command shouldFilter={false} className="max-h-[400px]">
                        <CommandInput
                            placeholder="Search fields..."
                            value={search}
                            onValueChange={setSearch}
                        />
                        <CommandList className="max-h-[360px] overflow-y-auto">
                            <CommandEmpty className="py-6 text-center text-sm text-slate-500">
                                <div className="mb-2">No matching fields found.</div>
                                {search && (
                                    <Button size="sm" variant="secondary" onClick={() => {
                                        onSelect(search, 'create', search);
                                        setOpen(false);
                                        setSearch("");
                                    }}>
                                        <Plus className="h-3 w-3 mr-2" />
                                        Create &quot;{search}&quot; as new field
                                    </Button>
                                )}
                            </CommandEmpty>

                            {value && (
                                <CommandGroup>
                                    <CommandItem onSelect={() => { onSelect("", 'clear'); setOpen(false); }}>
                                        <div className="flex items-center gap-2 text-slate-500">
                                            <span className="w-4 h-4 flex items-center justify-center border rounded-full text-[10px]">✕</span>
                                            Clear Selection
                                        </div>
                                    </CommandItem>
                                </CommandGroup>
                            )}

                            {/* Filter Logic since we disabled default cmdk filtering for custom create logic */}
                            {(() => {
                                const filtered = allOptions.filter((o: any) =>
                                    o.label.toLowerCase().includes(search.toLowerCase()) ||
                                    o.meta.toLowerCase().includes(search.toLowerCase()) ||
                                    (o.description && o.description.toLowerCase().includes(search.toLowerCase()))
                                );
                                if (filtered.length === 0) return null;

                                return (
                                    <>
                                        <CommandGroup heading="Field Groups (Recommended)">
                                            {filtered.filter((o: any) => o.type === 'group').map((option: any) => (
                                                <CommandItem
                                                    key={option.value}
                                                    value={option.label}
                                                    onSelect={() => {
                                                        onSelect(option.value.split(':')[1], 'group');
                                                        setOpen(false);
                                                    }}
                                                >
                                                    <Check className={cn("mr-2 h-4 w-4", value === option.value ? "opacity-100" : "opacity-0")} />
                                                    <div className="flex flex-col">
                                                        <span>{option.label}</span>
                                                        <span className="text-xs text-slate-400">{option.meta}</span>
                                                    </div>
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                        <CommandSeparator />
                                        <CommandGroup heading="Standard Fields">
                                            {filtered.filter((o: any) => o.type === 'master').map((option: any) => (
                                                <CommandItem
                                                    key={option.value}
                                                    value={option.label} // Use label for cmdk internal keying
                                                    onSelect={() => {
                                                        onSelect(option.value.split(':')[1], 'master');
                                                        setOpen(false);
                                                    }}
                                                >
                                                    <Check className={cn("mr-2 h-4 w-4", value === option.value ? "opacity-100" : "opacity-0")} />
                                                    <div className="flex flex-col">
                                                        <span>{option.label}</span>
                                                        <span className="text-xs text-slate-400">{option.meta}</span>
                                                    </div>
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                        <CommandSeparator />
                                        <CommandGroup heading="Custom Fields">
                                            {filtered.filter((o: any) => o.type === 'custom').map((option: any) => (
                                                <CommandItem
                                                    key={option.value}
                                                    value={option.label}
                                                    onSelect={() => {
                                                        onSelect(option.value.split(':')[1], 'custom');
                                                        setOpen(false);
                                                    }}
                                                >
                                                    <Check className={cn("mr-2 h-4 w-4", value === option.value ? "opacity-100" : "opacity-0")} />
                                                    <div className="flex flex-col">
                                                        <span>{option.label}</span>
                                                        <span className="text-xs text-slate-400">{option.meta}</span>
                                                    </div>
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </>
                                );
                            })()}
                        </CommandList>
                    </Command >
                </PopoverContent >
            </Popover >
        );
    }
}

