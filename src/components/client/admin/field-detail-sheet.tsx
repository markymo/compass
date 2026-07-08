"use client";

import { useState, useEffect, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import Link from "next/link";
import { ChevronRight, Database, Edit, Save, BookOpen, FileText, Globe, Link as LinkIcon, Trash2, GitBranch, Plus, Loader2, ScanSearch, Users, Check } from "lucide-react";
import { updateMasterField, checkCustomFieldDependencies, softDeleteCustomField, DependencyReport } from "@/actions/master-data-governance";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TRANSFORM_SELECT_OPTIONS, getTransformDescription } from "@/lib/master-data/transform-registry";
import { getOptionSets } from "@/actions/master-data-option-sets";
import { upsertSourceMapping, deleteSourceMapping } from "@/actions/source-mappings";
import { upsertGraphBinding, deleteGraphBinding } from "@/actions/graph-bindings";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CategoryCombobox } from "./category-combobox";
import { DataInspectorPanel } from "@/components/client/admin/source-mappings/data-inspector-panel";
import { AddressFieldSourceMappingModal } from "@/components/client/admin/source-mappings/address-field-source-mapping-modal";
import { MappingFormDialog } from "@/components/client/admin/source-mappings/mapping-form-dialog";
import { ExpandableText } from "@/components/ui/expandable-text";
import { SOURCE_OPTIONS, getSourceDisplayName } from "@/lib/source-display";
import { getEffectiveMappingDefaults } from "@/actions/user-preferences";
import { SCALAR_UI_OPTIONS, REFERENCE_UI_OPTIONS, APP_DATA_TYPES } from "@/lib/master-data/field-types";
import { getComplexFieldConfig, getFieldTypeLabel, type GraphRelationshipCollectionConfig, type StructuredCollectionConfig } from "@/lib/master-data/complex-field-config";
import { getNodeFields, getDisplayableFields, getSearchableFields, type NodeType } from "@/lib/graph/node-field-registry";
import { type GraphPickerConfig, type ProjectionMode, getDefaultProjectionFields } from "@/lib/graph/picker-config";
import { bindingToBindingForm, bindingFormToPickerConfig, BLANK_BINDING_FORM } from "@/lib/graph/binding-form-helpers";
import { Checkbox } from "@/components/ui/checkbox";

const PARTY_TYPES = ['INDIVIDUAL', 'ORGANISATION', 'UNKNOWN'];
const PARTY_SUBTYPES = ['PERSON', 'CONTACT', 'COMPANY', 'TRUST', 'FUND', 'PARTNERSHIP', 'GOVERNMENT_BODY', 'TEAM', 'DISTRIBUTION_LIST', 'OTHER'];
const SCHEMA_GROUPS = [
    {
        label: 'Identity',
        fields: [
            { path: 'title', label: 'Title' },
            { path: 'forenames', label: 'Forenames' },
            { path: 'surname', label: 'Surname' },
            { path: 'organisationName', label: 'Organisation Name' },
            { path: 'partyType', label: 'Party Type' },
            { path: 'partySubType', label: 'Party Subtype' },
            { path: 'contactType', label: 'Contact Type' },
            { path: 'fullName', label: 'Full name (derived)', deEmphasise: true }
        ]
    },
    {
        label: 'Date of Birth',
        fields: [
            { path: 'dateOfBirth.year', label: 'Year' },
            { path: 'dateOfBirth.month', label: 'Month' },
            { path: 'dateOfBirth.day', label: 'Day' },
        ]
    },
    {
        label: 'Location / Personal Details',
        fields: [
            { path: 'nationality', label: 'Nationality' },
            { path: 'countryOfResidence', label: 'Country of Residence' },
            { path: 'placeOfBirth', label: 'Place of Birth' },
            { path: 'correspondenceAddress', label: 'Correspondence Address' },
        ]
    },
    {
        label: 'Contact',
        fields: [
            { path: 'email', label: 'Email' },
            { path: 'phones', label: 'Phones' },
        ]
    },
    {
        label: 'Role Context',
        fields: [
            { path: 'roles[0].roleTitle', label: 'Role Title' },
            { path: 'roles[0].roleType', label: 'Role Type' },
            { path: 'roles[0].appointedOn', label: 'Appointed On' },
            { path: 'roles[0].resignedOn', label: 'Resigned On' },
            { path: 'roles[0].isActiveRole', label: 'Is Active Role' },
            { path: 'roles[0].natureOfControl', label: 'Nature of Control' },
        ]
    }
];

interface FieldDetailSheetProps {
    field: any;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    categories: any[];
    /** All active source mappings across ALL master fields, enriched with fieldNo + fieldName. */
    allSourceMappings?: Array<{ sourceType: string; sourceReference?: string | null; sourcePath: string; fieldNo: number; fieldName: string; isActive: boolean }>;
    fieldDefinitions?: any[];
}

export function FieldDetailSheet({ field, open, onOpenChange, categories=[], allSourceMappings=[], fieldDefinitions=[] }: FieldDetailSheetProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [optionSets, setOptionSets] = useState<any[]>([]);

    // Stable refs to detect genuine field switches vs. prop re-renders caused by router.refresh()
    const prevFieldNoRef = useRef<number | null>(null);
    const prevOpenRef   = useRef<boolean>(false);

    const [resolvedDefaults, setResolvedDefaults] = useState<any>(null);

    useEffect(() => {
        if (open) {
            getOptionSets().then(res => {
                if (res.success) setOptionSets(res.optionSets || []);
            });
            getEffectiveMappingDefaults().then((res) => {
                setResolvedDefaults({
                    gleifLei: res.gleifLei || "213800SN8QHYGA7QUF79",
                    chCompanyNo: res.registryOverrides?.RA000585?.registeredAs || "14059418",
                    frSiren: res.registryOverrides?.RA000192?.registeredAs || "542051180"
                });
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
        defaultResponse: field?.defaultResponse || "",
        isMultiValue: field?.isMultiValue || false,
        optionSetId: field?.optionSetId || "none",
        appDataType: field?.appDataType || "TEXT",
        profileConfig: field?.profileConfig || null
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
                defaultResponse: field.defaultResponse || "",
                isMultiValue:    field.isMultiValue || false,
                optionSetId:     field.optionSetId || "none",
                appDataType:     field.appDataType || "TEXT",
                profileConfig:   field.profileConfig || null,
            });
        }

        prevFieldNoRef.current = field?.fieldNo ?? null;
        prevOpenRef.current    = open;
    }, [field, open]);

    const [isAddMappingOpen, setIsAddMappingOpen] = useState(false);
    const [isAddressMappingModalOpen, setIsAddressMappingModalOpen] = useState(false);
    const [isBrowserOpen, setIsBrowserOpen] = useState(false);
    const [deletingMappingId, setDeletingMappingId] = useState<string | null>(null);
    const [editingMapping, setEditingMapping] = useState<any | null>(null);
    const [mappingForm, setMappingForm] = useState<{
        sourceType: string;
        sourcePath: string;
        transformType: string;
        mappingScope: string;
        payloadSubtype: string;
        transformConfig?: any;
    }>({
        sourceType: "GLEIF",
        sourcePath: "",
        transformType: "DIRECT",
        mappingScope: "BASELINE",
        payloadSubtype: "NONE",
        transformConfig: null,
    });
    const [isMappingSaving, setIsMappingSaving] = useState(false);

    // ── Graph Binding state ────────────────────────────────────────────────
    const [isAddBindingOpen, setIsAddBindingOpen] = useState(false);
    /** null = add mode; string = id of binding being edited */
    const [editingBindingId, setEditingBindingId] = useState<string | null>(null);

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isCheckingDependencies, setIsCheckingDependencies] = useState(false);
    const [dependencyReport, setDependencyReport] = useState<DependencyReport | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const openDeleteDialog = async () => {
        setIsDeleteDialogOpen(true);
        setIsCheckingDependencies(true);
        setDependencyReport(null);
        try {
            const report = await checkCustomFieldDependencies(field!.customFieldId!);
            setDependencyReport(report);
        } catch (e) {
            toast.error("Failed to check dependencies");
            setIsDeleteDialogOpen(false);
        } finally {
            setIsCheckingDependencies(false);
        }
    };

    const confirmDelete = async () => {
        setIsDeleting(true);
        try {
            const res = await softDeleteCustomField(field!.customFieldId!);
            if (res.success) {
                toast.success("Field deleted");
                setIsDeleteDialogOpen(false);
                onOpenChange(false);
                router.refresh();
            } else {
                toast.error(res.error || "Failed to delete field");
            }
        } catch (e) {
            toast.error("An error occurred");
        } finally {
            setIsDeleting(false);
        }
    };

    const [deletingBindingId, setDeletingBindingId] = useState<string | null>(null);
    const [isBindingSaving, setIsBindingSaving] = useState(false);
    const [bindingForm, setBindingForm] = useState(BLANK_BINDING_FORM);

    const openEditBinding = (b: any) => {
        setBindingForm(bindingToBindingForm(b));
        setEditingBindingId(b.id);
        setIsAddBindingOpen(true);
    };

    const closeBindingDialog = (open: boolean) => {
        setIsAddBindingOpen(open);
        if (!open) {
            // Reset form and mode when dialog closes (cancel or backdrop click)
            setEditingBindingId(null);
            setBindingForm(BLANK_BINDING_FORM);
        }
    };

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
                transformConfig: mappingForm.transformConfig || null,
                confidenceDefault: 1.0,
                priority: 100,
                // Scope is resolved here so the action-layer default is a fallback,
                // not the primary decision point. For RA sources we default to
                // RAW_PAYLOAD/COMPANY_PROFILE; for GLEIF we leave scope as BASELINE
                // (GleifNormalizer ignores it anyway).
                mappingScope: mappingForm.mappingScope as any,
                payloadSubtype: (mappingForm.payloadSubtype === 'NONE' || !mappingForm.payloadSubtype)
                    ? null
                    : mappingForm.payloadSubtype as any,
            });
            if (res.success) {
                toast.success("Mapping added successfully");
                setIsAddMappingOpen(false);
                setMappingForm({ sourceType: "GLEIF", sourcePath: "", transformType: "DIRECT", mappingScope: "BASELINE", payloadSubtype: "NONE", transformConfig: null });
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
            const res = await upsertGraphBinding({
                // Pass id when editing — server action branches to update vs. create
                ...(editingBindingId ? { id: editingBindingId } : {}),
                fieldNo: field.fieldNo,
                graphNodeType: bindingForm.graphNodeType,
                filterEdgeType: bindingForm.filterEdgeType.trim() || null,
                filterActiveOnly: bindingForm.filterActiveOnly,
                writeBackEdgeType: bindingForm.writeBackEdgeType.trim() || null,
                writeBackIsActive: bindingForm.writeBackIsActive,
                pickerLabel: bindingForm.pickerLabel.trim() || null,
                allowCreate: bindingForm.allowCreate,
                // bindingFormToPickerConfig prunes empty arrays; server re-sanitizes
                pickerConfig: bindingFormToPickerConfig(bindingForm),
            });
            if (res.success) {
                toast.success(editingBindingId ? "Binding updated" : "Graph binding saved");
                setIsAddBindingOpen(false);
                setEditingBindingId(null);
                setBindingForm(BLANK_BINDING_FORM);
                router.refresh();
            } else {
                toast.error(res.error || (editingBindingId ? "Failed to update binding" : "Failed to add binding"));
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
            if (payload.appDataType === 'PARTY') {
                payload.profileConfig = {
                    ...(field.profileConfig || {}), // preserve existing like storageModes
                    ...(formData.profileConfig || {}) // override with edited options
                };
            }
            // Strip isMultiValue only for types where a collection makes no semantic sense.
            // TEXT, NUMBER, JSONB, SELECT, and all reference types CAN be multi-value
            // (e.g. trading names, SIC codes, directors). Only BOOLEAN, DATETIME, and
            // DOCUMENT_REF have no meaningful collection interpretation.
            const noMultiValueTypes = [
                APP_DATA_TYPES.BOOLEAN,
                APP_DATA_TYPES.DATETIME,
                APP_DATA_TYPES.DOCUMENT_REF,
                APP_DATA_TYPES.ADDRESS,
            ];
            if (noMultiValueTypes.includes(payload.appDataType)) {
                payload.isMultiValue = false;
            }

            const res = await updateMasterField(field.fieldNo, payload);
            if (res.success) {
                toast.success("Field metadata updated successfully");
                onOpenChange(false);
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
                            {field.fieldNo === 0 && field.customFieldId && (
                                <Button variant="ghost" size="icon" onClick={openDeleteDialog} className="text-slate-400 hover:text-red-600 hover:bg-red-50" title="Delete Custom Field">
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-2 mt-1">
                            {field.masterDataCategory?.displayName && <Badge variant="secondary" className="bg-blue-50 text-blue-700 font-normal">{field.masterDataCategory.displayName}</Badge>}
                            {field.domain && field.domain.length > 0 && field.domain.map((d: string) => (
                                <Badge key={d} variant="secondary" className="bg-purple-50 text-purple-700 font-normal">{d}</Badge>
                            ))}
                            {/* For complex fields, show a business-facing label instead of the raw storage type */}
                            {isComplexForHeader && field.appDataType !== 'PARTY'
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
                        const isParty = field?.appDataType === 'PARTY';
                        const typeLabel  = (complexCfg && !isParty) ? getFieldTypeLabel(field?.fieldNo, field?.appDataType) : (field?.appDataType || '');

                        if (complexCfg && complexCfg.kind === 'GRAPH_RELATIONSHIP_COLLECTION' && !isParty) {
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
                                            <ExpandableText text={cfg.description} maxLines={4} textClassName="text-xs text-indigo-700 mt-1 leading-relaxed max-w-[480px]" />
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

                        if (complexCfg && complexCfg.kind === 'STRUCTURED_COLLECTION' && !isParty) {
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
                                            <ExpandableText text={cfg.description} maxLines={4} textClassName="text-xs text-teal-700 mt-1 leading-relaxed max-w-[480px]" />
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

                    {/* Party Profile Section */}
                    {formData.appDataType === 'PARTY' && (
                        <section className="rounded-lg border border-indigo-200 bg-indigo-50/60 p-4 space-y-4">
                            <div className="flex items-center gap-2 border-b border-indigo-200 pb-2">
                                <span className="text-sm font-semibold text-indigo-900">PARTY Field Profile</span>
                                <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 text-[10px] font-medium">Schema Constraints</Badge>
                            </div>
                            
                            <div className="space-y-4">
                                <div>
                                    <Label className="text-xs font-semibold text-indigo-900 mb-2 block">Party value source</Label>
                                    <p className="text-[11px] text-slate-500 mb-2">Where are parties for this field allowed to come from?</p>
                                    <div className="flex flex-col gap-2">
                                        {[
                                            { value: 'SYSTEM_ONLY', label: 'Source only' },
                                            { value: 'CURATED_ONLY', label: 'Curated only' },
                                            { value: 'SYSTEM_AND_CURATED', label: 'Source + curated' }
                                        ].map(policy => {
                                            const isSelected = (formData.profileConfig?.partyPopulationPolicy || 'SYSTEM_AND_CURATED') === policy.value;
                                            return (
                                                <div 
                                                    key={policy.value}
                                                    onClick={() => {
                                                        setFormData({
                                                            ...formData,
                                                            profileConfig: { ...formData.profileConfig, partyPopulationPolicy: policy.value }
                                                        });
                                                    }}
                                                    className={`cursor-pointer border rounded-md p-3 flex items-center gap-3 transition-colors ${
                                                        isSelected 
                                                            ? 'border-indigo-600 bg-indigo-50 text-indigo-900' 
                                                            : 'border-slate-200 bg-white hover:border-indigo-300 text-slate-700'
                                                    }`}
                                                >
                                                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'border-indigo-600' : 'border-slate-300'}`}>
                                                        {isSelected && <div className="w-2 h-2 rounded-full bg-indigo-600" />}
                                                    </div>
                                                    <span className="text-sm font-medium">{policy.label}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="border-t border-indigo-100 pt-4">
                                    <Label className="text-xs font-semibold text-indigo-900 mb-2 block">Allowed Party Types</Label>
                                    <div className="flex flex-wrap gap-2">
                                        {PARTY_TYPES.map(type => {
                                            const isSelected = formData.profileConfig?.allowedPartyTypes?.includes(type);
                                            return (
                                                <Badge 
                                                    key={type} 
                                                    variant={isSelected ? "default" : "outline"}
                                                    className={`cursor-pointer ${isSelected ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50'}`}
                                                    onClick={() => {
                                                        const current = formData.profileConfig?.allowedPartyTypes || [];
                                                        const next = isSelected ? current.filter((t: string) => t !== type) : [...current, type];
                                                        setFormData({
                                                            ...formData,
                                                            profileConfig: { ...formData.profileConfig, allowedPartyTypes: next }
                                                        });
                                                    }}
                                                >
                                                    {type}
                                                </Badge>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div>
                                    <Label className="text-xs font-semibold text-indigo-900 mb-2 block">Allowed Party Subtypes</Label>
                                    <div className="flex flex-wrap gap-2">
                                        {PARTY_SUBTYPES.map(type => {
                                            const isSelected = formData.profileConfig?.allowedPartySubTypes?.includes(type);
                                            return (
                                                <Badge 
                                                    key={type} 
                                                    variant={isSelected ? "default" : "outline"}
                                                    className={`cursor-pointer ${isSelected ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50'}`}
                                                    onClick={() => {
                                                        const current = formData.profileConfig?.allowedPartySubTypes || [];
                                                        const next = isSelected ? current.filter((t: string) => t !== type) : [...current, type];
                                                        setFormData({
                                                            ...formData,
                                                            profileConfig: { ...formData.profileConfig, allowedPartySubTypes: next }
                                                        });
                                                    }}
                                                >
                                                    {type}
                                                </Badge>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div>
                                    <Label className="text-xs font-semibold text-indigo-900 mb-2 block">Display Mask</Label>
                                    <div className="text-[10px] text-indigo-600 mb-2">Order of selection determines display order.</div>
                                    <div className="flex flex-col gap-4">
                                        {SCHEMA_GROUPS.map(group => (
                                            <div key={group.label} className="bg-indigo-50/50 p-2 rounded border border-indigo-100">
                                                <div className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider mb-2">{group.label}</div>
                                                <div className="flex flex-wrap gap-2">
                                                    {group.fields.map(f => {
                                                        const isSelected = formData.profileConfig?.displayMask?.includes(f.path);
                                                        return (
                                                            <Badge 
                                                                key={f.path} 
                                                                variant={isSelected ? "default" : "outline"}
                                                                className={`cursor-pointer ${f.deEmphasise && !isSelected ? 'opacity-60' : ''} ${isSelected ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50'}`}
                                                                onClick={() => {
                                                                    const current = formData.profileConfig?.displayMask || [];
                                                                    const next = isSelected ? current.filter((p: string) => p !== f.path) : [...current, f.path];
                                                                    setFormData({
                                                                        ...formData,
                                                                        profileConfig: { ...formData.profileConfig, displayMask: next }
                                                                    });
                                                                }}
                                                            >
                                                                {f.label}
                                                            </Badge>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {formData.profileConfig?.displayMask && formData.profileConfig.displayMask.length > 0 && (
                                        <div className="mt-2 p-2 bg-white rounded border border-indigo-100 text-xs font-mono text-indigo-800">
                                            {formData.profileConfig.displayMask.join(', ')}
                                        </div>
                                    )}
                                </div>

                                {formData.profileConfig?.storageModes && (
                                    <div>
                                        <Label className="text-xs font-semibold text-indigo-900 mb-1 block">Storage Modes (Read-only)</Label>
                                        <div className="text-xs text-indigo-700 font-mono">
                                            {formData.profileConfig.storageModes.join(', ')}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>
                    )}

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
                                {isComplexForHeader && field.appDataType !== 'PARTY' ? (
                                    // Complex fields: lock the storage type — changing it would break KycWriteService routing.
                                    // The true field type is defined in complex-field-config.ts, not this dropdown.
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-slate-200 bg-slate-50">
                                            <span className="text-xs font-mono text-slate-500">{field.appDataType}</span>
                                            <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 ml-auto">
                                                Collection behaviour is system-configured
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-2">
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
                                        {field.appDataType === 'PARTY' && isComplexForHeader && (
                                            <div className="text-[11px] text-amber-700 italic bg-amber-50 p-2 rounded-md border border-amber-200">
                                                Collection behaviour is system-configured ({complexHeaderCfg!.collectionId}). The PARTY profile below controls allowed types and display masks.
                                            </div>
                                        )}
                                    </div>
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
                            {!([APP_DATA_TYPES.BOOLEAN, APP_DATA_TYPES.DATETIME,
                                APP_DATA_TYPES.DOCUMENT_REF, APP_DATA_TYPES.ADDRESS
                              ] as string[]).includes(formData.appDataType) && (
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
                            )}
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
                            <div className="grid gap-2">
                                <Label htmlFor="defaultResponse" className="text-xs text-slate-500 flex justify-between">
                                    <span>Default Response</span>
                                    <span className="text-[10px] text-slate-400 font-normal">Fallback value</span>
                                </Label>
                                {formData.appDataType === 'BOOLEAN' ? (
                                    <Select value={formData.defaultResponse || "none"} onValueChange={(val) => setFormData({ ...formData, defaultResponse: val === "none" ? "" : val })}>
                                        <SelectTrigger className="bg-slate-50 border-slate-200">
                                            <SelectValue placeholder="No default" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">No default</SelectItem>
                                            <SelectItem value="true">Yes</SelectItem>
                                            <SelectItem value="false">No</SelectItem>
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <Textarea
                                        id="defaultResponse"
                                        placeholder="When no value exists and the field is not mapped to a source, this response will be displayed in the Master Record."
                                        value={formData.defaultResponse}
                                        onChange={(e) => setFormData({ ...formData, defaultResponse: e.target.value })}
                                        className="min-h-[80px] bg-slate-50 border-slate-200 resize-y"
                                    />
                                )}
                            </div>
                        </div>
                        <div className="flex justify-end pt-2">
                            <Button onClick={handleSave} disabled={loading} size="sm" className="bg-indigo-600 hover:bg-indigo-700">
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Save & Close
                            </Button>
                        </div>
                    </section>

                    {/* Source Mappings Section */}
                    <section className="space-y-4">
                        <div className="flex items-center justify-between border-b pb-2">
                            <h3 className="text-sm font-semibold flex items-center gap-2 text-slate-800">
                                <LinkIcon className="w-4 h-4 text-slate-400" /> Source Mappings
                            </h3>
                            {field.appDataType === 'ADDRESS' ? (
                                <>
                                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setIsAddressMappingModalOpen(true)}>Add Address Source Mapping</Button>
                                    <AddressFieldSourceMappingModal
                                        open={isAddressMappingModalOpen}
                                        onOpenChange={setIsAddressMappingModalOpen}
                                        targetFieldNo={field.fieldNo}
                                        targetFieldName={field.fieldName}
                                        resolvedDefaults={resolvedDefaults}
                                        fieldDefinitions={fieldDefinitions}
                                    />
                                </>
                            ) : (
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
                                            <Select value={mappingForm.sourceType} onValueChange={(val) => {
                                                const opt = SOURCE_OPTIONS.find(o => o.value === val);
                                                const isGleif = opt?.sourceType === 'GLEIF';
                                                const defaultSubtype = isGleif 
                                                    ? 'NONE' 
                                                    : ((field.appDataType === 'PARTY' || field.appDataType === 'PERSON_OR_CONTACT') ? 'OFFICERS' : 'COMPANY_PROFILE');
                                                setMappingForm({
                                                    ...mappingForm,
                                                    sourceType: val,
                                                    mappingScope: isGleif ? 'BASELINE' : 'RAW_PAYLOAD',
                                                    payloadSubtype: defaultSubtype,
                                                });
                                            }}>
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

                                        {(() => {
                                            const isPersonOrContactMapping =
                                                mappingForm.transformType === "TO_PARTY_VALUE_LIST" ||
                                                mappingForm.transformType === "TO_PARTY_VALUE" ||
                                                mappingForm.transformType === "TO_PERSON_OR_CONTACT_LIST" ||
                                                mappingForm.transformType === "TO_PERSON_OR_CONTACT_VALUE" ||
                                                field?.appDataType === "PARTY" ||
                                                field?.appDataType === "PERSON_OR_CONTACT";

                                            return (
                                                <>
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

                                                    {isPersonOrContactMapping ? (
                                                        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded-lg p-4 space-y-2">
                                                            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-medium">
                                                                <Users className="w-4 h-4" />
                                                                <span>Map all Officers as Person or Contact</span>
                                                            </div>
                                                            <p className="text-xs text-blue-600/80 dark:text-blue-400/80 leading-relaxed">
                                                                This will map the entire {mappingForm.payloadSubtype || "OFFICERS"} list into this repeating Person or Contact field using the system's standard structured extraction rules.
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <div className="grid gap-2">
                                                            <Label htmlFor="transformType">Transform Type</Label>
                                                            <Select value={mappingForm.transformType} onValueChange={(val) => setMappingForm({ ...mappingForm, transformType: val })}>
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Select transform" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {TRANSFORM_SELECT_OPTIONS.map(t => (
                                                                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                            {getTransformDescription(mappingForm.transformType) && (
                                                                <p className="text-[11px] text-slate-500 leading-snug">
                                                                    {getTransformDescription(mappingForm.transformType)}
                                                                </p>
                                                            )}
                                                        </div>
                                                    )}
                                                </>
                                            );
                                        })()}

                                        {/* Payload Subtype — RA only. Controls which RegistrySourcePayload subtype the path resolves against. */}
                                        {SOURCE_OPTIONS.find(o => o.value === mappingForm.sourceType)?.sourceType === 'REGISTRATION_AUTHORITY' && (
                                            <div className="grid gap-2">
                                                <Label htmlFor="payloadSubtype">Payload Subtype</Label>
                                                <Select value={mappingForm.payloadSubtype} onValueChange={(val) => setMappingForm({ ...mappingForm, payloadSubtype: val })}>
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="COMPANY_PROFILE">Company Profile (name, address, status, SIC)</SelectItem>
                                                        <SelectItem value="OFFICERS">Officers / Directors</SelectItem>
                                                        <SelectItem value="PSC">Persons with Significant Control</SelectItem>
                                                        <SelectItem value="FILING_HISTORY">Filing History</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <p className="text-[10px] text-slate-400">Which part of the raw registry payload this path reads from.</p>
                                            </div>
                                        )}
                                        {/* Premium GLEIF Scope Selector */}
                                        {SOURCE_OPTIONS.find(o => o.value === mappingForm.sourceType)?.sourceType === 'GLEIF' && (
                                            <div className="grid gap-2 my-2">
                                                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">GLEIF Data Scope</Label>
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                    {[
                                                        { id: "LEVEL_1", title: "Level 1 (Core)", desc: "Entity core data (name, address, status)." },
                                                        { id: "LEVEL_2_RELATIONSHIPS", title: "Level 2 (Rel.)", desc: "Parents, funds, children, LOUs." },
                                                        { id: "ELF", title: "ELF Data", desc: "Entity legal forms & jurisdiction." }
                                                    ].map(opt => (
                                                        <div 
                                                            key={opt.id}
                                                            onClick={() => setMappingForm({ ...mappingForm, payloadSubtype: opt.id })}
                                                            className={cn(
                                                                "cursor-pointer rounded-lg border p-2.5 transition-all duration-200 hover:shadow-sm group",
                                                                mappingForm.payloadSubtype === opt.id 
                                                                    ? "bg-gradient-to-br from-indigo-50 to-white border-indigo-200 shadow-sm ring-1 ring-indigo-500/20"
                                                                    : "bg-white border-slate-200 hover:border-indigo-100"
                                                            )}
                                                        >
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className={cn(
                                                                    "text-[11px] font-semibold transition-colors",
                                                                    mappingForm.payloadSubtype === opt.id ? "text-indigo-700" : "text-slate-700 group-hover:text-indigo-600"
                                                                )}>{opt.title}</span>
                                                                {mappingForm.payloadSubtype === opt.id && <Check className="w-3 h-3 text-indigo-500" />}
                                                            </div>
                                                            <p className="text-[9px] text-slate-500 leading-tight pr-2">{opt.desc}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Scope confirmation strip — fallback for RA */}
                                        {SOURCE_OPTIONS.find(o => o.value === mappingForm.sourceType)?.sourceType !== 'GLEIF' && (
                                            <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-400 bg-slate-50 border border-slate-100 rounded px-2.5 py-1.5 mt-1">
                                                <span className="text-slate-300">scope:</span>
                                                <span className="text-slate-600">{mappingForm.mappingScope}</span>
                                                {mappingForm.payloadSubtype && mappingForm.payloadSubtype !== 'NONE' && (
                                                    <><span className="text-slate-200 mx-0.5">·</span><span className="text-slate-300">subtype:</span><span className="text-slate-600">{mappingForm.payloadSubtype}</span></>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <DialogFooter>
                                        <Button onClick={handleSaveMapping} disabled={isMappingSaving}>
                                            {isMappingSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Save Mapping
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                            )}

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
                                        {resolvedDefaults ? (
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
                                                resolvedDefaults={resolvedDefaults}
                                                onSelectPath={(path, subtype, transformType, transformConfig) => {
                                                    setMappingForm(f => ({
                                                        ...f,
                                                        sourcePath: path,
                                                        payloadSubtype: subtype || f.payloadSubtype,
                                                        transformType: transformType || f.transformType,
                                                        transformConfig: transformConfig || null
                                                    }));
                                                    setIsBrowserOpen(false);
                                                }}
                                            />
                                        ) : (
                                            <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white/50 dark:bg-zinc-900/50 dark:border-zinc-800">
                                                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                                            </div>
                                        )}
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

                                            <Badge variant={mapping.isActive ? "default" : "secondary"} className={mapping.isActive ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : ""}>
                                              {mapping.priority}
                                            </Badge>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-primary" onClick={() => setEditingMapping(mapping)}>
                                              <Edit className="h-3 w-3" />
                                            </Button>

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
                            <Dialog open={isAddBindingOpen} onOpenChange={closeBindingDialog}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-7 text-xs shrink-0">
                                        <Plus className="h-3 w-3 mr-1" /> Add Binding
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
                                    <DialogHeader className="shrink-0">
                                        <DialogTitle>
                                            {editingBindingId ? "Edit Graph Node Binding" : "Add Graph Node Binding"}
                                        </DialogTitle>
                                        <DialogDescription>
                                            {editingBindingId
                                                ? "Update the configuration for this graph node binding."
                                                : "Connect this field to the LE Graph so answers are drawn from graph nodes and optionally write back edges."}
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="grid gap-4 py-4 overflow-y-auto flex-1 pr-1">
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

                                        {/* ── Projection / Governance ────────────────────────────────────── */}
                                        <div className="border-t pt-4 grid gap-3">
                                            <div>
                                                <h4 className="text-xs font-semibold text-slate-700 mb-0.5">Returned Fields (Projection)</h4>
                                                <p className="text-[10px] text-slate-400">
                                                    Controls which node fields are exposed downstream after a node is selected.
                                                    Runtime enforcement is Phase 5.4 — values are stored now.
                                                </p>
                                            </div>

                                            {/* Mode selector */}
                                            <div className="flex flex-col gap-2">
                                                {([
                                                    { mode: "DEFAULT" as ProjectionMode, label: "Default", desc: `Safe system defaults (${getDefaultProjectionFields(bindingForm.graphNodeType as NodeType).join(", ")})` },
                                                    { mode: "CUSTOM" as ProjectionMode, label: "Custom", desc: "Choose which fields to expose" },
                                                    { mode: "NONE"    as ProjectionMode, label: "None",   desc: "Return no node fields downstream" },
                                                ]).map(({ mode, label, desc }) => (
                                                    <label
                                                        key={mode}
                                                        className={`flex items-start gap-2.5 rounded-md border px-3 py-2.5 cursor-pointer select-none transition-colors ${
                                                            bindingForm.projectionMode === mode
                                                                ? "border-indigo-400 bg-indigo-50"
                                                                : "border-slate-200 hover:border-slate-300 bg-white"
                                                        }`}
                                                    >
                                                        <input
                                                            type="radio"
                                                            name={`projectionMode-${bindingForm.graphNodeType}`}
                                                            value={mode}
                                                            checked={bindingForm.projectionMode === mode}
                                                            onChange={() => setBindingForm(prev => ({
                                                                ...prev,
                                                                projectionMode: mode,
                                                                // Reset projectionFields when switching away from CUSTOM
                                                                projectionFields: mode !== "CUSTOM" ? [] : prev.projectionFields,
                                                            }))}
                                                            className="mt-0.5 accent-indigo-600"
                                                        />
                                                        <div>
                                                            <span className="text-xs font-medium text-slate-800">{label}</span>
                                                            <p className="text-[10px] text-slate-400 mt-0.5">{desc}</p>
                                                        </div>
                                                    </label>
                                                ))}
                                            </div>

                                            {/* Custom field checkboxes — only when CUSTOM selected */}
                                            {bindingForm.projectionMode === "CUSTOM" && (
                                                <div className="grid gap-1.5">
                                                    <Label className="text-xs font-medium">Fields to expose</Label>
                                                    <p className="text-[10px] text-slate-400">Leave all unchecked to expose nothing.</p>
                                                    <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 p-2 border rounded-md bg-slate-50">
                                                        {getDisplayableFields(bindingForm.graphNodeType as NodeType).map(f => (
                                                            <label key={f.fieldKey} className="flex items-center gap-2 cursor-pointer select-none">
                                                                <Checkbox
                                                                    id={`proj-${f.fieldKey}`}
                                                                    checked={bindingForm.projectionFields.includes(f.fieldKey)}
                                                                    onCheckedChange={(checked) => {
                                                                        setBindingForm(prev => ({
                                                                            ...prev,
                                                                            projectionFields: checked
                                                                                ? [...prev.projectionFields, f.fieldKey]
                                                                                : prev.projectionFields.filter(k => k !== f.fieldKey)
                                                                        }));
                                                                    }}
                                                                />
                                                                <span className="text-xs text-slate-700">{f.label}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* NONE warning */}
                                            {bindingForm.projectionMode === "NONE" && (
                                                <p className="text-[10px] text-red-600 bg-red-50 border border-red-100 rounded px-2 py-1">
                                                    ⚠ No node fields will be exposed downstream. Only the internal reference ID is retained.
                                                </p>
                                            )}
                                        </div>

                                    </div>
                                    <DialogFooter className="shrink-0 pt-2">
                                        <Button variant="outline" onClick={() => closeBindingDialog(false)} disabled={isBindingSaving}>
                                            Cancel
                                        </Button>
                                        <Button onClick={handleSaveBinding} disabled={isBindingSaving}>
                                            {isBindingSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            {editingBindingId ? "Save Changes" : "Add Binding"}
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
                                        <div className="flex items-center gap-1 shrink-0 ml-3">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                                                onClick={() => openEditBinding(b)}
                                                title="Edit binding"
                                            >
                                                <Edit className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-slate-300 hover:text-red-500 hover:bg-red-50"
                                                disabled={deletingBindingId === b.id}
                                                onClick={() => handleDeleteBinding(b.id)}
                                                title="Remove binding"
                                            >
                                                {deletingBindingId === b.id
                                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    : <Trash2 className="h-3.5 w-3.5" />}
                                            </Button>
                                        </div>
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
        <MappingFormDialog
            open={!!editingMapping}
            onOpenChange={(v) => !v && setEditingMapping(null)}
            selectedOption={SOURCE_OPTIONS.find(o => o.sourceType === editingMapping?.sourceType && o.sourceReference === editingMapping?.sourceReference) || SOURCE_OPTIONS[0]}
            fieldDefs={fieldDefinitions}
            existingMapping={{...editingMapping, targetFieldNo: field?.fieldNo}}
            initialSourcePath=""
            onSaved={() => {
                setEditingMapping(null);
                router.refresh();
            }}
            resolvedDefaults={resolvedDefaults}
        />
        </Sheet>
    );
}
