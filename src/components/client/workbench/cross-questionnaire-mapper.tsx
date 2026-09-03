"use client";

import { isPartyValue, getPartySummary } from "@/lib/master-data/party-value";
import { isAddressValue, getAddressSummary } from "@/lib/master-data/address-value";
import { FieldValueRenderer } from "@/components/client/fields/FieldValueRenderer";
import { FieldAttachments } from "@/components/client/fields/FieldAttachments";
import { FieldSourceBadge } from "@/components/client/fields/FieldSourceBadge";
import { FieldAttachmentIndicator } from "@/components/shared/FieldAttachmentIndicator";
import { resolveFieldForDisplay } from "@/lib/master-data/field-interpreter";

import { useState, useEffect, useMemo, useTransition } from "react";
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
    Share2,
    ExternalLink,
    LayoutGrid,
    Rows,
    TableProperties,
    Columns3
} from "lucide-react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { FieldDetailPanel } from "../inspection/field-detail-panel";
import { GroupAnswerRenderer } from "../engagement/group-answer-renderer";
import type { GroupFieldData } from "../engagement/group-answer-renderer";
import { toast } from "sonner";
import { showActionErrorToast } from "@/components/ui/copyable-error-toast";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { usePreferences } from "@/components/providers/user-preferences-provider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Rdd1QuestionCard } from "./rdd1/rdd1-question-card";

interface Props {
    leId: string;
    initialData: Workbench4Data;
    disabled?: boolean;
}

// ── Display helpers ───────────────────────────────────────────────────────────
//
// PARTY_REF / PERSON_REF collection items flow as Prisma-included relation
// objects from KycStateService.mapToDerivedValue():
//   valuePerson: { firstName, lastName, ... }  (via include: { valuePerson: true })
//   valueLe:     { name, ... }                  (via include: { valueLe: true })
// These helpers convert any value shape to a human-readable label.

/**
 * Returns a readable label for a single party/person DTO or scalar.
 * Handles:
 *   - Prisma Person objects  { firstName, lastName }
 *   - Prisma LegalEntity     { name }
 *   - CH party DTOs          { name, firstName, lastName, fullName }
 *   - UUID strings           (raw FK — shown as truncated ID)
 *   - null/undefined         → empty string
 */
export function formatPartyLabel(item: unknown): string {
    if (item == null) return '';
    
    let parsedItem = item;
    if (typeof item === 'string' && (item.startsWith('{') || item.startsWith('['))) {
        try {
            parsedItem = JSON.parse(item);
        } catch (e) {}
    }

    if (typeof parsedItem === 'string') {
        // Raw UUID FK — show truncated, not the full UUID
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(parsedItem)) return `ID:${parsedItem.slice(0, 8)}…`;
        return parsedItem;
    }
    if (typeof parsedItem === 'number' || typeof parsedItem === 'boolean') return String(parsedItem);
    if (parsedItem instanceof Date) return parsedItem.toLocaleDateString();
    if (typeof parsedItem === 'object' && parsedItem !== null) {
        const obj = parsedItem as Record<string, any>;

        if (obj.resolvedSummary)                               return String(obj.resolvedSummary);
        if (isPartyValue(obj))                                 return getPartySummary(obj);
        if (isAddressValue(obj))                               return getAddressSummary(obj as any);

        // Prefer explicit full name fields
        if (obj.fullName)                                      return String(obj.fullName);
        if (obj.firstName || obj.lastName)                     return `${obj.firstName ?? ''} ${obj.lastName ?? ''}`.trim();
        if (obj.forenames || obj.surname)                      return `${obj.forenames ?? ''} ${obj.surname ?? ''}`.trim();
        if (obj.name)                                          return String(obj.name);
        if (obj.displayName)                                   return String(obj.displayName);
        if (obj.contactType === "PERSON")                      return "Person";
        if (obj.contactType === "CONTACT")                     return "Contact";
        // Fallback: first non-null string-value property
        const firstStr = Object.values(obj).find(v => typeof v === 'string' && v.length > 0);
        if (firstStr)                                          return firstStr as string;
        return '[unknown party]';
    }
    return String(parsedItem);
}

/**
 * Converts a masterDataValue (any shape) to a display string.
 * Arrays → comma-joined labels. Objects → key: value pairs.
 */
export function formatAnswerValue(value: unknown): string {
    if (value == null || value === '') return '';
    if (Array.isArray(value)) return value.map(formatPartyLabel).join(', ');
    if (typeof value === 'object') return formatPartyLabel(value);
    return String(value);
}

// ─────────────────────────────────────────────────────────────────────────────


import { classifyQuestionAnswerState } from "@/lib/metrics/question-state-types";
import { isQuestionInPopulationScope, deriveEligibleQuestionnaireOptions } from "@/lib/metrics/question-scope";

export function CrossQuestionnaireMapper({ leId, initialData, disabled = false }: Props) {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const router = useRouter();
    const { preferences, updatePreference } = usePreferences();

    // Initialize from URL or defaults
    const [data, setData] = useState<Workbench4Data>(initialData);
    const [search, setSearch] = useState(searchParams.get("s") || "");
    const [relationshipIdFilter, setRelationshipIdFilter] = useState<string>(
        searchParams.get("relationshipId") || searchParams.get("relId") || "ALL"
    );
    const [relFilter, setRelFilter] = useState<string>(searchParams.get("rel") || "ALL");
    const [questionnaireIdFilter, setQuestionnaireIdFilter] = useState<string>(
        searchParams.get("questionnaireId") || searchParams.get("qId") || "ALL"
    );
    const [qFilter, setQFilter] = useState<string>(searchParams.get("q") || "ALL");
    const [mappingTypeFilter, setMappingTypeFilter] = useState<string>(searchParams.get("m") || "ALL"); // ALL, MAPPED, UNMAPPED
    const [catFilter, setCatFilter] = useState<string>(searchParams.get("cat") || "ALL");
    const [answerStateFilter, setAnswerStateFilter] = useState<string>(searchParams.get("answerState") || "ALL");
    const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
    // Sync state whenever searchParams change (e.g. navigation or drill-down links)
    useEffect(() => {
        setSearch(searchParams.get("s") || "");
        setRelationshipIdFilter(searchParams.get("relationshipId") || searchParams.get("relId") || "ALL");
        setRelFilter(searchParams.get("rel") || "ALL");
        setQuestionnaireIdFilter(searchParams.get("questionnaireId") || searchParams.get("qId") || "ALL");
        setQFilter(searchParams.get("q") || "ALL");
        setMappingTypeFilter(searchParams.get("m") || "ALL");
        setCatFilter(searchParams.get("cat") || "ALL");
        setAnswerStateFilter(searchParams.get("answerState") || "ALL");
    }, [searchParams]);

    // Derive unique relationship options (stable ID + org name)
    const relationshipOptions = useMemo(() => {
        const map = new Map<string, { id?: string; name: string }>();
        for (const q of data.questions) {
            if (q.fiEngagementId && q.engagementOrgName && q.engagementOrgName !== "Common") {
                map.set(q.fiEngagementId, { id: q.fiEngagementId, name: q.engagementOrgName });
            } else if (q.isCommon || q.engagementOrgName === "Common") {
                map.set("Common", { id: undefined, name: "Common" });
            } else if (q.engagementOrgName) {
                map.set(q.engagementOrgName, { id: undefined, name: q.engagementOrgName });
            }
        }
        return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [data.questions]);

    const activeRelationshipValue = useMemo(() => {
        if (relationshipIdFilter !== "ALL") {
            const opt = relationshipOptions.find(o => o.id === relationshipIdFilter || o.name === relationshipIdFilter);
            return opt ? (opt.id || opt.name) : relationshipIdFilter;
        }
        if (relFilter !== "ALL") return relFilter;
        return "ALL";
    }, [relationshipIdFilter, relFilter, relationshipOptions]);

    const handleRelationshipSelect = (val: string) => {
        clearPinned();
        setQuestionnaireIdFilter("ALL");
        setQFilter("ALL");
        if (val === "ALL") {
            setRelationshipIdFilter("ALL");
            setRelFilter("ALL");
            updateUrl({
                relationshipId: null,
                relId: null,
                rel: null,
                questionnaireId: null,
                qId: null,
                q: null,
            });
        } else {
            const opt = relationshipOptions.find(o => o.id === val || o.name === val);
            if (opt?.id) {
                setRelationshipIdFilter(opt.id);
                setRelFilter("ALL");
                updateUrl({
                    relationshipId: opt.id,
                    relId: null,
                    rel: null,
                    questionnaireId: null,
                    qId: null,
                    q: null,
                });
            } else {
                setRelationshipIdFilter("ALL");
                setRelFilter(val);
                updateUrl({
                    relationshipId: null,
                    relId: null,
                    rel: val,
                    questionnaireId: null,
                    qId: null,
                    q: null,
                });
            }
        }
    };

    // Derive unique questionnaire options scoped to the active relationship
    const questionnaireOptions = useMemo(() => {
        return deriveEligibleQuestionnaireOptions(data.questions, {
            relationshipId: relationshipIdFilter,
            rel: relFilter,
        });
    }, [data.questions, relationshipIdFilter, relFilter]);

    const activeQuestionnaireValue = useMemo(() => {
        if (questionnaireIdFilter !== "ALL") {
            const opt = questionnaireOptions.find(o => o.id === questionnaireIdFilter || o.name === questionnaireIdFilter);
            return opt ? (opt.id || opt.name) : questionnaireIdFilter;
        }
        if (qFilter !== "ALL") return qFilter;
        return "ALL";
    }, [questionnaireIdFilter, qFilter, questionnaireOptions]);

    const handleQuestionnaireSelect = (val: string) => {
        clearPinned();
        if (val === "ALL") {
            setQuestionnaireIdFilter("ALL");
            setQFilter("ALL");
            updateUrl({ questionnaireId: null, qId: null, q: null });
        } else {
            const opt = questionnaireOptions.find(o => o.id === val || o.name === val);
            if (opt?.id) {
                setQuestionnaireIdFilter(opt.id);
                setQFilter("ALL");
                updateUrl({ questionnaireId: opt.id, qId: null, q: null });
            } else {
                setQuestionnaireIdFilter("ALL");
                setQFilter(val);
                updateUrl({ questionnaireId: null, qId: null, q: val });
            }
        }
    };

    const urlView = searchParams.get("view");
    const viewMode = ((urlView === "flow" || urlView === "classic" || urlView === "compact" || urlView === "rdd1")
        ? urlView
        : (preferences as any)?.workbenchCardView || "classic") as "classic" | "flow" | "compact" | "rdd1";

    const handleViewChange = (mode: "classic" | "flow" | "compact" | "rdd1") => {
        updateUrl({ view: mode });
        updatePreference("workbenchCardView", mode);
    };

    const isAutoFiltered = useMemo(() => {
        return (
            searchParams.get("rel") ||
            searchParams.get("relationshipId") ||
            searchParams.get("relId") ||
            searchParams.get("q") ||
            searchParams.get("questionnaireId") ||
            searchParams.get("qId") ||
            searchParams.get("s") ||
            searchParams.get("cat") ||
            searchParams.get("m") ||
            searchParams.get("answerState")
        );
    }, [searchParams]);

    // Update URL when filters change
    const updateUrl = (updates: Record<string, string | null>) => {
        const params = new URLSearchParams(searchParams.toString());
        Object.entries(updates).forEach(([key, value]) => {
            if (value === "ALL" || value === "" || value === null) {
                params.delete(key);
            } else {
                params.set(key, value);
            }
        });
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    };

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
    const [selectedInspectionField, setSelectedInspectionField] = useState<{
        fieldNo: number;
        name: string;
        customFieldId?: string;
        mappingContext?: any;
    } | null>(null);

    const clearAllFilters = () => {
        clearPinned();
        setSearch("");
        setRelFilter("ALL");
        setRelationshipIdFilter("ALL");
        setQFilter("ALL");
        setQuestionnaireIdFilter("ALL");
        setCatFilter("ALL");
        setMappingTypeFilter("ALL");
        setAnswerStateFilter("ALL");
        updateUrl({
            s: null,
            rel: null,
            relationshipId: null,
            relId: null,
            q: null,
            questionnaireId: null,
            qId: null,
            cat: null,
            m: null,
            answerState: null,
        });
    };

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
            // 1. Population Scope (LE / Relationship / Questionnaire)
            const matchesScope = isQuestionInPopulationScope(
                {
                    fiEngagementId: q.fiEngagementId,
                    questionnaireId: q.questionnaireId,
                    engagementOrgName: q.engagementOrgName,
                    questionnaireName: q.questionnaireName,
                    isCommon: q.isCommon,
                },
                {
                    relationshipId: relationshipIdFilter,
                    rel: relFilter,
                    questionnaireId: questionnaireIdFilter,
                    q: qFilter,
                }
            );
            if (!matchesScope) return false;

            // 2. Search
            const matchesSearch = !search || q.text.toLowerCase().includes(search.toLowerCase());
            if (!matchesSearch) return false;

            // 3. Category
            const matchesCat = catFilter === "ALL" || q.masterFieldCategory === catFilter;
            if (!matchesCat) return false;

            // 4. Mapping Status (m)
            const isMapped = !!(q.masterFieldNo || q.masterQuestionGroupId || (q as any).customFieldDefinitionId);
            const isPinned = pinnedIds.has(q.id);
            const matchesMapping =
                mappingTypeFilter === "ALL" ||
                (mappingTypeFilter === "MAPPED" && isMapped) ||
                (mappingTypeFilter === "UNMAPPED" && !isMapped) ||
                isPinned;
            if (!matchesMapping) return false;

            // 5. Answer State (answerState) - Separate filter dimension using shared V2 classifier
            if (answerStateFilter !== "ALL") {
                const hasNonEmptyValue = (val: any): boolean => {
                    if (val === null || val === undefined || val === "") return false;
                    if (typeof val === "object" && !Array.isArray(val) && !(val instanceof Date)) {
                        return Object.values(val).some(v => v !== null && v !== undefined && v !== "");
                    }
                    return true;
                };

                const hasGroupDefault = Boolean(
                    (q as any).masterDataGroupFields?.some(
                        (f: any) => f.canonicalDisplayModel?.state === "DEFAULT" || (f.canonicalDisplayModel?.defaultText && f.canonicalDisplayModel.defaultText.trim().length > 0)
                    )
                );

                const rawSource = q.canonicalDisplayModel?.source?.type || q.masterDataSource;
                const hasTimestamp = Boolean(q.canonicalDisplayModel?.source?.lastValidatedAt || q.masterDataUpdatedAt || q.canonicalDisplayModel?.source?.timestamp);
                const isCheckedNoData = q.canonicalDisplayModel?.state === "CHECKED_NO_DATA" ||
                    (q.canonicalDisplayModel?.state === "NO_DATA" && Boolean(rawSource) && hasTimestamp);

                const hasAnswer = Boolean(
                    q.canonicalDisplayModel?.state === "POPULATED" ||
                    q.canonicalDisplayModel?.state === "EXPLICIT_NONE" ||
                    isCheckedNoData ||
                    q.canonicalDisplayModel?.state === "DEFAULT" ||
                    q.canonicalDisplayModel?.state === "DEFAULT_RESPONSE" ||
                    hasGroupDefault ||
                    hasNonEmptyValue(q.masterDataValue) ||
                    (q.answer && q.answer.trim().length > 0 && q.answer !== "null" && q.answer !== "{}")
                );

                const isDefaultState = q.canonicalDisplayModel?.state === "DEFAULT" ||
                    q.canonicalDisplayModel?.state === "DEFAULT_RESPONSE" ||
                    q.canonicalDisplayModel?.source?.type === "DEFAULT" ||
                    (!hasNonEmptyValue(q.masterDataValue) && hasGroupDefault);

                const sourceType = isDefaultState
                    ? "DEFAULT_RESPONSE"
                    : (q.canonicalDisplayModel?.source?.type || q.masterDataSource || null);
                const isScoped = Boolean(q.canonicalDisplayModel?.isScoped);
                const evidenceProvider = q.canonicalDisplayModel?.source?.reference || null;
                const displayState = isDefaultState ? "DEFAULT_RESPONSE" : (q.canonicalDisplayModel?.state || null);

                const category = classifyQuestionAnswerState(hasAnswer, sourceType, isScoped, evidenceProvider, displayState);
                if (category !== answerStateFilter.toUpperCase()) {
                    return false;
                }
            }

            return true;
        });
    }, [
        data.questions,
        search,
        relationshipIdFilter,
        relFilter,
        questionnaireIdFilter,
        qFilter,
        mappingTypeFilter,
        pinnedIds,
        catFilter,
        answerStateFilter,
    ]);

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
            let mapping: { fieldNo?: number | null; customFieldId?: string | null; groupId?: string | null; projectionPath?: string | null } = {};

            if (val === "UNMAP") {
                mapping = { fieldNo: null, customFieldId: null, groupId: null };
            } else if (val.startsWith("CUSTOM_")) {
                mapping = { customFieldId: val.replace("CUSTOM_", "") };
            } else if (val.startsWith("GROUP_")) {
                mapping = { groupId: val.replace("GROUP_", "") };
            } else {
                const parts = val.split(':');
                mapping = { fieldNo: parseInt(parts[0]), projectionPath: parts[1] || null };
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
                                masterFieldProjectionPath: mapping.projectionPath ?? null,
                                customFieldDefinitionId: mapping.customFieldId ?? null,
                                masterDataValue: (res as any).newValue,
                                masterDataSource: (res as any).newSource,
                                masterDataUpdatedAt: (res as any).newUpdatedAt,
                                canonicalDisplayModel: (res as any).newCanonicalDisplayModel !== undefined ? (res as any).newCanonicalDisplayModel : q.canonicalDisplayModel,
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
        const rawSourceToUse = {
            type: newSource || 'USER_INPUT',
            reference: null,
            timestamp: newUpdatedAt || new Date(),
            sourceCheckedAt: newUpdatedAt || new Date()
        };

        setData(prev => {
            const masterDef = prev.masterFields.find((f: any) => f.fieldNo === fieldNo);
            const customDef = customFieldId ? prev.customFields.find((f: any) => f.id === customFieldId) : undefined;

            const updatedQuestions = prev.questions.map((q: any) => {
                const isMatch = customFieldId
                    ? (q as any).customFieldDefinitionId === customFieldId
                    : (fieldNo > 0 && q.masterFieldNo === fieldNo);

                if (isMatch) {
                    const label = q.canonicalDisplayModel?.label || masterDef?.label || customDef?.label || q.text || '';
                    const appDataType = masterDef?.dataType || customDef?.dataType || 'TEXT';
                    const hasVal = newValue !== null && newValue !== undefined && newValue !== '';

                    const metadata = {
                        fieldNo: fieldNo || -1,
                        label,
                        displayState: hasVal ? ('HAS_VALUE' as const) : ('CHECKED_NO_DATA' as const),
                        appDataType: appDataType?.toUpperCase(),
                        isMultiValue: q.canonicalDisplayModel?.isMultiValue || false,
                        attachments: q.canonicalDisplayModel?.attachments || [],
                        allowAttachments: q.canonicalDisplayModel?.allowAttachments,
                        displayContext: q.canonicalDisplayModel?.displayContext
                    };

                    const updatedCanonicalModel = resolveFieldForDisplay(
                        newValue,
                        rawSourceToUse,
                        metadata
                    );

                    return {
                        ...q,
                        masterDataValue: newValue,
                        masterDataSource: newSource,
                        masterDataUpdatedAt: newUpdatedAt,
                        canonicalDisplayModel: updatedCanonicalModel
                    };
                }
                return q;
            });

            const updatedMasterFields = prev.masterFields.map((f: any) => {
                if (fieldNo > 0 && f.fieldNo === fieldNo) {
                    return {
                        ...f,
                        currentValue: newValue,
                        displayState: (newValue !== null && newValue !== undefined && newValue !== '') ? 'HAS_VALUE' : 'CHECKED_NO_DATA'
                    };
                }
                return f;
            });

            const updatedCustomFields = prev.customFields.map((f: any) => {
                if (customFieldId && f.id === customFieldId) {
                    return {
                        ...f,
                        currentValue: newValue
                    };
                }
                return f;
            });

            return {
                ...prev,
                questions: updatedQuestions,
                masterFields: updatedMasterFields,
                customFields: updatedCustomFields
            };
        });
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
            <div className="flex flex-wrap items-center gap-4 bg-card text-card-foreground p-4 rounded-md border border-border shadow-sm">
                <div className="relative flex-1 min-w-[300px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search questions..."
                        className="pl-9 bg-muted/50 border-border text-foreground"
                        value={search}
                        onChange={(e) => {
                            const val = e.target.value;
                            setSearch(val);
                            updateUrl({ s: val });
                            clearPinned();
                        }}
                    />
                </div>

                <div className="flex items-center gap-2">
                    {isAutoFiltered && (
                        <Badge variant="outline" className="mr-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 flex items-center gap-1.5 py-1 px-2 animate-in fade-in slide-in-from-right-2 duration-500">
                            <Sparkles className="h-3 w-3" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Filters Applied</span>
                            <button 
                                onClick={clearAllFilters}
                                className="ml-1 hover:text-indigo-800 dark:hover:text-indigo-200 transition-colors"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </Badge>
                    )}
                    <Filter className="h-4 w-4 text-muted-foreground mr-1" />

                    <Select value={activeRelationshipValue} onValueChange={handleRelationshipSelect}>
                        <SelectTrigger className="w-[180px] bg-muted/50 border-border text-foreground">
                            <SelectValue placeholder="Relationship" />
                        </SelectTrigger>
                        <SelectContent className="bg-card text-card-foreground border-border">
                            <SelectItem value="ALL">All Relationships</SelectItem>
                            {relationshipOptions.map((opt) => (
                                <SelectItem key={opt.id || opt.name} value={opt.id || opt.name}>
                                    {opt.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={activeQuestionnaireValue} onValueChange={handleQuestionnaireSelect}>
                        <SelectTrigger className="w-[200px] bg-muted/50 border-border text-foreground">
                            <SelectValue placeholder="Questionnaire" />
                        </SelectTrigger>
                        <SelectContent className="bg-card text-card-foreground border-border">
                            <SelectItem value="ALL">All Questionnaires</SelectItem>
                            {questionnaireOptions.map((opt) => (
                                <SelectItem key={opt.id || opt.name} value={opt.id || opt.name}>
                                    {opt.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={catFilter} onValueChange={(val) => {
                        handleFilterChange(setCatFilter)(val);
                        updateUrl({ cat: val });
                    }}>
                        <SelectTrigger className="w-[160px] bg-muted/50 border-border text-foreground">
                            <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent className="bg-card text-card-foreground border-border">
                            <SelectItem value="ALL">All Categories</SelectItem>
                            {availableCategories.map((cat: any) => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={mappingTypeFilter} onValueChange={(val) => {
                        handleFilterChange(setMappingTypeFilter)(val);
                        updateUrl({ m: val });
                    }}>
                        <SelectTrigger className="w-[150px] bg-muted/50 border-border text-foreground">
                            <SelectValue placeholder="Mapping" />
                        </SelectTrigger>
                        <SelectContent className="bg-card text-card-foreground border-border">
                            <SelectItem value="ALL">All Statuses</SelectItem>
                            <SelectItem value="MAPPED">Mapped</SelectItem>
                            <SelectItem value="UNMAPPED">Unmapped</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={answerStateFilter} onValueChange={(val) => {
                        handleFilterChange(setAnswerStateFilter)(val);
                        updateUrl({ answerState: val });
                    }}>
                        <SelectTrigger className="w-[170px] bg-muted/50 border-border text-foreground">
                            <SelectValue placeholder="Answer State" />
                        </SelectTrigger>
                        <SelectContent className="bg-card text-card-foreground border-border">
                            <SelectItem value="ALL">All Answer States</SelectItem>
                            <SelectItem value="external">External Answers</SelectItem>
                            <SelectItem value="user_input">User Input</SelectItem>
                            <SelectItem value="default_response">Default Answers</SelectItem>
                            <SelectItem value="unanswered">Unanswered</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Results Counters & View Switcher */}
            <div className="flex items-center justify-between px-2">
                <div className="text-sm text-muted-foreground">
                    Showing <span className="font-semibold text-foreground">{filteredQuestions.length}</span> questions
                    {mappingTypeFilter !== "ALL" && ` (${mappingTypeFilter.toLowerCase()})`}
                </div>
                <div className="flex items-center gap-1 bg-muted/80 p-1 rounded-lg border border-border">
                    <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                            "h-7 px-2.5 text-xs font-medium gap-1.5 transition-all",
                            viewMode === "classic"
                                ? "bg-card text-foreground shadow-sm border border-border font-semibold"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() => handleViewChange("classic")}
                    >
                        <LayoutGrid className="h-3.5 w-3.5" />
                        Classic
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                            "h-7 px-2.5 text-xs font-medium gap-1.5 transition-all",
                            viewMode === "flow"
                                ? "bg-card text-foreground shadow-sm border border-border font-semibold"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() => handleViewChange("flow")}
                    >
                        <Rows className="h-3.5 w-3.5" />
                        Flow
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                            "h-7 px-2.5 text-xs font-medium gap-1.5 transition-all",
                            viewMode === "compact"
                                ? "bg-card text-foreground shadow-sm border border-border font-semibold"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() => handleViewChange("compact")}
                    >
                        <TableProperties className="h-3.5 w-3.5" />
                        Compact
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                            "h-7 px-2.5 text-xs font-medium gap-1.5 transition-all",
                            viewMode === "rdd1"
                                ? "bg-card text-foreground shadow-sm border border-border font-semibold"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() => handleViewChange("rdd1")}
                    >
                        <Columns3 className="h-3.5 w-3.5" />
                        RDD1
                    </Button>
                </div>
            </div>

            {/* Question List */}
            {viewMode === "rdd1" ? (
                filteredQuestions.length > 0 ? (
                    <div className="space-y-4">
                        {filteredQuestions.map((q: any, idx: number) => (
                            <Rdd1QuestionCard
                                key={q.id}
                                question={q}
                                leId={leId}
                                masterFields={data.masterFields}
                                masterGroups={data.masterGroups}
                                customFields={data.customFields}
                                raNameLookup={data.raNameLookup}
                                disabled={isPending || disabled}
                                onInspectMapping={() => {
                                    const currentMappingVal = q.masterFieldNo
                                        ? `master:${q.masterFieldNo}${q.masterFieldProjectionPath ? `:${q.masterFieldProjectionPath}` : ''}`
                                        : q.masterQuestionGroupId
                                        ? `group:${q.masterQuestionGroupId}`
                                        : (q as any).customFieldDefinitionId
                                        ? `custom:${(q as any).customFieldDefinitionId}`
                                        : null;

                                    setSelectedInspectionField({
                                        fieldNo: q.masterFieldNo || 0,
                                        name: q.canonicalDisplayModel?.fieldName || q.text,
                                        customFieldId: (q as any).customFieldDefinitionId,
                                        mappingContext: {
                                            questionId: q.id,
                                            questionText: q.text,
                                            currentMappingValue: currentMappingVal,
                                            onMap: (val: string) => handleMap(q.id, val),
                                            masterFields: data.masterFields,
                                            masterGroups: data.masterGroups,
                                            customFields: data.customFields,
                                            disabled: isPending || disabled || q.status === 'RELEASED'
                                        }
                                    });
                                }}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="py-20 text-center bg-card text-card-foreground rounded-md border border-dashed border-border">
                        <AlertCircle className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                        <h3 className="text-lg font-medium text-foreground">No questions found</h3>
                        <p className="text-muted-foreground mt-1">Try adjusting your filters or search terms.</p>
                    </div>
                )
            ) : viewMode === "compact" ? (
                <Card className="shadow-sm border border-border overflow-visible bg-card text-card-foreground">
                    <Table>
                        <TableHeader className="bg-muted/80 border-b border-border">
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="w-[130px] text-[10px] font-bold uppercase tracking-wider text-muted-foreground py-2.5 px-3">Status & Actions</TableHead>
                                <TableHead className="w-[180px] text-[10px] font-bold uppercase tracking-wider text-muted-foreground py-2.5 px-3">Relationship & Doc</TableHead>
                                <TableHead className="min-w-[250px] text-[10px] font-bold uppercase tracking-wider text-muted-foreground py-2.5 px-3">Question (Q)</TableHead>
                                <TableHead className="min-w-[280px] text-[10px] font-bold uppercase tracking-wider text-muted-foreground py-2.5 px-3">Answer Value & Details (A)</TableHead>
                                <TableHead className="w-[260px] text-[10px] font-bold uppercase tracking-wider text-muted-foreground py-2.5 px-3">Master Data Mapping</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="divide-y divide-border">
                            {filteredQuestions.map((q: any) => (
                                <QuestionTableRow
                                    key={q.id}
                                    question={q}
                                    leId={leId}
                                    masterFields={data.masterFields}
                                    masterGroups={data.masterGroups}
                                    customFields={data.customFields}
                                    raNameLookup={data.raNameLookup}
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
                        </TableBody>
                    </Table>
                </Card>
            ) : (
                <div className="space-y-3">
                    {filteredQuestions.map((q: any) => (
                        <QuestionCard
                            key={q.id}
                            question={q}
                            leId={leId}
                            masterFields={data.masterFields}
                            masterGroups={data.masterGroups}
                            customFields={data.customFields}
                            raNameLookup={data.raNameLookup}
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
                            viewMode={viewMode as "classic" | "flow"}
                        />
                    ))}
                </div>
            )}

                {filteredQuestions.length === 0 && (
                    <div className="py-20 text-center bg-card text-card-foreground rounded-md border border-dashed border-border">
                        <AlertCircle className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                        <h3 className="text-lg font-medium text-foreground">No questions found</h3>
                        <p className="text-muted-foreground mt-1">Try adjusting your filters or search terms.</p>
                    </div>
                )}

            <FieldDetailPanel
                open={!!selectedInspectionField}
                onOpenChange={(open) => !open && setSelectedInspectionField(null)}
                clientLEId={leId}
                fieldNo={selectedInspectionField?.fieldNo || 0}
                fieldName={selectedInspectionField?.name || ""}
                customFieldId={selectedInspectionField?.customFieldId}
                mappingContext={selectedInspectionField?.mappingContext}
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
    raNameLookup,
    onMap,
    onInspect,
    onInlineEdit,
    onRenameCustomField,
    onStatusChange,
    disabled,
    isPinned,
    viewMode = "classic"
}: {
    question: ConsoleQuestion;
    leId: string;
    masterFields: Array<{ fieldNo: number; label: string; attachmentCount?: number }>;
    masterGroups: Array<{ key: string; label: string }>;
    customFields: Array<{ id: string; label: string }>;
    raNameLookup: Record<string, string>;
    onMap: (val: string) => void;
    onInspect: (fieldNo: number, name: string, customFieldId?: string) => void;
    onInlineEdit: (newValue: any, newSource: string, newUpdatedAt: Date) => void;
    onRenameCustomField: (customFieldId: string, newLabel: string) => Promise<{ success: boolean; error?: string }>;
    onStatusChange: (newStatus: string) => void;
    disabled?: boolean;
    isPinned?: boolean;
    viewMode?: "classic" | "flow";
}) {
    const isMapped = !!(question.masterFieldNo || question.masterQuestionGroupId || (question as any).customFieldDefinitionId);
    const isGroupAnswer = !!(question.masterQuestionGroupId && (question as any).masterDataGroupFields?.length > 0);
    const isProjectedValue = !!question.masterFieldProjectionPath;
    const isComplexValue = typeof question.masterDataValue === 'object' && question.masterDataValue !== null && !isProjectedValue;
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
        if (question.masterFieldProjectionPath) {
             const projLabels: Record<string, string> = {
                 'locality': 'Locality',
                 'region': 'Region',
                 'postalCode': 'Postal Code',
                 'countryCode': 'Country Code',
                 'addressLines[0]': 'Address Line 1',
                 'addressLines[1]': 'Address Line 2'
             };
             currentMappingLabel += ` · ${projLabels[question.masterFieldProjectionPath] || question.masterFieldProjectionPath}`;
        }
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
        const currentVal = question.masterDataValue != null
            ? String(question.masterDataValue)
            : question.canonicalDisplayModel?.textSummary || "";
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
            const { applyManualOverride } = await import("@/actions/kyc-manual-update");
            const targetFieldId = question.masterFieldNo || (question as any).customFieldDefinitionId;
            if (!targetFieldId) return;
            const res = await applyManualOverride(leId, targetFieldId, editValue, "Inline edit");
            if (res.success) {
                onInlineEdit(editValue, "USER_INPUT", new Date());
                toast.success("Value updated");
            } else {
                showActionErrorToast(res, "Update failed");
            }
        } catch (err) {
            toast.error("Update failed");
        } finally {
            setIsSaving(false);
            setIsEditing(false);
        }
    };

    const renderAnswerContent = () => (
        <div className="flex flex-col gap-1.5 pt-2 border-t border-border">
            <div className="flex items-start gap-2">
                <span className="text-indigo-600 dark:text-indigo-400 font-bold text-sm shrink-0 mt-0.5">A:</span>

                {isEditing ? (
                    <div className="flex items-center gap-2 w-full">
                        <Input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEdit();
                                if (e.key === 'Escape') handleCancelEdit();
                            }}
                            className="text-sm h-9 flex-1 bg-muted/50 border-border text-foreground"
                            autoFocus
                            disabled={isSaving}
                            placeholder="Enter value..."
                        />
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/40 shrink-0"
                            onClick={handleSaveEdit}
                            disabled={isSaving}
                        >
                            <Check className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:bg-muted shrink-0"
                            onClick={handleCancelEdit}
                            disabled={isSaving}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                ) : (
                    <div className="text-sm text-foreground bg-muted/40 px-2 py-1.5 rounded border border-border w-full font-medium relative flex items-center">
                        <span className="flex-1">
                            {question.masterQuestionGroupId && (question as any).masterDataGroupFields?.length > 0 ? (
                                <GroupAnswerRenderer
                                    groupLabel=""
                                    fields={(question as any).masterDataGroupFields as GroupFieldData[]}
                                    raNameLookup={raNameLookup}
                                    displayStyle={question.masterDataGroupDisplayStyle}
                                    className="py-0.5"
                                />
                            ) : question.canonicalDisplayModel ? (
                                <div className="py-0.5">
                                    <FieldValueRenderer field={question.canonicalDisplayModel} itemLimit={10} />
                                    {question.canonicalDisplayModel.attachments && question.canonicalDisplayModel.attachments.length > 0 && (
                                        <div className="mt-1">
                                            <FieldAttachments 
                                                clientLEId="read-only"
                                                fieldNo={question.canonicalDisplayModel.fieldNo} 
                                                attachments={question.canonicalDisplayModel.attachments} 
                                                mode="read-only" 
                                                isEditable={false} 
                                            />
                                        </div>
                                    )}
                                </div>
                            ) : question.masterDataValue != null && question.masterDataValue !== '' ? (
                                Array.isArray(question.masterDataValue) ? (
                                    <ul className="list-disc pl-4 space-y-1 m-0 text-foreground">
                                        {question.masterDataValue.slice(0, 10).map((val: any, i: any) => (
                                            <li key={i} className="marker:text-foreground">
                                                {formatAnswerValue(val)}
                                            </li>
                                        ))}
                                    </ul>
                                ) : typeof question.masterDataValue === 'object' && !isPartyValue(question.masterDataValue) && !isAddressValue(question.masterDataValue) && !('ccAddressId' in (question.masterDataValue as any)) && !('ccPartyId' in (question.masterDataValue as any)) ? (
                                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                                        {Object.entries(question.masterDataValue).map(([fNo, val]) => (
                                            <div key={fNo} className="flex flex-col">
                                                <span className="text-muted-foreground font-bold uppercase tracking-tighter text-[9px]">Field {fNo}</span>
                                                <span className="text-foreground font-semibold truncate">
                                                    {Array.isArray(val) ? val.map(formatPartyLabel).join(', ') : formatPartyLabel(val)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    formatAnswerValue(question.masterDataValue)
                                )
                            ) : isMapped
                                ? <span className="italic text-muted-foreground">No value yet — click ✏️ to add</span>
                                : <span className="italic text-muted-foreground/70">Map a master field to enable answers</span>
                            }
                        </span>

                        <div className={cn(
                            "flex items-center gap-1 ml-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity",
                            question.masterDataGroupDisplayStyle === 'COMPACT' && "absolute top-2 right-2 bg-card p-1 rounded shadow-sm border border-border ml-0"
                        )}>
                            {isGroupAnswer ? (
                                <a
                                    href={`/app/le/${leId}/master`}
                                    target="_blank"
                                    rel="noreferrer"
                                    title="Manage composite groups in Master Data tab"
                                    className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                            ) : isComplexValue || isProjectedValue ? (
                                <>
                                    <button
                                        disabled
                                        title={isProjectedValue ? "Projected values can't be edited inline — use the Master Data tab" : "Complex mapped answers must be edited in Master Data"}
                                        className="p-1 rounded text-muted-foreground/30 cursor-not-allowed"
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
                                        className="p-1 rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                    >
                                        <PanelLeftOpen className="h-3.5 w-3.5" />
                                    </button>
                                    <a
                                        href={`/app/le/${leId}/master`}
                                        title="Complex mapped answers must be edited in Master Data"
                                        className="p-1 rounded text-muted-foreground hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                                    >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                    </a>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={handleStartEdit}
                                        disabled={!isMapped || question.status === 'RELEASED'}
                                        title={question.status === 'RELEASED' ? "Cannot edit released questions" : isMapped ? "Edit value" : "Map a field first"}
                                        className={cn(
                                            "p-1 rounded transition-colors",
                                            (isMapped && question.status !== 'RELEASED')
                                                ? "text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-700 dark:hover:text-indigo-300"
                                                : "text-muted-foreground/30 cursor-not-allowed"
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
                                        className="p-1 rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                    >
                                        <PanelLeftOpen className="h-3.5 w-3.5" />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
            {!isEditing && !isGroupAnswer && question.canonicalDisplayModel?.displayContext && (
                <div className="pl-6 mt-0.5">
                    <span className="text-[10px] text-muted-foreground italic leading-tight">
                        {question.canonicalDisplayModel.displayContext}
                    </span>
                </div>
            )}
            {!isEditing && (
                question.canonicalDisplayModel?.source ? (
                    <div className="flex items-center gap-3 pl-6 mt-1 text-[10px] font-medium">
                        <FieldSourceBadge source={question.canonicalDisplayModel.source} showLastValidated={true} variant="span" />
                        {question.masterFieldNo && masterFields.find(f => f.fieldNo === question.masterFieldNo)?.attachmentCount ? (
                            <FieldAttachmentIndicator count={masterFields.find(f => f.fieldNo === question.masterFieldNo)?.attachmentCount} />
                        ) : null}
                    </div>
                ) : (question.masterDataSource || question.masterDataUpdatedAt) ? (
                    <div className="flex items-center gap-3 pl-6 mt-1 text-[10px] font-medium">
                        <FieldSourceBadge 
                            legacySourceType={question.masterDataSource ?? undefined} 
                            legacyTimestamp={question.masterDataUpdatedAt} 
                            showLastValidated={true} 
                            variant="span" 
                        />
                        {question.masterFieldNo && masterFields.find(f => f.fieldNo === question.masterFieldNo)?.attachmentCount ? (
                            <FieldAttachmentIndicator count={masterFields.find(f => f.fieldNo === question.masterFieldNo)?.attachmentCount} />
                        ) : null}
                    </div>
                ) : null
            )}
        </div>
    );

    if (viewMode === "flow") {
        return (
            <Card className={cn(
                "group transition-all shadow-sm overflow-hidden text-card-foreground",
                "border border-border hover:border-indigo-500/50 hover:shadow-md",
                "focus-within:border-indigo-500/50 focus-within:shadow-md",
                isPinned ? "!border-green-400 ring-2 ring-green-500/20 z-10 scale-[1.01]" : "",
                isMapped ? "bg-card" : "bg-muted/40 border-dashed"
            )}>
                <CardContent className="p-0">
                    {/* Row 1: 50% Left Context / 50% Right Mapping Grid */}
                    <div className={cn(
                        "grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border-b border-border items-start transition-colors",
                        isPinned ? "bg-green-500/10" : "bg-muted/30"
                    )}>
                        {/* Left 50%: Context & Metadata */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                                <span className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                                    <Building2 className="h-3 w-3 text-muted-foreground" />
                                    {question.engagementOrgName || "Unknown Relationship"}
                                </span>
                                <span className="text-muted-foreground/40">·</span>
                                <span className="flex items-center gap-1.5 truncate text-foreground" title={question.questionnaireName}>
                                    <FileText className="h-3 w-3 text-muted-foreground" />
                                    {question.questionnaireName}
                                </span>
                            </div>

                            <div className="pt-0.5 flex items-center gap-2">
                                {isMapped ? (
                                    <>
                                        <Badge variant="secondary" className="bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800 gap-1 px-1.5 py-0">
                                            <CheckCircle2 className="h-3 w-3" />
                                            {isPinned ? "Just Mapped" : "Mapped"}
                                        </Badge>
                                        {customFieldId && !isRenaming && (
                                            <button
                                                className="p-0.5 rounded text-muted-foreground hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                                                onClick={(e) => { e.stopPropagation(); handleRenameStart(); }}
                                                title="Rename custom field"
                                            >
                                                <Pencil className="h-3 w-3" />
                                            </button>
                                        )}
                                    </>
                                ) : (
                                    <Badge variant="secondary" className="bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 gap-1 px-1.5 py-0">
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
                                        className="h-7 text-xs flex-1 bg-muted/50 border-border text-foreground"
                                        autoFocus
                                        disabled={isRenameSaving}
                                    />
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-green-600 dark:text-green-400" onClick={handleRenameSave} disabled={isRenameSaving}>
                                        {isRenameSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={() => setIsRenaming(false)}>
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Right 50%: Master Data Mapping Controls */}
                        <div className="flex flex-col justify-center gap-2">
                            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide flex items-center justify-between gap-2">
                                <span>Master Data Mapping</span>
                                <span className={cn(
                                    "text-[9px] px-1.5 py-0.5 rounded tracking-normal font-semibold",
                                    question.status === 'RELEASED' ? "bg-muted text-muted-foreground" :
                                        question.status === 'SHARED' ? "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300" :
                                            question.status === 'APPROVED' ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300" :
                                                question.status === 'DRAFT' ? "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300" :
                                                    "bg-muted text-muted-foreground"
                                )}>
                                    {isMapped ? question.status : 'UNMAPPED'}
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="flex-1">
                                    <SuperFieldSelector
                                        value={
                                            question.masterFieldNo
                                                ? `master:${question.masterFieldNo}${question.masterFieldProjectionPath ? `:${question.masterFieldProjectionPath}` : ''}`
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
                                </div>

                                {isMapped && question.status !== 'RELEASED' && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
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
                                <div className="pt-1 border-t border-border">
                                    {question.status === 'RELEASED' ? (
                                        <div className="flex items-center gap-2 p-1.5 bg-muted/50 rounded border border-border text-[11px] text-muted-foreground">
                                            <Lock className="h-3 w-3 shrink-0 text-foreground" />
                                            <span>Locked {question.releasedAt ? `on ${new Date(question.releasedAt).toLocaleDateString()}` : ''}</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            {question.status === 'DRAFT' && (
                                                <Button size="sm" variant="default" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white w-full shadow-sm" onClick={handleApprove} disabled={isActionPending}>
                                                    <Check className="h-3 w-3 mr-1" /> Approve Mapped Response
                                                </Button>
                                            )}
                                            {question.status === 'APPROVED' && (
                                                <Button size="sm" variant="outline" className="h-7 text-xs text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 flex-1 shadow-sm" onClick={(e) => handleShare(e, true)} disabled={isActionPending}>
                                                    <Share2 className="h-3 w-3 mr-1" /> Share
                                                </Button>
                                            )}
                                            {question.status === 'SHARED' && (
                                                <Button size="sm" variant="outline" className="h-7 text-xs text-muted-foreground flex-1 shadow-sm border-border" onClick={(e) => handleShare(e, false)} disabled={isActionPending}>
                                                    Unshare
                                                </Button>
                                            )}
                                            {(question.status === 'APPROVED' || question.status === 'SHARED') && (
                                                <Button size="sm" variant="secondary" className="h-7 text-xs bg-primary text-primary-foreground hover:bg-primary/90 flex-1 shadow-sm" onClick={handleRelease} disabled={isActionPending}>
                                                    <Lock className="h-3 w-3 mr-1" /> Release
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Row 2: 100% Full-Width Q&A Section */}
                    <div className="p-4 space-y-3">
                        <div className="flex items-start gap-2">
                            <span className="text-muted-foreground font-bold text-sm shrink-0 mt-0.5">Q:</span>
                            <h4 className="text-sm font-medium text-foreground leading-snug">
                                {question.text}
                            </h4>
                        </div>

                        {renderAnswerContent()}
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className={cn(
            "group transition-all shadow-sm overflow-hidden text-card-foreground",
            "border border-border hover:border-indigo-500/50 hover:shadow-md",
            "focus-within:border-indigo-500/50 focus-within:shadow-md",
            isPinned ? "!border-green-400 ring-2 ring-green-500/20 z-10 scale-[1.01]" : "",
            isMapped ? "bg-card" : "bg-muted/40 border-dashed"
        )}>
            <CardContent className="p-0">
                <div className="flex items-stretch min-h-[100px]">
                    {/* Left Side: Context */}
                    <div className={cn(
                        "w-[180px] border-r border-border p-4 space-y-2 shrink-0 transition-colors",
                        isPinned ? "bg-green-500/10" : ""
                    )}>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                            <Building2 className="h-3 w-3" />
                            {question.engagementOrgName || "Unknown Relationship"}
                        </div>
                        <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                            <FileText className="h-3 w-3 text-muted-foreground" />
                            <span className="truncate" title={question.questionnaireName}>
                                {question.questionnaireName}
                            </span>
                        </div>
                        <div className="pt-1 flex items-center gap-2">
                            {isMapped ? (
                                <>
                                    <Badge variant="secondary" className="bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800 gap-1 px-1.5 py-0">
                                        <CheckCircle2 className="h-3 w-3" />
                                        {isPinned ? "Just Mapped" : "Mapped"}
                                    </Badge>
                                    {customFieldId && !isRenaming && (
                                        <button
                                            className="p-0.5 rounded text-muted-foreground hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                                            onClick={(e) => { e.stopPropagation(); handleRenameStart(); }}
                                            title="Rename custom field"
                                        >
                                            <Pencil className="h-3 w-3" />
                                        </button>
                                    )}
                                </>
                            ) : (
                                <Badge variant="secondary" className="bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 gap-1 px-1.5 py-0">
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
                                    className="h-7 text-xs flex-1 bg-muted/50 border-border text-foreground"
                                    autoFocus
                                    disabled={isRenameSaving}
                                />
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-green-600 dark:text-green-400" onClick={handleRenameSave} disabled={isRenameSaving}>
                                    {isRenameSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                </Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={() => setIsRenaming(false)}>
                                    <X className="h-3 w-3" />
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Middle: Question Text */}
                    <div className="flex-1 p-4 flex flex-col justify-center space-y-3">
                        <div className="flex items-start gap-2">
                            <span className="text-muted-foreground font-bold text-sm shrink-0 mt-0.5">Q:</span>
                            <h4 className="text-sm font-medium text-foreground leading-snug">
                                {question.text}
                            </h4>
                        </div>

                        {renderAnswerContent()}
                    </div>

                    {/* Right Side: Mapping Controls */}
                    <div className="w-[320px] p-4 flex flex-col justify-center gap-2 bg-muted/30 border-l border-border">
                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1 flex items-center justify-between gap-2">
                            <span>Master Data Mapping</span>
                            <span className={cn(
                                "text-[9px] px-1.5 py-0.5 rounded tracking-normal font-semibold",
                                question.status === 'RELEASED' ? "bg-muted text-muted-foreground" :
                                    question.status === 'SHARED' ? "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300" :
                                        question.status === 'APPROVED' ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300" :
                                            question.status === 'DRAFT' ? "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300" :
                                                "bg-muted text-muted-foreground"
                            )}>
                                {isMapped ? question.status : 'UNMAPPED'}
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            <SuperFieldSelector
                                value={
                                    question.masterFieldNo
                                        ? `master:${question.masterFieldNo}${question.masterFieldProjectionPath ? `:${question.masterFieldProjectionPath}` : ''}`
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
                                    className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
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
                            <div className="mt-2 pt-2 border-t border-border">
                                {question.status === 'RELEASED' ? (
                                    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded border border-border text-[11px] text-muted-foreground">
                                        <Lock className="h-3 w-3 shrink-0 text-foreground" />
                                        <span>Locked {question.releasedAt ? `on ${new Date(question.releasedAt).toLocaleDateString()}` : ''}</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        {question.status === 'DRAFT' && (
                                            <Button size="sm" variant="default" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex-1 shadow-sm" onClick={handleApprove} disabled={isActionPending}>
                                                <Check className="h-3 w-3 mr-1" /> Approve Mapped Response
                                            </Button>
                                        )}
                                        {question.status === 'APPROVED' && (
                                            <Button size="sm" variant="outline" className="h-7 text-xs text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 flex-1 shadow-sm" onClick={(e) => handleShare(e, true)} disabled={isActionPending}>
                                                <Share2 className="h-3 w-3 mr-1" /> Share
                                            </Button>
                                        )}
                                        {question.status === 'SHARED' && (
                                            <Button size="sm" variant="outline" className="h-7 text-xs text-muted-foreground flex-1 shadow-sm border-border" onClick={(e) => handleShare(e, false)} disabled={isActionPending}>
                                                Unshare
                                            </Button>
                                        )}
                                        {(question.status === 'APPROVED' || question.status === 'SHARED') && (
                                            <Button size="sm" variant="secondary" className="h-7 text-xs bg-primary text-primary-foreground hover:bg-primary/90 flex-1 shadow-sm" onClick={handleRelease} disabled={isActionPending}>
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

function QuestionTableRow({
    question,
    leId,
    masterFields,
    masterGroups,
    customFields,
    raNameLookup,
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
    masterFields: Array<{ fieldNo: number; label: string; attachmentCount?: number }>;
    masterGroups: Array<{ key: string; label: string }>;
    customFields: Array<{ id: string; label: string }>;
    raNameLookup: Record<string, string>;
    onMap: (val: string) => void;
    onInspect: (fieldNo: number, name: string, customFieldId?: string) => void;
    onInlineEdit: (newValue: any, newSource: string, newUpdatedAt: Date) => void;
    onRenameCustomField: (customFieldId: string, newLabel: string) => Promise<{ success: boolean; error?: string }>;
    onStatusChange: (newStatus: string) => void;
    disabled?: boolean;
    isPinned?: boolean;
}) {
    const isMapped = !!(question.masterFieldNo || question.masterQuestionGroupId || (question as any).customFieldDefinitionId);
    const isGroupAnswer = !!(question.masterQuestionGroupId && (question as any).masterDataGroupFields?.length > 0);
    const isProjectedValue = !!question.masterFieldProjectionPath;
    const isComplexValue = typeof question.masterDataValue === 'object' && question.masterDataValue !== null && !isProjectedValue;
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

    let currentMappingLabel = "Unmapped";

    if (question.masterFieldNo) {
        currentMappingLabel = masterFields.find((f: any) => f.fieldNo === question.masterFieldNo)?.label || `Field ${question.masterFieldNo}`;
        if (question.masterFieldProjectionPath) {
             const projLabels: Record<string, string> = {
                 'locality': 'Locality',
                 'region': 'Region',
                 'postalCode': 'Postal Code',
                 'countryCode': 'Country Code',
                 'addressLines[0]': 'Address Line 1',
                 'addressLines[1]': 'Address Line 2'
             };
             currentMappingLabel += ` · ${projLabels[question.masterFieldProjectionPath] || question.masterFieldProjectionPath}`;
        }
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
        const currentVal = question.masterDataValue != null
            ? String(question.masterDataValue)
            : question.canonicalDisplayModel?.textSummary || "";
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
            const { applyManualOverride } = await import("@/actions/kyc-manual-update");
            const targetFieldId = question.masterFieldNo || (question as any).customFieldDefinitionId;
            if (!targetFieldId) return;
            const res = await applyManualOverride(leId, targetFieldId, editValue, "Inline edit");
            if (res.success) {
                onInlineEdit(editValue, "USER_INPUT", new Date());
                toast.success("Value updated");
            } else {
                showActionErrorToast(res, "Update failed");
            }
        } catch (err) {
            toast.error("Update failed");
        } finally {
            setIsSaving(false);
            setIsEditing(false);
        }
    };

    return (
        <TableRow className={cn(
            "hover:bg-muted/50 transition-colors group text-xs text-foreground",
            isPinned ? "bg-green-500/10 font-medium" : isMapped ? "bg-card" : "bg-muted/30"
        )}>
            {/* Cell 1: Status & Actions */}
            <TableCell className="py-2.5 px-3 align-top">
                <div className="flex flex-col gap-1.5">
                    <span className={cn(
                        "text-[9px] px-1.5 py-0.5 rounded tracking-normal font-semibold inline-block w-fit",
                        question.status === 'RELEASED' ? "bg-muted text-muted-foreground" :
                            question.status === 'SHARED' ? "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300" :
                                question.status === 'APPROVED' ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300" :
                                    question.status === 'DRAFT' ? "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300" :
                                        "bg-muted text-muted-foreground"
                    )}>
                        {isMapped ? question.status : 'UNMAPPED'}
                    </span>

                    {isMapped && (
                        <div>
                            {question.status === 'RELEASED' ? (
                                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                    <Lock className="h-3 w-3" /> Locked
                                </span>
                            ) : (
                                <div className="flex items-center gap-1">
                                    {question.status === 'DRAFT' && (
                                        <Button size="sm" variant="default" className="h-6 px-2 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white shadow-none" onClick={handleApprove} disabled={isActionPending}>
                                            <Check className="h-2.5 w-2.5 mr-0.5" /> Approve
                                        </Button>
                                    )}
                                    {question.status === 'APPROVED' && (
                                        <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 shadow-none" onClick={(e) => handleShare(e, true)} disabled={isActionPending}>
                                            <Share2 className="h-2.5 w-2.5 mr-0.5" /> Share
                                        </Button>
                                    )}
                                    {question.status === 'SHARED' && (
                                        <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] text-muted-foreground shadow-none border-border" onClick={(e) => handleShare(e, false)} disabled={isActionPending}>
                                            Unshare
                                        </Button>
                                    )}
                                    {(question.status === 'APPROVED' || question.status === 'SHARED') && (
                                        <Button size="sm" variant="secondary" className="h-6 px-2 text-[10px] bg-primary text-primary-foreground hover:bg-primary/90 shadow-none" onClick={handleRelease} disabled={isActionPending}>
                                            <Lock className="h-2.5 w-2.5 mr-0.5" /> Release
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </TableCell>

            {/* Cell 2: Relationship & Questionnaire */}
            <TableCell className="py-2.5 px-3 align-top">
                <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wide truncate max-w-[160px]" title={question.engagementOrgName || "Unknown Relationship"}>
                        <Building2 className="h-3 w-3 shrink-0" />
                        <span className="truncate">{question.engagementOrgName || "Unknown Relationship"}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-foreground truncate max-w-[160px]" title={question.questionnaireName}>
                        <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span className="truncate">{question.questionnaireName}</span>
                    </div>
                    {customFieldId && (
                        <div className="pt-0.5">
                            {isRenaming ? (
                                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                    <Input
                                        value={renameValue}
                                        onChange={(e) => setRenameValue(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleRenameSave();
                                            if (e.key === 'Escape') setIsRenaming(false);
                                        }}
                                        className="h-6 text-[10px] flex-1 px-1.5 bg-muted/50 border-border text-foreground"
                                        autoFocus
                                        disabled={isRenameSaving}
                                    />
                                    <Button variant="ghost" size="icon" className="h-5 w-5 text-green-600 dark:text-green-400" onClick={handleRenameSave} disabled={isRenameSaving}>
                                        <Check className="h-3 w-3" />
                                    </Button>
                                </div>
                            ) : (
                                <button
                                    className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                                    onClick={(e) => { e.stopPropagation(); handleRenameStart(); }}
                                >
                                    <Pencil className="h-2.5 w-2.5" /> Rename
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </TableCell>

            {/* Cell 3: Question */}
            <TableCell className="py-2.5 px-3 align-top">
                <div className="flex items-start gap-1.5 max-w-[320px]">
                    <span className="text-muted-foreground font-bold text-xs shrink-0">Q:</span>
                    <span className="text-xs font-medium text-foreground leading-snug">
                        {question.text}
                    </span>
                </div>
            </TableCell>

            {/* Cell 4: Answer Value & Details */}
            <TableCell className="py-2.5 px-3 align-top">
                <div className="space-y-1.5">
                    <div className="flex items-start gap-1.5">
                        <span className="text-indigo-600 dark:text-indigo-400 font-bold text-xs shrink-0">A:</span>
                        {isEditing ? (
                            <div className="flex items-center gap-1 w-full">
                                <Input
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSaveEdit();
                                        if (e.key === 'Escape') handleCancelEdit();
                                    }}
                                    className="text-xs h-7 flex-1 bg-muted/50 border-border text-foreground"
                                    autoFocus
                                    disabled={isSaving}
                                    placeholder="Enter value..."
                                />
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-green-600 dark:text-green-400" onClick={handleSaveEdit} disabled={isSaving}>
                                    <Check className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={handleCancelEdit} disabled={isSaving}>
                                    <X className="h-3 w-3" />
                                </Button>
                            </div>
                        ) : (
                            <div className="text-xs text-foreground bg-muted/50 px-2 py-1 rounded border border-border font-medium flex items-center gap-2 w-full">
                                <span className="flex-1 truncate">
                                    {question.masterQuestionGroupId && (question as any).masterDataGroupFields?.length > 0 ? (
                                        <GroupAnswerRenderer
                                            groupLabel=""
                                            fields={(question as any).masterDataGroupFields as GroupFieldData[]}
                                            raNameLookup={raNameLookup}
                                            displayStyle={question.masterDataGroupDisplayStyle}
                                            className="py-0"
                                        />
                                    ) : question.canonicalDisplayModel ? (
                                        <FieldValueRenderer field={question.canonicalDisplayModel} itemLimit={5} />
                                    ) : question.masterDataValue != null && question.masterDataValue !== '' ? (
                                        Array.isArray(question.masterDataValue) ? (
                                            question.masterDataValue.map((v: any) => formatAnswerValue(v)).join(", ")
                                        ) : typeof question.masterDataValue === 'object' ? (
                                            formatPartyLabel(question.masterDataValue)
                                        ) : (
                                            formatAnswerValue(question.masterDataValue)
                                        )
                                    ) : isMapped
                                        ? <span className="italic text-muted-foreground">No value yet</span>
                                        : <span className="italic text-muted-foreground/70">Map a field to enable answers</span>
                                    }
                                </span>

                                <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {!isGroupAnswer && !isComplexValue && !isProjectedValue && (
                                        <button
                                            onClick={handleStartEdit}
                                            disabled={!isMapped || question.status === 'RELEASED'}
                                            title="Edit value"
                                            className="p-1 rounded text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                                        >
                                            <Pencil className="h-3 w-3" />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => {
                                            const fNo = question.masterFieldNo || 0;
                                            const customId = (question as any).customFieldDefinitionId;
                                            onInspect(fNo, question.text, customId);
                                        }}
                                        title="View history & details"
                                        className="p-1 rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                                    >
                                        <PanelLeftOpen className="h-3 w-3" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {!isEditing && (
                        question.canonicalDisplayModel?.source ? (
                            <div className="flex items-center gap-2 pl-4 text-[10px]">
                                <FieldSourceBadge source={question.canonicalDisplayModel.source} showLastValidated={false} variant="span" />
                                {question.masterFieldNo && masterFields.find(f => f.fieldNo === question.masterFieldNo)?.attachmentCount ? (
                                    <FieldAttachmentIndicator count={masterFields.find(f => f.fieldNo === question.masterFieldNo)?.attachmentCount} />
                                ) : null}
                            </div>
                        ) : (question.masterDataSource || question.masterDataUpdatedAt) ? (
                            <div className="flex items-center gap-2 pl-4 text-[10px]">
                                <FieldSourceBadge legacySourceType={question.masterDataSource ?? undefined} legacyTimestamp={question.masterDataUpdatedAt} showLastValidated={false} variant="span" />
                            </div>
                        ) : null
                    )}
                </div>
            </TableCell>

            {/* Cell 5: Master Data Mapping */}
            <TableCell className="py-2.5 px-3 align-top">
                <div className="flex items-center gap-1.5 w-[240px]">
                    <div className="flex-1">
                        <SuperFieldSelector
                            value={
                                question.masterFieldNo
                                    ? `master:${question.masterFieldNo}${question.masterFieldProjectionPath ? `:${question.masterFieldProjectionPath}` : ''}`
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
                    </div>

                    {isMapped && question.status !== 'RELEASED' && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                            onClick={() => onMap("UNMAP")}
                            disabled={disabled}
                            title="Unmap field"
                        >
                            <Unlink className="h-3.5 w-3.5" />
                        </Button>
                    )}
                </div>
            </TableCell>
        </TableRow>
    );
}
