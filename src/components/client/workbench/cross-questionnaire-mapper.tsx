"use client";

import { useState, useMemo, useTransition } from "react";
import { Workbench4Data, mapQuestionToField, getAIFieldNameSuggestion } from "@/actions/kyc-workbench";
import { ConsoleQuestion } from "@/actions/kyc-query";
import { createCustomFieldDefinition } from "@/actions/questionnaire";
import { renameCustomField } from "@/actions/master-data-governance";
import { approveQuestionMapping, shareQuestion, releaseQuestion } from "@/actions/kanban-actions";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { SuperFieldSelector } from "./super-field-selector";
import {
    Search,
    Filter,
    Building2,
    FileText,
    Link as LinkIcon,
    Unlink,
    Plus,
    CheckCircle2,
    AlertCircle,
    MoreHorizontal,
    Pencil,
    PanelLeftOpen,
    Check,
    X,
    Sparkles,
    Loader2,
    Lock,
    Share2
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { FieldDetailPanel } from "../inspection/field-detail-panel";

interface Props {
    leId: string;
    initialData: Workbench4Data;
}

export function CrossQuestionnaireMapper({ leId, initialData }: Props) {
    const [data, setData] = useState<Workbench4Data>(initialData);
    const [search, setSearch] = useState("");
    const [relFilter, setRelFilter] = useState<string>("ALL");
    const [qFilter, setQFilter] = useState<string>("ALL");
    const [mappingTypeFilter, setMappingTypeFilter] = useState<string>("ALL"); // ALL, MAPPED, UNMAPPED
    const [catFilter, setCatFilter] = useState<string>("ALL");
    const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());

    const [isPending, startTransition] = useTransition();
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [newFieldName, setNewFieldName] = useState("");
    const [newFieldType, setNewFieldType] = useState("Text");
    const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
    const [isAISuggesting, setIsAISuggesting] = useState(false);
    const [aiReasoning, setAiReasoning] = useState<string | null>(null);

    // Derive the active question text for the create dialog
    const activeQuestionText = activeQuestionId
        ? data.questions.find((q: any) => q.id === activeQuestionId)?.text || ""
        : "";

    // Inspection Drawer State
    const [selectedInspectionField, setSelectedInspectionField] = useState<{ fieldNo: number; name: string; customFieldId?: string } | null>(null);

    // Categories for filtering (derived from questions that are mapped)
    const availableCategories = useMemo(() => {
        const cats = new Set<string>();
        data.questions.forEach((q: any) => {
            if (q.masterFieldCategory) cats.add(q.masterFieldCategory);
        });
        return Array.from(cats).sort();
    }, [data.questions]);

    // 1. Filtering Logic
    const filteredQuestions = useMemo(() => {
        return data.questions.filter((q: any) => {
            const matchesSearch = q.text.toLowerCase().includes(search.toLowerCase());
            const matchesRel = relFilter === "ALL" || (q.engagementOrgName || "Unknown") === relFilter;
            const matchesQ = qFilter === "ALL" || q.questionnaireName === qFilter;

            const isMapped = !!(q.masterFieldNo || q.masterQuestionGroupId || (q as any).customFieldDefinitionId);
            const matchesMapping = mappingTypeFilter === "ALL" ||
                (mappingTypeFilter === "MAPPED" && isMapped) ||
                (mappingTypeFilter === "UNMAPPED" && !isMapped);

            const isPinned = pinnedIds.has(q.id);

            const matchesCat = catFilter === "ALL" || q.masterFieldCategory === catFilter;

            return matchesSearch && matchesRel && matchesQ && (matchesMapping || isPinned) && matchesCat;
        });
    }, [data.questions, search, relFilter, qFilter, mappingTypeFilter, pinnedIds, catFilter]);

    // 2. Handlers
    const clearPinned = () => {
        if (pinnedIds.size > 0) setPinnedIds(new Set());
    };

    const handleFilterChange = (setter: (v: string) => void) => (val: string) => {
        setter(val);
        clearPinned();
    };

    const handleMap = async (questionId: string, val: string) => {
        if (val === "CREATE_NEW") {
            setActiveQuestionId(questionId);
            setIsCreateDialogOpen(true);
            return;
        }

        const question = data.questions.find((q: any) => q.id === questionId);
        if (!question) return;

        startTransition(async () => {
            let mapping: { fieldNo?: number | null; customFieldId?: string | null; groupId?: string | null } = {};

            if (val === "UNMAP") {
                mapping = { fieldNo: null, customFieldId: null, groupId: null };
            } else if (val.startsWith("CUSTOM_")) {
                mapping = { customFieldId: val.replace("CUSTOM_", "") };
            } else if (val.startsWith("GROUP_")) {
                mapping = { groupId: val.replace("GROUP_", "") };
            } else {
                mapping = { fieldNo: parseInt(val) };
            }

            const res = await mapQuestionToField(leId, questionId, mapping);
            if (res.success) {
                toast.success("Mapping updated");
                // Local state update for snappy UI
                setData(prev => ({
                    ...prev,
                    questions: prev.questions.map((q: any) =>
                        q.id === questionId
                            ? {
                                ...q,
                                masterFieldNo: mapping.fieldNo ?? null,
                                masterQuestionGroupId: mapping.groupId ?? null,
                                customFieldDefinitionId: mapping.customFieldId ?? null,
                                masterDataValue: (res as any).newValue,
                                masterDataSource: (res as any).newSource,
                                masterDataUpdatedAt: (res as any).newUpdatedAt,
                                status: 'DRAFT' as any // Safety Reset
                            } as any
                            : q
                    )
                }));
                // Pin the item so it doesn't vanish if we are in UNMAPPED filter
                setPinnedIds(prev => new Set(prev).add(questionId));
            } else {
                toast.error(res.error || "Failed to update mapping");
            }
        });
    };

    const handleFieldUpdate = (fieldNo: number, customFieldId: string | undefined, newValue: any, newSource: string, newUpdatedAt: Date) => {
        setData(prev => ({
            ...prev,
            questions: prev.questions.map((q: any) => {
                const isMatch = customFieldId
                    ? (q as any).customFieldDefinitionId === customFieldId
                    : q.masterFieldNo === fieldNo;

                if (isMatch) {
                    return {
                        ...q,
                        masterDataValue: newValue,
                        masterDataSource: newSource,
                        masterDataUpdatedAt: newUpdatedAt
                    };
                }
                return q;
            })
        }));
    };

    const handleCreateCustomField = async () => {
        if (!newFieldName) return;

        startTransition(async () => {
            if (!data.ownerOrgId) {
                toast.error("Cannot create field: Owner organization not found");
                return;
            }

            const res = await createCustomFieldDefinition(data.ownerOrgId, newFieldName, newFieldType);
            if (res.success && res.data) {
                toast.success("New field created");
                setData(prev => ({
                    ...prev,
                    customFields: [...prev.customFields, { id: res.data.id, label: res.data.label }].sort((a: any, b: any) => a.label.localeCompare(b.label))
                }));

                if (activeQuestionId) {
                    // Update: mapQuestionToField is called inside handleMap
                    await handleMap(activeQuestionId, `CUSTOM_${res.data.id}`);
                }
                setIsCreateDialogOpen(false);
                setNewFieldName("");
                setActiveQuestionId(null);
            } else {
                toast.error("Failed to create field");
            }
        });
    };

    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="relative flex-1 min-w-[300px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Search questions..."
                        className="pl-9 bg-slate-50/50 border-slate-200"
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            clearPinned();
                        }}
                    />
                </div>

                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-slate-500 mr-1" />

                    <Select value={relFilter} onValueChange={handleFilterChange(setRelFilter)}>
                        <SelectTrigger className="w-[180px] bg-slate-50/50">
                            <SelectValue placeholder="Relationship" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Relationships</SelectItem>
                            {data.relationships.map((r: any) => (
                                <SelectItem key={r} value={r}>{r}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={qFilter} onValueChange={handleFilterChange(setQFilter)}>
                        <SelectTrigger className="w-[200px] bg-slate-50/50">
                            <SelectValue placeholder="Questionnaire" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Questionnaires</SelectItem>
                            {data.questionnaires.map((q: any) => (
                                <SelectItem key={q} value={q}>{q}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={catFilter} onValueChange={handleFilterChange(setCatFilter)}>
                        <SelectTrigger className="w-[160px] bg-slate-50/50">
                            <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Categories</SelectItem>
                            {availableCategories.map((cat: any) => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={mappingTypeFilter} onValueChange={handleFilterChange(setMappingTypeFilter)}>
                        <SelectTrigger className="w-[150px] bg-slate-50/50">
                            <SelectValue placeholder="Mapping" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Statuses</SelectItem>
                            <SelectItem value="MAPPED">Mapped</SelectItem>
                            <SelectItem value="UNMAPPED">Unmapped</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Results Counters */}
            <div className="flex items-center justify-between px-2">
                <div className="text-sm text-slate-500">
                    Showing <span className="font-semibold text-slate-900">{filteredQuestions.length}</span> questions
                    {mappingTypeFilter !== "ALL" && ` (${mappingTypeFilter.toLowerCase()})`}
                </div>
            </div>

            {/* Question List */}
            <div className="space-y-3">
                {filteredQuestions.map((q: any) => (
                    <QuestionCard
                        key={q.id}
                        question={q}
                        leId={leId}
                        masterFields={data.masterFields}
                        masterGroups={data.masterGroups}
                        customFields={data.customFields}
                        onMap={(val) => handleMap(q.id, val)}
                        onInspect={(fieldNo, name, customFieldId) => {
                            setSelectedInspectionField({ fieldNo, name, customFieldId });
                        }}
                        onInlineEdit={(val, src, date) => {
                            handleFieldUpdate(
                                q.masterFieldNo || 0,
                                (q as any).customFieldDefinitionId,
                                val, src, date
                            );
                        }}
                        onStatusChange={(newStatus) => {
                            setData(prev => ({
                                ...prev,
                                questions: prev.questions.map((quest: any) =>
                                    quest.id === q.id ? { ...quest, status: newStatus } as any : quest
                                )
                            }));
                        }}
                        onRenameCustomField={async (cfId, newLabel) => {
                            const res = await renameCustomField(cfId, newLabel);
                            if (res.success) {
                                setData(prev => ({
                                    ...prev,
                                    customFields: prev.customFields.map((f: any) =>
                                        f.id === cfId ? { ...f, label: newLabel } : f
                                    )
                                }));
                            }
                            return res;
                        }}
                        disabled={isPending}
                        isPinned={pinnedIds.has(q.id)}
                    />
                ))}

                {filteredQuestions.length === 0 && (
                    <div className="py-20 text-center bg-white rounded-xl border border-dashed border-slate-300">
                        <AlertCircle className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                        <h3 className="text-lg font-medium text-slate-900">No questions found</h3>
                        <p className="text-slate-500 mt-1">Try adjusting your filters or search terms.</p>
                    </div>
                )}
            </div>

            <FieldDetailPanel
                open={!!selectedInspectionField}
                onOpenChange={(open) => !open && setSelectedInspectionField(null)}
                legalEntityId={leId}
                fieldNo={selectedInspectionField?.fieldNo || 0}
                fieldName={selectedInspectionField?.name || ""}
                customFieldId={selectedInspectionField?.customFieldId}
                onUpdate={(val, src, date) => {
                    handleFieldUpdate(
                        selectedInspectionField?.fieldNo || 0,
                        selectedInspectionField?.customFieldId,
                        val,
                        src,
                        date
                    );
                }}
            />

            {/* Create Custom Field Dialog */}
            <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
                setIsCreateDialogOpen(open);
                if (!open) { setAiReasoning(null); setIsAISuggesting(false); }
            }}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Create New Master Data Field</DialogTitle>
                        <DialogDescription>
                            Define a new field to capture this information across all future requests.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Question Context */}
                    {activeQuestionText && (
                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Original Question</div>
                            <p className="text-sm text-slate-700 leading-snug">{activeQuestionText}</p>
                        </div>
                    )}

                    <div className="grid gap-4 py-2">
                        <div className="grid gap-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="name">Field Name</Label>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className={cn(
                                        "h-7 gap-1.5 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50",
                                        isAISuggesting ? "animate-pulse" : ""
                                    )}
                                    onClick={async () => {
                                        if (!activeQuestionText) return;
                                        setIsAISuggesting(true);
                                        setAiReasoning(null);
                                        try {
                                            const res = await getAIFieldNameSuggestion(activeQuestionText);
                                            if (res.success && 'suggestion' in res) {
                                                setNewFieldName(res.suggestion);
                                                if ('dataType' in res && res.dataType) setNewFieldType(res.dataType);
                                                if ('reasoning' in res && res.reasoning) setAiReasoning(res.reasoning);
                                                toast.success("AI suggestion applied");
                                            } else {
                                                toast.error("AI suggestion failed");
                                            }
                                        } catch {
                                            toast.error("AI suggestion failed");
                                        } finally {
                                            setIsAISuggesting(false);
                                        }
                                    }}
                                    disabled={isAISuggesting || !activeQuestionText}
                                >
                                    {isAISuggesting
                                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        : <Sparkles className="h-3.5 w-3.5" />
                                    }
                                    <span className="text-xs font-semibold">AI Suggest</span>
                                </Button>
                            </div>
                            <Input
                                id="name"
                                placeholder="e.g. Board Diversity Policy"
                                value={newFieldName}
                                onChange={(e) => setNewFieldName(e.target.value)}
                            />
                            {aiReasoning && (
                                <p className="text-xs text-slate-500 italic leading-snug">{aiReasoning}</p>
                            )}
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="type">Data Type</Label>
                            <Select value={newFieldType} onValueChange={setNewFieldType}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Text">Text (Paragraphs)</SelectItem>
                                    <SelectItem value="Boolean">Boolean (Yes/No)</SelectItem>
                                    <SelectItem value="Date">Date</SelectItem>
                                    <SelectItem value="Number">Number</SelectItem>
                                    <SelectItem value="Document">Document Upload</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
                        <Button
                            onClick={handleCreateCustomField}
                            disabled={!newFieldName || isPending}
                            className="bg-indigo-600 hover:bg-indigo-700"
                        >
                            {isPending ? "Creating..." : "Create & Map"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function QuestionCard({
    question,
    leId,
    masterFields,
    masterGroups,
    customFields,
    onMap,
    onInspect,
    onInlineEdit,
    onRenameCustomField,
    onStatusChange,
    disabled,
    isPinned
}: {
    question: ConsoleQuestion;
    leId: string;
    masterFields: Array<{ fieldNo: number; label: string }>;
    masterGroups: Array<{ key: string; label: string }>;
    customFields: Array<{ id: string; label: string }>;
    onMap: (val: string) => void;
    onInspect: (fieldNo: number, name: string, customFieldId?: string) => void;
    onInlineEdit: (newValue: any, newSource: string, newUpdatedAt: Date) => void;
    onRenameCustomField: (customFieldId: string, newLabel: string) => Promise<{ success: boolean; error?: string }>;
    onStatusChange: (newStatus: string) => void;
    disabled?: boolean;
    isPinned?: boolean;
}) {
    const isMapped = !!(question.masterFieldNo || question.masterQuestionGroupId || (question as any).customFieldDefinitionId);
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    // Inline rename for custom field label
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState("");
    const [isRenameSaving, setIsRenameSaving] = useState(false);
    const customFieldId = (question as any).customFieldDefinitionId as string | undefined;

    const [isActionPending, setIsActionPending] = useState(false);

    const handleApprove = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsActionPending(true);
        const res = await approveQuestionMapping(question.id);
        if (res.success) {
            toast.success("Mapping Approved");
            onStatusChange('APPROVED');
        } else {
            toast.error(res.error || "Approval failed");
        }
        setIsActionPending(false);
    };

    const handleShare = async (e: React.MouseEvent, isShared: boolean) => {
        e.stopPropagation();
        setIsActionPending(true);
        const res = await shareQuestion(question.id, isShared);
        if (res.success) {
            toast.success(isShared ? "Question Shared" : "Question Unshared");
            onStatusChange(isShared ? 'SHARED' : 'APPROVED');
        } else {
            toast.error(res.error || "Sharing failed");
        }
        setIsActionPending(false);
    };

    const handleRelease = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsActionPending(true);
        const res = await releaseQuestion(question.id);
        if (res.success) {
            toast.success("Question Released");
            onStatusChange('RELEASED');
        } else {
            toast.error(res.error || "Release failed");
        }
        setIsActionPending(false);
    };

    // Find current mapping label
    let currentMappingLabel = "Unmapped";

    if (question.masterFieldNo) {
        currentMappingLabel = masterFields.find((f: any) => f.fieldNo === question.masterFieldNo)?.label || `Field ${question.masterFieldNo}`;
    } else if (customFieldId) {
        currentMappingLabel = customFields.find((f: any) => f.id === customFieldId)?.label || "Custom Field";
    }

    const handleRenameStart = () => {
        setRenameValue(currentMappingLabel);
        setIsRenaming(true);
    };

    const handleRenameSave = async () => {
        if (!customFieldId || !renameValue.trim()) return;
        setIsRenameSaving(true);
        const res = await onRenameCustomField(customFieldId, renameValue.trim());
        if (res.success) {
            toast.success("Field renamed");
            setIsRenaming(false);
        } else {
            toast.error(res.error || "Rename failed");
        }
        setIsRenameSaving(false);
    };

    const handleStartEdit = () => {
        if (!isMapped) return;
        const currentVal = question.masterDataValue != null ? String(question.masterDataValue) : "";
        setEditValue(currentVal);
        setIsEditing(true);
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setEditValue("");
    };

    const handleSaveEdit = async () => {
        if (!isMapped || isSaving) return;
        setIsSaving(true);
        try {
            const { updateFieldManually } = await import("@/actions/kyc-manual-update");
            const fieldNo = question.masterFieldNo || 0;
            const res = await updateFieldManually(leId, fieldNo, editValue, "Inline edit");
            if (res.success) {
                onInlineEdit(editValue, "USER_INPUT", new Date());
                toast.success("Value updated");
            } else {
                toast.error(res.message || "Update failed");
            }
        } catch (err) {
            toast.error("Update failed");
        } finally {
            setIsSaving(false);
            setIsEditing(false);
        }
    };

    return (
        <Card className={cn(
            "group transition-all shadow-sm overflow-hidden",
            "border border-slate-200 hover:border-slate-300 hover:shadow-md",
            "focus-within:border-slate-300 focus-within:shadow-md",
            isPinned ? "!border-green-400 ring-2 ring-green-50 z-10 scale-[1.01]" : "",
            isMapped ? "bg-white" : "bg-slate-50/50 border-dashed"
        )}>
            <CardContent className="p-0">
                <div className="flex items-stretch min-h-[100px]">
                    {/* Left Side: Context */}
                    <div className={cn(
                        "w-[180px] border-r border-slate-100 p-4 space-y-2 shrink-0 transition-colors",
                        isPinned ? "bg-green-50/30" : ""
                    )}>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                            <Building2 className="h-3 w-3" />
                            {question.engagementOrgName || "Unknown Relationship"}
                        </div>
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                            <FileText className="h-3 w-3 text-slate-400" />
                            <span className="truncate" title={question.questionnaireName}>
                                {question.questionnaireName}
                            </span>
                        </div>
                        <div className="pt-1 flex items-center gap-2">
                            {isMapped ? (
                                <>
                                    <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-100 gap-1 px-1.5 py-0">
                                        <CheckCircle2 className="h-3 w-3" />
                                        {isPinned ? "Just Mapped" : "Mapped"}
                                    </Badge>
                                    {customFieldId && !isRenaming && (
                                        <button
                                            className="p-0.5 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                            onClick={(e) => { e.stopPropagation(); handleRenameStart(); }}
                                            title="Rename custom field"
                                        >
                                            <Pencil className="h-3 w-3" />
                                        </button>
                                    )}
                                </>
                            ) : (
                                <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-100 gap-1 px-1.5 py-0">
                                    <AlertCircle className="h-3 w-3" />
                                    Unmapped
                                </Badge>
                            )}
                        </div>
                        {isRenaming && (
                            <div className="pt-1 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                <Input
                                    value={renameValue}
                                    onChange={(e) => setRenameValue(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleRenameSave();
                                        if (e.key === 'Escape') setIsRenaming(false);
                                    }}
                                    className="h-7 text-xs flex-1"
                                    autoFocus
                                    disabled={isRenameSaving}
                                />
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-green-600" onClick={handleRenameSave} disabled={isRenameSaving}>
                                    {isRenameSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                </Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400" onClick={() => setIsRenaming(false)}>
                                    <X className="h-3 w-3" />
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Middle: Question Text */}
                    <div className="flex-1 p-4 flex flex-col justify-center space-y-3">
                        <div className="flex items-start gap-2">
                            <span className="text-slate-400 font-bold text-sm shrink-0 mt-0.5">Q:</span>
                            <h4 className="text-sm font-medium text-slate-900 leading-snug">
                                {question.text}
                            </h4>
                        </div>

                        <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-50">
                            <div className="flex items-start gap-2">
                                <span className="text-indigo-400 font-bold text-sm shrink-0 mt-0.5">A:</span>

                                {isEditing ? (
                                    <div className="flex items-center gap-2 w-full">
                                        <Input
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleSaveEdit();
                                                if (e.key === 'Escape') handleCancelEdit();
                                            }}
                                            className="text-sm h-9 flex-1"
                                            autoFocus
                                            disabled={isSaving}
                                            placeholder="Enter value..."
                                        />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-green-600 hover:bg-green-50 shrink-0"
                                            onClick={handleSaveEdit}
                                            disabled={isSaving}
                                        >
                                            <Check className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-slate-400 hover:bg-slate-100 shrink-0"
                                            onClick={handleCancelEdit}
                                            disabled={isSaving}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="text-sm text-slate-700 bg-slate-50/50 px-2 py-1.5 rounded border border-slate-100/50 w-full font-medium relative flex items-center">
                                        <span className="flex-1">
                                            {question.masterDataValue != null && question.masterDataValue !== '' ? (
                                                Array.isArray(question.masterDataValue) ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {question.masterDataValue.map((val: any, i: any) => (
                                                            <Badge key={i} variant="secondary" className="bg-white border-slate-200 text-slate-700 py-0 px-1.5 text-[11px]">
                                                                {String(val)}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                ) : typeof question.masterDataValue === 'object' ? (
                                                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                                                        {Object.entries(question.masterDataValue).map(([fNo, val]) => (
                                                            <div key={fNo} className="flex flex-col">
                                                                <span className="text-slate-400 font-bold uppercase tracking-tighter text-[9px]">Field {fNo}</span>
                                                                <span className="text-slate-700 font-semibold truncate">
                                                                    {Array.isArray(val) ? val.join(", ") : String(val || '-')}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    String(question.masterDataValue)
                                                )
                                            ) : isMapped
                                                ? <span className="italic text-slate-400">No value yet — click ✏️ to add</span>
                                                : <span className="italic text-slate-300">Map a master field to enable answers</span>
                                            }
                                        </span>

                                        <div className="flex items-center gap-1 ml-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={handleStartEdit}
                                                disabled={!isMapped || question.status === 'RELEASED'}
                                                title={question.status === 'RELEASED' ? "Cannot edit released questions" : isMapped ? "Edit value" : "Map a field first"}
                                                className={cn(
                                                    "p-1 rounded transition-colors",
                                                    (isMapped && question.status !== 'RELEASED')
                                                        ? "text-indigo-500 hover:bg-indigo-50 hover:text-indigo-700"
                                                        : "text-slate-300 cursor-not-allowed"
                                                )}
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    const fNo = question.masterFieldNo || 0;
                                                    const customId = (question as any).customFieldDefinitionId;
                                                    onInspect(fNo, question.text, customId);
                                                }}
                                                title="View history & details"
                                                className="p-1 rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                                            >
                                                <PanelLeftOpen className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                            {!isEditing && (question.masterDataSource || question.masterDataUpdatedAt) && (
                                <div className="flex items-center gap-3 pl-6 text-[10px] text-slate-400 font-medium">
                                    {question.masterDataSource && (
                                        <div className="flex items-center gap-1 bg-slate-100/50 px-1.5 py-0.5 rounded border border-slate-200/50">
                                            <span className="opacity-60 uppercase tracking-wide">Source:</span>
                                            <span className="text-slate-600 font-bold uppercase">{question.masterDataSource}</span>
                                        </div>
                                    )}
                                    {question.masterDataUpdatedAt && (
                                        <div className="flex items-center gap-1">
                                            <span className="opacity-60 uppercase tracking-wide">Last Updated:</span>
                                            <span className="text-slate-500 font-semibold">{new Date(question.masterDataUpdatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Side: Mapping Controls */}
                    <div className="w-[320px] p-4 flex flex-col justify-center gap-2 bg-slate-50/30 border-l border-slate-100">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1 flex items-center justify-between gap-2">
                            <span>Master Data Mapping</span>
                            <span className={cn(
                                "text-[9px] px-1.5 py-0.5 rounded tracking-normal font-semibold",
                                question.status === 'RELEASED' ? "bg-slate-200 text-slate-700" :
                                    question.status === 'SHARED' ? "bg-indigo-100 text-indigo-700" :
                                        question.status === 'APPROVED' ? "bg-emerald-100 text-emerald-700" :
                                            question.status === 'DRAFT' ? "bg-amber-100 text-amber-700" :
                                                "bg-slate-100 text-slate-500"
                            )}>
                                {isMapped ? question.status : 'UNMAPPED'}
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            <SuperFieldSelector
                                value={
                                    question.masterFieldNo
                                        ? `master:${question.masterFieldNo}`
                                        : question.masterQuestionGroupId
                                            ? `group:${question.masterQuestionGroupId}`
                                            : (question as any).customFieldDefinitionId
                                                ? `custom:${(question as any).customFieldDefinitionId}`
                                                : null
                                }
                                onSelect={(val, type, label) => {
                                    if (type === 'clear') onMap("UNMAP");
                                    else if (type === 'create') onMap("CREATE_NEW");
                                    else if (type === 'master') onMap(val);
                                    else if (type === 'group') onMap(`GROUP_${val}`);
                                    else if (type === 'custom') onMap(`CUSTOM_${val}`);
                                }}
                                masterFields={masterFields}
                                masterGroups={masterGroups}
                                customFields={customFields}
                                questionText={question.text}
                                disabled={disabled || question.status === 'RELEASED'}
                            />

                            {isMapped && question.status !== 'RELEASED' && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 text-slate-400 hover:text-red-500 hover:bg-red-50 shrink-0"
                                    onClick={() => onMap("UNMAP")}
                                    disabled={disabled}
                                    title="Unmap field"
                                >
                                    <Unlink className="h-4 w-4" />
                                </Button>
                            )}
                        </div>

                        {/* Lifecycle Actions */}
                        {isMapped && (
                            <div className="mt-2 pt-2 border-t border-slate-200/50">
                                {question.status === 'RELEASED' ? (
                                    <div className="flex items-center gap-2 p-2 bg-slate-100/50 rounded border border-slate-200/50 text-[11px] text-slate-600">
                                        <Lock className="h-3 w-3 shrink-0 text-slate-900" />
                                        <span>Locked {question.releasedAt ? `on ${new Date(question.releasedAt).toLocaleDateString()}` : ''}</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        {question.status === 'DRAFT' && (
                                            <Button size="sm" variant="default" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 w-full shadow-sm" onClick={handleApprove} disabled={isActionPending}>
                                                <Check className="h-3 w-3 mr-1" /> Approve Mapping
                                            </Button>
                                        )}
                                        {question.status === 'APPROVED' && (
                                            <Button size="sm" variant="outline" className="h-7 text-xs text-indigo-600 border-indigo-200 flex-1 shadow-sm" onClick={(e) => handleShare(e, true)} disabled={isActionPending}>
                                                <Share2 className="h-3 w-3 mr-1" /> Share
                                            </Button>
                                        )}
                                        {question.status === 'SHARED' && (
                                            <Button size="sm" variant="outline" className="h-7 text-xs text-slate-600 flex-1 shadow-sm border-slate-200" onClick={(e) => handleShare(e, false)} disabled={isActionPending}>
                                                Unshare
                                            </Button>
                                        )}
                                        {(question.status === 'APPROVED' || question.status === 'SHARED') && (
                                            <Button size="sm" variant="secondary" className="h-7 text-xs bg-slate-900 text-white hover:bg-slate-800 flex-1 shadow-sm" onClick={handleRelease} disabled={isActionPending}>
                                                <Lock className="h-3 w-3 mr-1" /> Release
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
