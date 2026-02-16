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
import { Loader2, Save, Sparkles, AlertCircle, CheckCircle2, ChevronRight, Search, LayoutList, Check, Plus, Settings } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

// Server Actions
import { saveQuestionnaireChanges, analyzeQuestionnaire, getOrgCustomFields, getQuestionnaireById, createCustomFieldDefinition } from "@/actions/questionnaire";
import { FIELD_DEFINITIONS } from "@/domain/kyc/FieldDefinitions";
import { FIELD_GROUPS } from "@/domain/kyc/FieldGroups";

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

    // UX State
    const [confidenceThreshold, setConfidenceThreshold] = useState(70); // Default 70%

    // Custom Fields
    const [customFields, setCustomFields] = useState<any[]>([]);

    useEffect(() => {
        loadData();
    }, [questionnaireId]);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = (await getQuestionnaireById(questionnaireId)) as any;
            if (data) {
                setQuestionnaire(data);
                // Sort by order
                const sorted = [...(data.questions || [])].sort((a: any, b: any) => a.order - b.order);
                setQuestions(sorted);
                if (sorted.length > 0) setSelectedQuestionId(sorted[0].id);

                // Fetch custom fields
                if (data.fiOrgId) {
                    loadCustomFields(data.fiOrgId);
                }
            }
        } catch (e) {
            toast.error("Failed to load questionnaire");
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

    const handleSave = async () => {
        setSaving(true);
        try {
            if (!questionnaire) return;

            // Map back to format expected by backend
            const itemsToSave = questions.map(q => ({
                type: "question",
                text: q.text,
                originalText: q.originalText || q.text,
                compactText: q.compactText,
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
                    const match = newQuestions.find(q => q.text === sug.text || q.originalText === sug.text);

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
                            const isGroup = FIELD_GROUPS[sug.suggestedKey];
                            const isField = FIELD_DEFINITIONS[parseInt(sug.suggestedKey)];

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
        setQuestions(prev => prev.map(q => {
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
                setCustomFields(prev => [...prev, newField].sort((a, b) => a.label.localeCompare(b.label)));

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

    const selectedQuestion = questions.find(q => q.id === selectedQuestionId);

    const filteredQuestions = questions.filter(q =>
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

    return (
        <div className="flex flex-col h-[calc(100vh-220px)] border rounded-xl overflow-hidden bg-white shadow-sm">
            {/* HEADER */}
            <div className="flex items-center justify-between p-4 border-b bg-slate-50/50">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 text-slate-500">
                        ← Back
                    </Button>
                    <div className="h-4 w-px bg-slate-200" />
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-700">Auto-Map Threshold:</span>
                        <div className="flex items-center gap-2">
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={confidenceThreshold}
                                onChange={(e) => setConfidenceThreshold(parseInt(e.target.value))}
                                className="w-32 accent-indigo-600 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                            />
                            <Badge variant="outline" className={cn(
                                "w-12 justify-center",
                                confidenceThreshold >= 80 ? "bg-green-50 text-green-700 border-green-200" :
                                    confidenceThreshold >= 50 ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                                        "bg-slate-50 text-slate-600"
                            )}>
                                {confidenceThreshold}%
                            </Badge>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleAutoMap} disabled={analyzing} className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                        {analyzing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                        Run Auto-Map
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={saving} className="bg-slate-900 text-white hover:bg-slate-800">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                        Save Changes
                    </Button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* LEFT: LIST */}
                <div className="w-1/3 border-r bg-slate-50 flex flex-col min-w-[320px]">
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
                            {filteredQuestions.map(q => {
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
                                        <div className="flex-1 min-w-0">
                                            <p className={cn("line-clamp-2 leading-relaxed", selectedQuestionId === q.id ? "text-slate-900 font-medium" : "text-slate-600")}>
                                                {q.text}
                                            </p>
                                            {isMapped && (
                                                <div className="mt-2 flex items-center gap-2">
                                                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-normal bg-green-50 text-green-700 border-green-100 gap-1">
                                                        <CheckCircle2 className="h-3 w-3" />
                                                        Mapped
                                                    </Badge>
                                                    {q.aiConfidence && (
                                                        <span className={cn(
                                                            "text-[10px]",
                                                            q.aiConfidence >= 80 ? "text-green-600" : "text-yellow-600"
                                                        )}>
                                                            {Math.round(q.aiConfidence)}% match
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </ScrollArea>
                    <div className="p-3 border-t bg-slate-100/50 flex justify-between items-center text-xs text-slate-500 font-medium">
                        <span>{filteredQuestions.length} Questions</span>
                        <span>{questions.filter(q => q.masterFieldNo || q.masterQuestionGroupId || q.customFieldDefinitionId).length} Mapped</span>
                    </div>
                </div>

                {/* RIGHT: EDITOR */}
                <div className="flex-1 flex flex-col bg-slate-50/30">
                    {selectedQuestion ? (
                        <div className="flex-1 overflow-y-auto p-8">
                            <div className="max-w-2xl mx-auto space-y-8">
                                <div className="space-y-4">
                                    <Badge variant="outline" className="bg-white text-slate-500 border-slate-200 shadow-sm">
                                        Question #{selectedQuestion.order}
                                    </Badge>
                                    <div className="space-y-3">
                                        <Label className="text-slate-500 uppercase text-xs font-bold tracking-wider">Question Text</Label>
                                        <div className="p-6 bg-white rounded-xl border shadow-sm text-lg font-medium text-slate-900 leading-relaxed">
                                            {selectedQuestion.text}
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

                                    {/* MAPPING DETAILS */}
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
                                    {selectedQuestion.masterQuestionGroupId && (
                                        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 flex gap-3 items-start">
                                            <LayoutList className="h-5 w-5 text-indigo-600 mt-0.5" />
                                            <div>
                                                <h4 className="text-sm font-semibold text-indigo-900">Mapped to Field Group</h4>
                                                <p className="text-sm text-indigo-700 mt-1">
                                                    Composite data (e.g. Address) will be extracted and split into multiple fields.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                    {selectedQuestion.customFieldDefinitionId && (
                                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex gap-3 items-start">
                                            <Settings className="h-5 w-5 text-blue-600 mt-0.5" />
                                            <div>
                                                <h4 className="text-sm font-semibold text-blue-900">Mapped to Custom Field</h4>
                                                <p className="text-sm text-blue-700 mt-1">
                                                    Values are stored specific to this Organization.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                    {selectedQuestion.masterFieldNo && standingData && standingData[selectedQuestion.masterFieldNo]?.value && (
                                        <div className="bg-slate-100 border border-slate-200 rounded-lg p-4 flex gap-3 items-start mt-4">
                                            <CheckCircle2 className="h-5 w-5 text-slate-500 mt-0.5" />
                                            <div className="flex-1">
                                                <h4 className="text-sm font-semibold text-slate-900">Current Value (Master Data)</h4>
                                                <div className="bg-white rounded border border-slate-200 p-2 mt-2 font-mono text-sm text-slate-700">
                                                    {String(standingData[selectedQuestion.masterFieldNo].value)}
                                                </div>
                                                <p className="text-xs text-slate-500 mt-2">
                                                    Mapping to this field will compare the questionnaire answer against this value.
                                                </p>
                                            </div>
                                        </div>
                                    )}
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
            </div>
        </div>
    );
}

// SUB-COMPONENT: UNIFIED FIELD SELECTOR
function FieldSelector({ value, onSelect, customFields }: {
    value: string | null,
    onSelect: (val: string, type: 'master' | 'group' | 'custom' | 'create' | 'clear', label?: string) => void,
    customFields: any[]
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");

    // Flatten Options
    const masterOptions = useMemo(() => Object.values(FIELD_DEFINITIONS).map(f => ({
        value: `master:${f.fieldNo}`,
        label: f.fieldName,
        type: 'master',
        meta: `Standard Field ${f.fieldNo}`
    })), []);

    const groupOptions = useMemo(() => Object.values(FIELD_GROUPS).map(g => ({
        value: `group:${g.id}`,
        label: g.label,
        type: 'group',
        meta: 'Composite Field'
    })), []);

    const customOptions = useMemo(() => customFields.map(f => ({
        value: `custom:${f.id}`,
        label: f.label,
        type: 'custom',
        meta: `Custom Field (${f.dataType})`
    })), [customFields]);

    const allOptions = [...groupOptions, ...masterOptions, ...customOptions];
    const selectedOption = allOptions.find(o => o.value === value);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between h-auto py-3 px-4 font-normal text-left hover:bg-slate-50"
                >
                    {selectedOption ? (
                        <div className="flex flex-col items-start gap-0.5">
                            <span className="font-medium text-slate-900">{selectedOption.label}</span>
                            <span className="text-xs text-slate-400">{selectedOption.meta}</span>
                        </div>
                    ) : (
                        <span className="text-slate-400">Select or create a field...</span>
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
                                    Create "{search}" as new field
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
                            const filtered = allOptions.filter(o => o.label.toLowerCase().includes(search.toLowerCase()) || o.meta.toLowerCase().includes(search.toLowerCase()));
                            if (filtered.length === 0) return null;

                            return (
                                <>
                                    <CommandGroup heading="Field Groups (Recommended)">
                                        {filtered.filter(o => o.type === 'group').map(option => (
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
                                        {filtered.filter(o => o.type === 'master').map(option => (
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
                                        {filtered.filter(o => o.type === 'custom').map(option => (
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
                </Command>
            </PopoverContent>
        </Popover>
    );
}

