"use client";

import { useState, useEffect, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Save, FileText, Database, Link as LinkIcon, BookOpen, ScanSearch, Trash2, GitBranch, Plus, Edit } from "lucide-react";
import { updateMasterField } from "@/actions/master-data-governance";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getOptionSets } from "@/actions/master-data-option-sets";
import { upsertSourceMapping, deleteSourceMapping } from "@/actions/source-mappings";
import { upsertGraphBinding, deleteGraphBinding } from "@/actions/graph-bindings";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CategoryCombobox } from "./category-combobox";
import { DataInspectorPanel } from "@/components/client/admin/source-mappings/data-inspector-panel";
import { SOURCE_OPTIONS, getSourceDisplayName } from "@/lib/source-display";
import { SCALAR_UI_OPTIONS, REFERENCE_UI_OPTIONS, APP_DATA_TYPES } from "@/lib/master-data/field-types";
import { getComplexFieldConfig, getFieldTypeLabel, type GraphRelationshipCollectionConfig, type StructuredCollectionConfig } from "@/lib/master-data/complex-field-config";
import { getNodeFields, getDisplayableFields, getSearchableFields, type NodeType } from "@/lib/graph/node-field-registry";
import { type GraphPickerConfig } from "@/lib/graph/picker-config";
import { Checkbox } from "@/components/ui/checkbox";



interface FieldDetailSheetProps {
    field: any;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    categories: any[];
    /** All active source mappings across ALL master fields, enriched with fieldNo + fieldName. */
    allSourceMappings?: Array<{ sourceType: string; sourceReference?: string | null; sourcePath: string; fieldNo: number; fieldName: string; isActive: boolean }>;
}

export function FieldDetailSheet({ field, open, onOpenChange, categories=[], allSourceMappings=[] }: FieldDetailSheetProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [optionSets, setOptionSets] = useState<any[]>([]);

    // Stable refs to detect genuine field switches vs. prop re-renders caused by router.refresh()
    const prevFieldNoRef = useRef<number | null>(null);
    const prevOpenRef   = useRef<boolean>(false);

    useEffect(() => {
        if (open) {
            getOptionSets().then(res => {
                if (res.success) setOptionSets(res.optionSets || []);
            });
        }
    }, [open]);
    
    // Initialize form state
    const [formData, setFormData] = useState({
        fieldName: field?.fieldName || "",
        categoryId: field?.categoryId || "",
        newCategoryName: "",
        domain: field?.domain?.join(", ") || "",
        fmsbRef: field?.fmsbRef || "",
        description: field?.description || "",
        notes: field?.notes || "",
        isMultiValue: field?.isMultiValue || false,
        optionSetId: field?.optionSetId || "none",
        appDataType: field?.appDataType || "TEXT"
    });

    // Only reset the form when the panel opens fresh OR the user switches to a different
    // field (different fieldNo). Do NOT reset on every prop re-render caused by router.refresh() —
    // that was wiping unsaved edits while the DB write was still in-flight.
    useEffect(() => {
        const openingFresh   = open && !prevOpenRef.current;
        const switchingField = field && field.fieldNo !== prevFieldNoRef.current;

        if (field && (openingFresh || switchingField)) {
            setFormData({
                fieldName:       field.fieldName || "",
                categoryId:      field.categoryId || "",
                newCategoryName: "",
                domain:          field.domain?.join(", ") || "",
                fmsbRef:         field.fmsbRef || "",
                description:     field.description || "",
                notes:           field.notes || "",
                isMultiValue:    field.isMultiValue || false,
                optionSetId:     field.optionSetId || "none",
                appDataType:     field.appDataType || "TEXT",
            });
        }

        prevFieldNoRef.current = field?.fieldNo ?? null;
        prevOpenRef.current    = open;
    }, [field, open]);

    const [isAddMappingOpen, setIsAddMappingOpen] = useState(false);
    const [isBrowserOpen, setIsBrowserOpen] = useState(false);
    const [deletingMappingId, setDeletingMappingId] = useState<string | null>(null);
    const [editingPriorityId, setEditingPriorityId] = useState<string | null>(null);
    const [priorityValue, setPriorityValue] = useState<number>(0);
    const [isPrioritySaving, setIsPrioritySaving] = useState(false);
    const [mappingForm, setMappingForm] = useState({
        sourceType: "GLEIF",
        sourcePath: "",
        transformType: "DIRECT"
    });
    const [isMappingSaving, setIsMappingSaving] = useState(false);

    // ── Graph Binding state ────────────────────────────────────────────────
    const [isAddBindingOpen, setIsAddBindingOpen] = useState(false);
    const [deletingBindingId, setDeletingBindingId] = useState<string | null>(null);
    const [isBindingSaving, setIsBindingSaving] = useState(false);
    const [bindingForm, setBindingForm] = useState({
        graphNodeType: "PERSON" as "PERSON" | "LEGAL_ENTITY" | "ADDRESS",
        filterEdgeType: "",
        filterActiveOnly: true,
        writeBackEdgeType: "",
        writeBackIsActive: true,
        pickerLabel: "",
        allowCreate: true,
        // pickerConfig state — mirrors GraphPickerConfig shape
        displayFields:      [] as string[],
        subFields:          [] as string[],
        searchFields:       [] as string[],
        pickerPlaceholder:  "",
    });

    // Sources that support the live Browse inspector.
    const liveSourceTypes = SOURCE_OPTIONS
        .filter(o => o.supportsLiveBrowser)
        .map(o => o.value);

    const handleDeleteMapping = async (mappingId: string) => {
        setDeletingMappingId(mappingId);
        const res = await deleteSourceMapping(mappingId);
        setDeletingMappingId(null);
        if (res.success) {
            toast.success("Mapping removed");
            router.refresh();
        } else {
            toast.error(res.error || "Failed to remove mapping");
        }
    };

    const handleSaveMapping = async () => {
        if (!mappingForm.sourcePath.trim()) {
            toast.error("Source path is required");
            return;
        }
        setIsMappingSaving(true);
        try {
            // Resolve UI selection to backend sourceType + sourceReference.
            const selectedOption = SOURCE_OPTIONS.find(o => o.value === mappingForm.sourceType);
            if (!selectedOption) {
                toast.error("Please select a valid source");
                return;
            }
            const res = await upsertSourceMapping({
                sourceType: selectedOption.sourceType,
                sourceReference: selectedOption.sourceReference,
                sourcePath: mappingForm.sourcePath.trim(),
                targetFieldNo: field.fieldNo,
                transformType: mappingForm.transformType as any,
                confidenceDefault: 1.0,
                priority: 100
            });
            if (res.success) {
                toast.success("Mapping added successfully");
                setIsAddMappingOpen(false);
                setMappingForm({ sourceType: "GLEIF", sourcePath: "", transformType: "DIRECT" });
                router.refresh();
            } else {
                toast.error(res.error || "Failed to add mapping");
            }
        } catch (e) {
            toast.error("An error occurred adding the mapping");
        } finally {
            setIsMappingSaving(false);
        }
    };

    const handleSaveBinding = async () => {
        setIsBindingSaving(true);
        try {
            // Build pickerConfig from UI state.
            // sanitizePickerConfig() runs server-side inside upsertGraphBinding —
            // we just need to pass a well-formed object. Empty arrays are omitted
            // so the server stores null for fully-empty configs.
            const pickerConfigPayload: GraphPickerConfig = {};
            if (bindingForm.displayFields.length > 0)     pickerConfigPayload.displayFields     = bindingForm.displayFields;
            if (bindingForm.subFields.length > 0)          pickerConfigPayload.subFields          = bindingForm.subFields;
            if (bindingForm.searchFields.length > 0)       pickerConfigPayload.searchFields       = bindingForm.searchFields;
            if (bindingForm.pickerPlaceholder.trim())      pickerConfigPayload.pickerPlaceholder  = bindingForm.pickerPlaceholder.trim();

            const res = await upsertGraphBinding({
                fieldNo: field.fieldNo,
                graphNodeType: bindingForm.graphNodeType,
                filterEdgeType: bindingForm.filterEdgeType.trim() || null,
                filterActiveOnly: bindingForm.filterActiveOnly,
                writeBackEdgeType: bindingForm.writeBackEdgeType.trim() || null,
                writeBackIsActive: bindingForm.writeBackIsActive,
                pickerLabel: bindingForm.pickerLabel.trim() || null,
                allowCreate: bindingForm.allowCreate,
                pickerConfig: Object.keys(pickerConfigPayload).length > 0 ? pickerConfigPayload : null,
            });
            if (res.success) {
                toast.success("Graph binding saved");
                setIsAddBindingOpen(false);
                setBindingForm({
                    graphNodeType: "PERSON",
                    filterEdgeType: "", filterActiveOnly: true,
                    writeBackEdgeType: "", writeBackIsActive: true,
                    pickerLabel: "", allowCreate: true,
                    displayFields: [], subFields: [], searchFields: [], pickerPlaceholder: "",
                });
                router.refresh();
            } else {
                toast.error(res.error || "Failed to add binding");
            }
        } catch (e) {
            toast.error("An error occurred");
        } finally {
            setIsBindingSaving(false);
        }
    };

    const handleDeleteBinding = async (id: string) => {
        setDeletingBindingId(id);
        const res = await deleteGraphBinding(id);
        setDeletingBindingId(null);
        if (res.success) {
            toast.success("Binding removed");
            router.refresh();
        } else {
            toast.error(res.error || "Failed to remove binding");
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const domainsArray = formData.domain ? formData.domain.split(",").map((d: string) => d.trim()).filter(Boolean) : [];
            const payload: any = { 
                ...formData, 
                domain: domainsArray
            };
            if (payload.optionSetId === "none" || payload.appDataType !== APP_DATA_TYPES.SELECT) {
                payload.optionSetId = null;
            }
            // Only strip isMultiValue for scalar types that cannot be collections.
            // Reference types (PARTY_REF, ADDRESS_REF, etc.) support multi-value via
            // MasterFieldGraphBinding — preserve the flag so graph-backed list fields work.
            const multiValueTypes = [
                APP_DATA_TYPES.SELECT,
                APP_DATA_TYPES.JSONB,
                APP_DATA_TYPES.PARTY_REF,
                APP_DATA_TYPES.PERSON_REF,
                APP_DATA_TYPES.ORG_REF,
                APP_DATA_TYPES.ADDRESS_REF,
            ];
            if (!multiValueTypes.includes(payload.appDataType)) {
                payload.isMultiValue = false;
            }

            const res = await updateMasterField(field.fieldNo, payload);
            if (res.success) {
                toast.success("Field metadata updated successfully");
                router.refresh();
            } else {
                toast.error(res.error || "Failed to update field");
            }
        } catch (error) {
            toast.error("An error occurred");
        } finally {
            setLoading(false);
        }
    };

    if (!field) return null;

    // Computed once — used in both the sheet header badge and the Field Type Summary IIFE below.
    const complexHeaderCfg = getComplexFieldConfig(field.fieldNo);
    const isComplexForHeader = !!complexHeaderCfg;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-[750px] flex flex-col h-full bg-white dark:bg-slate-950">
                <SheetHeader className="pb-4 border-b border-slate-200">
                    <SheetTitle className="sr-only">{field.fieldName}</SheetTitle>
                    <SheetDescription className="sr-only">Details for {field.fieldName}</SheetDescription>
                    
                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-start justify-between">
                            <h2 className="text-xl font-bold text-slate-900 leading-tight">
                                {field.fieldName} <span className="text-slate-400 font-medium text-lg">({field.fieldNo})</span>
                            </h2>
                            <Badge variant="outline" className={field.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500"}>
                                {field.isActive ? "Active" : "Inactive"}
                            </Badge>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-1">
                            {field.masterDataCategory?.displayName && <Badge variant="secondary" className="bg-blue-50 text-blue-700 font-normal">{field.masterDataCategory.displayName}</Badge>}
                            {field.domain && field.domain.length > 0 && field.domain.map((d: string) => (
                                <Badge key={d} variant="secondary" className="bg-purple-50 text-purple-700 font-normal">{d}</Badge>
                            ))}
                            {/* For complex fields, show a business-facing label instead of the raw storage type */}
                            {isComplexForHeader
                                ? <Badge variant="outline" className="text-[11px] font-medium text-indigo-700 border-indigo-200 bg-indigo-50 self-center ml-2">{complexHeaderCfg!.label}</Badge>
                                : <span className="text-xs text-slate-500 font-mono self-center ml-2">{field.appDataType}</span>
                            }

                        </div>
                    </div>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto pt-6 pb-20 space-y-8 px-1">
                    
                    {/* ── Field Type Summary ──────────────────────────────── */}
                    {(() => {
                        const complexCfg = getComplexFieldConfig(field?.fieldNo);
                        const typeLabel  = getFieldTypeLabel(field?.fieldNo, field?.appDataType);

                        if (complexCfg && complexCfg.kind === 'GRAPH_RELATIONSHIP_COLLECTION') {
                            const cfg = complexCfg as GraphRelationshipCollectionConfig;
                            return (
                                <section className="rounded-lg border border-indigo-200 bg-indigo-50/60 p-4 space-y-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <GitBranch className="w-4 h-4 text-indigo-500 shrink-0" />
                                                <span className="text-sm font-semibold text-indigo-900">{cfg.label}</span>
                                                <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 text-[10px] font-medium">Graph relationship collection</Badge>
                                            </div>
                                            <p className="text-xs text-indigo-700 mt-1 leading-relaxed max-w-[480px]">{cfg.description}</p>
                                        </div>
                                    </div>
                                    {/* Technical detail strip */}
                                    <div className="flex flex-wrap gap-2 pt-1 border-t border-indigo-200">
                                        <span className="inline-flex items-center gap-1 text-[10px] text-indigo-600 bg-indigo-100 rounded px-2 py-0.5">
                                            <span className="font-medium">Stores</span> {cfg.graph.nodeType === 'PERSON' ? 'persons' : 'entities'}
                                        </span>
                                        <span className="inline-flex items-center gap-1 text-[10px] text-indigo-600 bg-indigo-100 rounded px-2 py-0.5">
                                            <span className="font-medium">Edge</span> {cfg.graph.edgeType}
                                        </span>
                                        <span className="inline-flex items-center gap-1 text-[10px] text-indigo-600 bg-indigo-100 rounded px-2 py-0.5">
                                            <span className="font-medium">Collection</span> {cfg.collectionId}
                                        </span>
                                        {cfg.temporal.filterByEffectiveDate && (
                                            <span className="inline-flex items-center gap-1 text-[10px] text-indigo-600 bg-indigo-100 rounded px-2 py-0.5">
                                                ⏱ Effective-date filtered
                                            </span>
                                        )}
                                        {cfg.sourceTransforms.map(t => (
                                            <span key={t.source} className="inline-flex items-center gap-1 text-[10px] text-indigo-600 bg-indigo-100 rounded px-2 py-0.5">
                                                <span className="font-medium">Source</span> {t.source} / {t.transformType}
                                            </span>
                                        ))}
                                    </div>
                                </section>
                            );
                        }

                        if (complexCfg && complexCfg.kind === 'STRUCTURED_COLLECTION') {
                            const cfg = complexCfg as StructuredCollectionConfig;
                            return (
                                <section className="rounded-lg border border-teal-200 bg-teal-50/60 p-4 space-y-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <GitBranch className="w-4 h-4 text-teal-500 shrink-0" />
                                                <span className="text-sm font-semibold text-teal-900">{cfg.label}</span>
                                                <Badge className="bg-teal-100 text-teal-700 border-teal-200 text-[10px] font-medium">Structured temporal collection</Badge>
                                            </div>
                                            <p className="text-xs text-teal-700 mt-1 leading-relaxed max-w-[480px]">{cfg.description}</p>
                                        </div>
                                    </div>
                                    {/* Field schema strip */}
                                    <div className="flex flex-wrap gap-2 pt-1 border-t border-teal-200">
                                        <span className="inline-flex items-center gap-1 text-[10px] text-teal-700 bg-teal-100 rounded px-2 py-0.5">
                                            <span className="font-medium">Collection</span> {cfg.collectionId}
                                        </span>
                                        {cfg.fields.map(f => (
                                            <span key={f.key} className="inline-flex items-center gap-1 text-[10px] text-teal-600 bg-teal-100 rounded px-2 py-0.5">
                                                <span className="font-medium">{f.label}</span>
                                                {f.required && <span className="text-teal-400">*</span>}
                                                <span className="text-teal-400 font-mono">{f.dataType}</span>
                                            </span>
                                        ))}
                                        {cfg.temporal && !cfg.temporal.filterByEffectiveDate && (
                                            <span className="inline-flex items-center gap-1 text-[10px] text-teal-600 bg-teal-100 rounded px-2 py-0.5">
                                                📋 Full history (no date filter)
                                            </span>
                                        )}
                                    </div>
                                </section>
                            );
                        }

                        // Simple field — just show an inline type badge
                        return (
                            <div className="flex items-center gap-2 pb-1">
                                <span className="text-xs text-slate-500">Field type:</span>
                                <Badge variant="outline" className="text-[11px] font-mono text-slate-700">{typeLabel}</Badge>
                                {field?.isMultiValue && (
                                    <Badge variant="outline" className="text-[10px] text-slate-500">Multi-value</Badge>
                                )}
                            </div>
                        );
                    })()}

                    {/* General Metadata Section */}
                    <section className="space-y-4">
                        <h3 className="text-sm font-semibold flex items-center gap-2 text-slate-800 border-b pb-2">
                            <Database className="w-4 h-4 text-slate-400" /> Core Metadata
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="fieldName" className="text-xs text-slate-500">Field Name</Label>
                                <Input
                                    id="fieldName"
                                    value={formData.fieldName}
                                    onChange={(e) => setFormData({ ...formData, fieldName: e.target.value })}
                                    className="bg-white"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label className="text-xs text-slate-500">Category</Label>
                                <CategoryCombobox 
                                    categories={categories}
                                    categoryId={formData.categoryId}
                                    newCategoryName={formData.newCategoryName}
                                    onSelectionChange={(id, name) => setFormData({...formData, categoryId: id, newCategoryName: name})}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="fmsbRef" className="text-xs text-slate-500">FMSB Ref.</Label>
                                <Input
                                    id="fmsbRef"
                                    value={formData.fmsbRef}
                                    placeholder="e.g. FMSB-01"
                                    onChange={(e) => setFormData({ ...formData, fmsbRef: e.target.value })}
                                    className="bg-white"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label className="text-xs text-slate-500">Data Type</Label>
                                {isComplexForHeader ? (
                                    // Complex fields: lock the storage type — changing it would break KycWriteService routing.
                                    // The true field type is defined in complex-field-config.ts, not this dropdown.
                                    <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-slate-200 bg-slate-50">
                                        <span className="text-xs font-mono text-slate-500">{field.appDataType}</span>
                                        <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 ml-auto">
                                            Managed by registry — do not change
                                        </span>
                                    </div>
                                ) : (
                                    <Select value={formData.appDataType} onValueChange={(val) => setFormData({ ...formData, appDataType: val })}>
                                        <SelectTrigger className="w-full bg-white">
                                            <SelectValue placeholder="Select Data Type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {SCALAR_UI_OPTIONS.map(opt => (
                                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                            ))}
                                            <div className="px-2 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-t mt-1 pt-2">
                                                Reference Types
                                            </div>
                                            {REFERENCE_UI_OPTIONS.map(opt => (
                                                <SelectItem key={opt.value} value={opt.value}>
                                                    <span>{opt.label}</span>
                                                    {opt.description && <span className="text-slate-400 text-[10px] ml-1">— {opt.description}</span>}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="domain" className="text-xs text-slate-500">Domain Classification</Label>
                                <Input
                                    id="domain"
                                    placeholder="e.g. Onboarding, Insurance Renewals, Compliance"
                                    value={formData.domain}
                                    onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                                    className="bg-white"
                                />
                            </div>

                            {formData.appDataType === APP_DATA_TYPES.SELECT && (
                                <>
                                    <div className="grid gap-2">
                                        <Label className="text-xs text-slate-500">Option Set</Label>
                                        <Select value={formData.optionSetId} onValueChange={(val) => setFormData({ ...formData, optionSetId: val })}>
                                            <SelectTrigger className="w-full bg-white">
                                                <SelectValue placeholder="Select Option Set" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">-- Select Option Set --</SelectItem>
                                                {optionSets.map(os => (
                                                    <SelectItem key={os.id} value={os.id}>{os.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </>
                            )}
                            <div className="grid gap-2 border rounded-md p-3 justify-center text-left max-w-[fit-content] h-[fit-content]">
                                <div className="flex flex-row gap-3 items-center">
                                    <div className="space-y-0.5">
                                        <Label className="text-xs text-slate-500 font-semibold cursor-pointer">Allow Multiple Values</Label>
                                    </div>
                                    <Switch
                                        checked={formData.isMultiValue}
                                        onCheckedChange={(val) => setFormData({ ...formData, isMultiValue: val })}
                                    />
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Documentation Section */}
                    <section className="space-y-4">
                        <h3 className="text-sm font-semibold flex items-center gap-2 text-slate-800 border-b pb-2">
                            <BookOpen className="w-4 h-4 text-slate-400" /> Documentation
                        </h3>
                        <div className="grid gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="description" className="text-xs text-slate-500 flex justify-between">
                                    <span>Public Description</span>
                                    <span className="text-[10px] text-slate-400 font-normal">Visible to users</span>
                                </Label>
                                <Textarea
                                    id="description"
                                    placeholder="Formal definition of what this field represents..."
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="min-h-[80px] bg-white resize-y"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="notes" className="text-xs text-slate-500 flex justify-between">
                                    <span>Private Admin Notes</span>
                                    <span className="text-[10px] text-slate-400 font-normal">Internal only</span>
                                </Label>
                                <Textarea
                                    id="notes"
                                    placeholder="Implementation details, gotchas, or legacy mapping notes..."
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    className="min-h-[80px] bg-yellow-50/30 border-yellow-200 resize-y"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end pt-2">
                            <Button onClick={handleSave} disabled={loading} size="sm" className="bg-indigo-600 hover:bg-indigo-700">
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Save Metadata Changes
                            </Button>
                        </div>
                    </section>

                    {/* Source Mappings Section */}
                    <section className="space-y-4">
                        <div className="flex items-center justify-between border-b pb-2">
                            <h3 className="text-sm font-semibold flex items-center gap-2 text-slate-800">
                                <LinkIcon className="w-4 h-4 text-slate-400" /> Source Mappings
                            </h3>
                            <Dialog open={isAddMappingOpen} onOpenChange={setIsAddMappingOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-7 text-xs">Add Mapping</Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-[425px]">
                                    <DialogHeader>
                                        <DialogTitle>Add Source Mapping</DialogTitle>
                                        <DialogDescription>
                                            Connect an incoming payload path to this master field automatically.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="grid gap-4 py-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="sourceType">Source Type</Label>
                                            <Select value={mappingForm.sourceType} onValueChange={(val) => setMappingForm({ ...mappingForm, sourceType: val })}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select type" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {SOURCE_OPTIONS.map(opt => (
                                                        <SelectItem key={opt.value} value={opt.value}>
                                                            {opt.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="grid gap-2">
                                             <Label htmlFor="sourcePath">JSON Path</Label>
                                             <div className="flex gap-2">
                                                 <Input
                                                     id="sourcePath"
                                                     value={mappingForm.sourcePath}
                                                     onChange={(e) => setMappingForm({ ...mappingForm, sourcePath: e.target.value })}
                                                     placeholder="e.g. entity.legalName.name"
                                                     className="font-mono text-sm flex-1"
                                                 />
                                                 {liveSourceTypes.includes(mappingForm.sourceType) && (
                                                     <Button
                                                         type="button"
                                                         variant="outline"
                                                         size="sm"
                                                         className="shrink-0 h-9 gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                                                         onClick={() => setIsBrowserOpen(true)}
                                                     >
                                                         <ScanSearch className="h-3.5 w-3.5" />
                                                         Browse
                                                     </Button>
                                                 )}
                                             </div>
                                             <p className="text-[10px] text-slate-400">Dot-notation path into the source JSON, or click Browse to pick visually.</p>
                                         </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="transformType">Transform Type</Label>
                                            <Select value={mappingForm.transformType} onValueChange={(val) => setMappingForm({ ...mappingForm, transformType: val })}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select transform" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="DIRECT">Direct (String/Number)</SelectItem>
                                                    <SelectItem value="DATE_TO_ISO">Date to ISO String</SelectItem>
                                                    <SelectItem value="EXTRACT">Extract Nested Payload</SelectItem>
                                                    <SelectItem value="MAP">Map Dictionary</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button onClick={handleSaveMapping} disabled={isMappingSaving}>
                                            {isMappingSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Save Mapping
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>

                            {/* Live Data Browser — secondary dialog triggered from Browse button */}
                            <Dialog open={isBrowserOpen} onOpenChange={setIsBrowserOpen}>
                                <DialogContent className="sm:max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden gap-0">
                                    <DialogHeader className="px-6 py-4 border-b border-slate-200 shrink-0">
                                        <DialogTitle className="flex items-center gap-2 text-sm">
                                            <ScanSearch className="h-4 w-4 text-blue-500" />
                                            Browse {SOURCE_OPTIONS.find(o => o.value === mappingForm.sourceType)?.label || mappingForm.sourceType} Schema
                                        </DialogTitle>
                                        <DialogDescription className="text-xs">
                                            Fetch a live record, then click <span className="font-semibold text-blue-600">⊕ Add</span> on any field to use it as the source path.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="flex-1 overflow-hidden p-4">
                                        <DataInspectorPanel
                                            sourceType={
                                                // DataInspectorPanel expects the backend SourceType string
                                                SOURCE_OPTIONS.find(o => o.value === mappingForm.sourceType)?.sourceType
                                                || mappingForm.sourceType
                                            }
                                            sourceReference={
                                                SOURCE_OPTIONS.find(o => o.value === mappingForm.sourceType)?.sourceReference
                                            }
                                            existingMappings={field.sourceMappings || []}
                                            allSourceMappings={allSourceMappings}
                                            currentFieldNo={field.fieldNo}
                                            readOnly={false}
                                            onSelectPath={(path) => {
                                                setMappingForm(f => ({ ...f, sourcePath: path }));
                                                setIsBrowserOpen(false);
                                            }}
                                        />
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </div>
                        
                        {field.sourceMappings && field.sourceMappings.length > 0 ? (
                            <div className="space-y-2">
                                {field.sourceMappings.sort((a: any, b: any) => (a.priority || 0) - (b.priority || 0)).map((mapping: any) => (
                                    <div key={mapping.id} className="bg-white border rounded-md p-3 text-sm flex items-center justify-between group">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <Badge variant="outline" className="bg-slate-50 shrink-0">
                                                {getSourceDisplayName(mapping.sourceType, mapping.sourceReference)}
                                            </Badge>
                                            <span className="font-mono text-xs text-slate-600 truncate" title={mapping.sourcePath}>
                                                {mapping.sourcePath}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0 ml-3">
                                            <span className="text-xs text-slate-400">{mapping.transformType}</span>

{editingPriorityId === mapping.id ? (
  <div className="flex items-center gap-2">
    <Input
      type="number"
      min={1}
      value={priorityValue}
      onChange={(e) => setPriorityValue(parseInt(e.target.value, 10) || 0)}
      className="w-16"
    />
    <Button variant="outline" size="sm" onClick={() => setEditingPriorityId(null)} disabled={isPrioritySaving}>Cancel</Button>
    <Button size="sm" onClick={async () => {
      setIsPrioritySaving(true);
      const res = await upsertSourceMapping({
        id: mapping.id,
        sourceType: mapping.sourceType,
        sourcePath: mapping.sourcePath,
        targetFieldNo: field.fieldNo,
        priority: priorityValue,
      });
      setIsPrioritySaving(false);
      if (res.success) {
        toast.success('Priority updated');
        router.refresh();
        setEditingPriorityId(null);
      } else {
        toast.error(res.error ?? 'Failed to update priority');
      }
    }} disabled={isPrioritySaving}>Save</Button>
  </div>
) : (
  <>
    <Badge variant={mapping.isActive ? "default" : "secondary"} className={mapping.isActive ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : ""}>
      {mapping.priority}
    </Badge>
    <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-primary" onClick={() => { setEditingPriorityId(mapping.id); setPriorityValue(mapping.priority); }}>
      <Edit className="h-3 w-3" />
    </Button>
  </>
)}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-slate-300 hover:text-red-500 hover:bg-red-50"
                      disabled={deletingMappingId === mapping.id}
                      onClick={() => handleDeleteMapping(mapping.id)}
                      title="Remove mapping"
                    >
                      {deletingMappingId === mapping.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 border border-dashed rounded-lg bg-white">
                                <FileText className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                                <p className="text-sm text-slate-500 font-medium">No source mappings</p>
                                <p className="text-xs text-slate-400 max-w-[250px] mx-auto mt-1">This field is entirely manually populated with no automated sourcing.</p>
                            </div>
                        )}
                    </section>

                    {/* Graph Binding Section */}
                    <section className="space-y-4">
                        <div className="flex items-center justify-between border-b pb-2">
                            <div>
                                <h3 className="text-sm font-semibold flex items-center gap-2 text-slate-800">
                                    <GitBranch className="w-4 h-4 text-slate-400" /> Graph Node Binding
                                </h3>
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                    Declares that this field&apos;s answer is drawn from — and optionally written back to — the LE Graph.
                                </p>
                            </div>
                            <Dialog open={isAddBindingOpen} onOpenChange={setIsAddBindingOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-7 text-xs shrink-0">
                                        <Plus className="h-3 w-3 mr-1" /> Add Binding
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-[480px]">
                                    <DialogHeader>
                                        <DialogTitle>Add Graph Node Binding</DialogTitle>
                                        <DialogDescription>
                                            Connect this field to the LE Graph so answers are drawn from graph nodes and optionally write back edges.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="grid gap-4 py-4">
                                        <div className="grid gap-2">
                                            <Label>Graph Node Type</Label>
                                            <Select
                                                value={bindingForm.graphNodeType}
                                                onValueChange={(v) => setBindingForm({ ...bindingForm, graphNodeType: v as any })}
                                            >
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="PERSON">Person</SelectItem>
                                                    <SelectItem value="LEGAL_ENTITY">Legal Entity</SelectItem>
                                                    <SelectItem value="ADDRESS">Address</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="grid gap-2">
                                                <Label className="text-xs">Filter Edge Type <span className="text-slate-400">(optional)</span></Label>
                                                <Input
                                                    value={bindingForm.filterEdgeType}
                                                    onChange={(e) => setBindingForm({ ...bindingForm, filterEdgeType: e.target.value })}
                                                    placeholder="e.g. DIRECTOR"
                                                    className="font-mono text-sm"
                                                />
                                                <p className="text-[10px] text-slate-400">Legacy edge hint — not currently used by picker ordering.</p>
                                            </div>
                                            <div className="grid gap-2">
                                                <Label className="text-xs">Write-back Edge Type <span className="text-slate-400">(optional)</span></Label>
                                                <Input
                                                    value={bindingForm.writeBackEdgeType}
                                                    onChange={(e) => setBindingForm({ ...bindingForm, writeBackEdgeType: e.target.value })}
                                                    placeholder="e.g. DIRECTOR"
                                                    className="font-mono text-sm"
                                                />
                                                <p className="text-[10px] text-slate-400">Graph edge type to assert on selection.</p>
                                            </div>
                                        </div>
                                        <div className="grid gap-2">
                                            <Label className="text-xs">Picker Label <span className="text-slate-400">(optional)</span></Label>
                                            <Input
                                                value={bindingForm.pickerLabel}
                                                onChange={(e) => setBindingForm({ ...bindingForm, pickerLabel: e.target.value })}
                                                placeholder="e.g. Select a Director"
                                            />
                                        </div>
                                        <div className="flex gap-6">
                                            <div className="flex items-center gap-2">
                                                <Switch
                                                    checked={bindingForm.filterActiveOnly}
                                                    onCheckedChange={(v) => setBindingForm({ ...bindingForm, filterActiveOnly: v })}
                                                />
                                                <Label className="text-xs cursor-pointer">Active nodes only</Label>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Switch
                                                    checked={bindingForm.allowCreate}
                                                    onCheckedChange={(v) => setBindingForm({ ...bindingForm, allowCreate: v })}
                                                />
                                                <Label className="text-xs cursor-pointer">Allow inline creation</Label>
                                            </div>
                                        </div>

                                        {/* ── Picker Configuration ────────────────────────────────── */}
                                        <div className="border-t pt-4 grid gap-4">
                                            <div>
                                                <h4 className="text-xs font-semibold text-slate-700 mb-0.5">Picker Configuration</h4>
                                                <p className="text-[10px] text-slate-400">
                                                    Controls how nodes are displayed and searched in this field&apos;s picker.
                                                    Leave empty to use default display.
                                                </p>
                                            </div>

                                            {/* Display Fields */}
                                            <div className="grid gap-1.5">
                                                <Label className="text-xs font-medium">Display Fields</Label>
                                                <p className="text-[10px] text-slate-400">Used as the main label shown in picker results.</p>
                                                <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 p-2 border rounded-md bg-slate-50">
                                                    {getDisplayableFields(bindingForm.graphNodeType as NodeType).map(f => (
                                                        <label key={f.fieldKey} className="flex items-center gap-2 cursor-pointer select-none">
                                                            <Checkbox
                                                                id={`display-${f.fieldKey}`}
                                                                checked={bindingForm.displayFields.includes(f.fieldKey)}
                                                                onCheckedChange={(checked) => {
                                                                    setBindingForm(prev => ({
                                                                        ...prev,
                                                                        displayFields: checked
                                                                            ? [...prev.displayFields, f.fieldKey]
                                                                            : prev.displayFields.filter(k => k !== f.fieldKey)
                                                                    }));
                                                                }}
                                                            />
                                                            <span className="text-xs text-slate-700">{f.label}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Secondary (sub) Fields */}
                                            <div className="grid gap-1.5">
                                                <Label className="text-xs font-medium">Secondary Fields</Label>
                                                <p className="text-[10px] text-slate-400">Shown beneath the main label in each picker row.</p>
                                                <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 p-2 border rounded-md bg-slate-50">
                                                    {getDisplayableFields(bindingForm.graphNodeType as NodeType).map(f => (
                                                        <label key={f.fieldKey} className="flex items-center gap-2 cursor-pointer select-none">
                                                            <Checkbox
                                                                id={`sub-${f.fieldKey}`}
                                                                checked={bindingForm.subFields.includes(f.fieldKey)}
                                                                onCheckedChange={(checked) => {
                                                                    setBindingForm(prev => ({
                                                                        ...prev,
                                                                        subFields: checked
                                                                            ? [...prev.subFields, f.fieldKey]
                                                                            : prev.subFields.filter(k => k !== f.fieldKey)
                                                                    }));
                                                                }}
                                                            />
                                                            <span className="text-xs text-slate-700">{f.label}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Search Fields — only isSearchable fields shown */}
                                            <div className="grid gap-1.5">
                                                <Label className="text-xs font-medium">Search Fields</Label>
                                                <p className="text-[10px] text-slate-400">Additional fields matched during search. Only searchable fields shown.</p>
                                                <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 p-2 border rounded-md bg-slate-50">
                                                    {getSearchableFields(bindingForm.graphNodeType as NodeType).map(f => (
                                                        <label key={f.fieldKey} className="flex items-center gap-2 cursor-pointer select-none">
                                                            <Checkbox
                                                                id={`search-${f.fieldKey}`}
                                                                checked={bindingForm.searchFields.includes(f.fieldKey)}
                                                                onCheckedChange={(checked) => {
                                                                    setBindingForm(prev => ({
                                                                        ...prev,
                                                                        searchFields: checked
                                                                            ? [...prev.searchFields, f.fieldKey]
                                                                            : prev.searchFields.filter(k => k !== f.fieldKey)
                                                                    }));
                                                                }}
                                                            />
                                                            <span className="text-xs text-slate-700">{f.label}</span>
                                                        </label>
                                                    ))}
                                                    {getSearchableFields(bindingForm.graphNodeType as NodeType).length === 0 && (
                                                        <p className="text-[10px] text-slate-400 col-span-2">No searchable fields for this node type.</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Picker Placeholder */}
                                            <div className="grid gap-1.5">
                                                <Label className="text-xs font-medium">Picker Placeholder <span className="text-slate-400">(optional)</span></Label>
                                                <p className="text-[10px] text-slate-400">Custom placeholder shown in the picker search box.</p>
                                                <Input
                                                    value={bindingForm.pickerPlaceholder}
                                                    onChange={(e) => setBindingForm({ ...bindingForm, pickerPlaceholder: e.target.value })}
                                                    placeholder="e.g. Search beneficiaries..."
                                                />
                                            </div>
                                        </div>

                                    </div>
                                    <DialogFooter>
                                        <Button onClick={handleSaveBinding} disabled={isBindingSaving}>
                                            {isBindingSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Save Binding
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>

                        {field.graphBindings && field.graphBindings.length > 0 ? (
                            <div className="space-y-2">
                                {field.graphBindings.map((b: any) => (
                                    <div key={b.id} className="bg-white border rounded-md p-3 text-sm flex items-center justify-between group">
                                        <div className="flex items-center gap-3 flex-wrap min-w-0">
                                            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 shrink-0">
                                                {b.graphNodeType}
                                            </Badge>
                                            {b.filterEdgeType && (
                                                <span className="text-xs text-slate-500 font-mono">filter: <span className="text-slate-700">{b.filterEdgeType}</span></span>
                                            )}
                                            {b.writeBackEdgeType && (
                                                <span className="text-xs text-slate-500 font-mono">write-back: <span className="text-emerald-700">{b.writeBackEdgeType}</span></span>
                                            )}
                                            {b.pickerLabel && (
                                                <span className="text-xs text-slate-400 italic">&ldquo;{b.pickerLabel}&rdquo;</span>
                                            )}
                                            {b.pickerConfig && (
                                                <Badge variant="secondary" className="text-[10px] py-0 bg-indigo-50 text-indigo-600 border border-indigo-100">
                                                    configured
                                                </Badge>
                                            )}
                                            <div className="flex gap-2">
                                                {b.filterActiveOnly && <Badge variant="secondary" className="text-[10px] py-0">Active only</Badge>}
                                                {b.allowCreate && <Badge variant="secondary" className="text-[10px] py-0">Allow create</Badge>}
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-slate-300 hover:text-red-500 hover:bg-red-50 shrink-0 ml-3"
                                            disabled={deletingBindingId === b.id}
                                            onClick={() => handleDeleteBinding(b.id)}
                                            title="Remove binding"
                                        >
                                            {deletingBindingId === b.id
                                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                : <Trash2 className="h-3.5 w-3.5" />}
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-6 border border-dashed rounded-lg bg-white">
                                <GitBranch className="w-7 h-7 text-slate-200 mx-auto mb-2" />
                                <p className="text-sm text-slate-500 font-medium">No graph bindings</p>
                                <p className="text-xs text-slate-400 max-w-[260px] mx-auto mt-1">
                                    This field is answered via free-form input. Add a binding to connect it to the LE Knowledge Graph.
                                </p>
                            </div>
                        )}
                    </section>
                </div>
            </SheetContent>
        </Sheet>
    );
}
