"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Save, Database, BookOpen } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { getOptionSets } from "@/actions/master-data-option-sets";
import { useEffect } from "react";
import { createMasterField } from "@/actions/master-data-governance";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CategoryCombobox } from "./category-combobox";
import { SCALAR_UI_OPTIONS, REFERENCE_UI_OPTIONS, APP_DATA_TYPES } from "@/lib/master-data/field-types";

interface FieldCreateSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    categories: any[];
}

export function FieldCreateSheet({ open, onOpenChange, categories=[] }: FieldCreateSheetProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [optionSets, setOptionSets] = useState<any[]>([]);
    
    useEffect(() => {
        if (open) {
            getOptionSets().then(res => {
                if (res.success) setOptionSets(res.optionSets || []);
            });

            if (typeof window !== "undefined") {
                const params = new URLSearchParams(window.location.search);
                if (params.get("prefill") === "true") {
                    const name = params.get("fieldName") || "";
                    const catName = params.get("categoryName") || "";
                    const desc = params.get("description") || "";
                    const prefillType = params.get("prefillType") || "";
                    
                    const matchedCat = categories.find(c => c.displayName.toLowerCase() === catName.toLowerCase());
                    
                    setFormData(prev => ({
                        ...prev,
                        fieldName: name || prev.fieldName,
                        categoryId: matchedCat ? matchedCat.id : "",
                        newCategoryName: matchedCat ? "" : catName,
                        description: desc || prev.description,
                        appDataType: prefillType === "ADDRESS" ? APP_DATA_TYPES.ADDRESS : prev.appDataType
                    }));
                }
            }
        }
    }, [open, categories]);

    // Initialize form state
    const [formData, setFormData] = useState({
        fieldName: "",
        categoryId: "",
        newCategoryName: "",
        domain: "Onboarding",
        fmsbRef: "",
        description: "",
        notes: "",
        appDataType: "TEXT",
        isActive: true,
        optionSetId: "none",
        isMultiValue: false
    });

    const handleSave = async () => {
        if (!formData.fieldName.trim()) {
            toast.error("Field Name is required");
            return;
        }

        setLoading(true);
        try {
            const domainsArray = formData.domain ? formData.domain.split(",").map(d => d.trim()).filter(Boolean) : [];
            const payload: any = { 
                ...formData, 
                domain: domainsArray 
            };
            if (payload.optionSetId === "none") {
                payload.optionSetId = undefined;
            }
            // Strip isMultiValue only for types where a collection makes no semantic sense.
            // TEXT and NUMBER CAN be multi-value (e.g. trading names, SIC codes as numbers).
            // Only BOOLEAN, DATETIME, and DOCUMENT_REF have no meaningful collection interpretation.
            const noMultiValueTypes = [
                APP_DATA_TYPES.BOOLEAN,
                APP_DATA_TYPES.DATETIME,
                APP_DATA_TYPES.DOCUMENT_REF,
            ];
            if (noMultiValueTypes.includes(payload.appDataType)) {
                payload.optionSetId = undefined;
                payload.isMultiValue = false;
            }

            const res = await createMasterField(payload);
            if (res.success) {
                toast.success("Field created successfully");
                setFormData({
                    fieldName: "",
                    categoryId: "",
                    newCategoryName: "",
                    domain: "Onboarding",
                    fmsbRef: "",
                    description: "",
                    notes: "",
                    appDataType: "TEXT",
                    isActive: true,
                    optionSetId: "none",
                    isMultiValue: false
                });
                onOpenChange(false);
                router.refresh();
            } else {
                toast.error(res.error || "Failed to create field");
            }
        } catch (error) {
            toast.error("An error occurred");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-[750px] flex flex-col h-full bg-white dark:bg-slate-950">
                <SheetHeader className="pb-4 border-b border-slate-200">
                    <SheetTitle>Create New Master Field</SheetTitle>
                    <SheetDescription>Define a new data point for the system.</SheetDescription>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto pt-6 pb-20 space-y-8 px-1">
                    
                    {/* General Metadata Section */}
                    <section className="space-y-4">
                        <h3 className="text-sm font-semibold flex items-center gap-2 text-slate-800 border-b pb-2">
                            <Database className="w-4 h-4 text-slate-400" /> Core Metadata
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="newFieldName" className="text-xs text-slate-500">Field Name *</Label>
                                <Input
                                    id="newFieldName"
                                    value={formData.fieldName}
                                    onChange={(e) => setFormData({ ...formData, fieldName: e.target.value })}
                                    className="bg-white"
                                    placeholder="e.g. Legal Entity Name"
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="newDataType" className="text-xs text-slate-500">Data Type</Label>
                                <Select value={formData.appDataType} onValueChange={(val) => setFormData({ ...formData, appDataType: val })}>
                                    <SelectTrigger className="w-full bg-white">
                                        <SelectValue placeholder="Select Data Type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {/* ── Simple scalar types ── */}
                                        <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                            Simple field types
                                        </div>
                                        {SCALAR_UI_OPTIONS.map(opt => (
                                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                        ))}

                                        {/* ── Reference types ── */}
                                        <div className="px-2 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-t mt-1 pt-2">
                                            Reference field types
                                        </div>
                                        {REFERENCE_UI_OPTIONS.map(opt => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                <span>{opt.label}</span>
                                                {opt.description && <span className="text-slate-400 text-[10px] ml-1">— {opt.description}</span>}
                                            </SelectItem>
                                        ))}

                                        {/* ── Graph-backed fields — admin-configurable via Graph Binding ── */}
                                        <div className="px-2 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-t mt-1 pt-2">
                                            Graph-backed fields
                                        </div>
                                        <div className="px-2 py-2 text-xs text-slate-500 leading-relaxed">
                                            Choose <span className="font-medium text-slate-700">Party Reference</span> or{" "}
                                            <span className="font-medium text-slate-700">Address Reference</span> above,
                                            then add a <span className="font-medium text-slate-700">Graph Binding</span> after
                                            saving. No code changes required.
                                        </div>
                                    </SelectContent>
                                </Select>
                                {formData.appDataType === APP_DATA_TYPES.ADDRESS && (
                                    <div className="text-[11px] text-indigo-650 bg-indigo-50 dark:bg-indigo-955/20 border border-indigo-100 dark:border-indigo-900/30 rounded-md p-2 mt-1 leading-normal font-sans">
                                        This field stores a structured address: Address lines, Locality, Region, Postcode and Country.
                                    </div>
                                )}
                                {/* isMultiValue toggle — hidden only for BOOLEAN, DATETIME, DOCUMENT_REF */}
                             {!([APP_DATA_TYPES.BOOLEAN, APP_DATA_TYPES.DATETIME,
                                 APP_DATA_TYPES.DOCUMENT_REF
                               ] as string[]).includes(formData.appDataType) && (
                                <>
                                    {formData.appDataType === APP_DATA_TYPES.SELECT && (
                                        <div className="grid gap-2 col-span-2">
                                            <Label className="text-xs text-slate-500">Option Set *</Label>
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
                                    )}
                                    <div className="grid gap-2 col-span-2 flex-row items-center border rounded-md p-3">
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex-1 space-y-0.5">
                                                <p className="text-sm font-medium leading-none">
                                                    {([APP_DATA_TYPES.PARTY_REF, APP_DATA_TYPES.PERSON_REF,
                                                      APP_DATA_TYPES.ORG_REF, APP_DATA_TYPES.ADDRESS_REF
                                                     ] as string[]).includes(formData.appDataType)
                                                        ? 'Allow multiple references'
                                                        : 'Allow multiple selections'}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {([APP_DATA_TYPES.PARTY_REF, APP_DATA_TYPES.PERSON_REF,
                                                      APP_DATA_TYPES.ORG_REF, APP_DATA_TYPES.ADDRESS_REF
                                                     ] as string[]).includes(formData.appDataType)
                                                        ? 'More than one entity can be linked to this field.'
                                                        : 'End users can pick more than one option.'}
                                                </p>
                                            </div>
                                            <Switch
                                                checked={formData.isMultiValue}
                                                onCheckedChange={(val) => setFormData({ ...formData, isMultiValue: val })}
                                            />
                                        </div>
                                    </div>
                                </>
                            )}
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="newCategory" className="text-xs text-slate-500">Category</Label>
                                <CategoryCombobox 
                                    categories={categories}
                                    categoryId={formData.categoryId}
                                    newCategoryName={formData.newCategoryName}
                                    onSelectionChange={(id, name) => setFormData({...formData, categoryId: id, newCategoryName: name})}
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="newDomain" className="text-xs text-slate-500">Domain Classification (comma-separated)</Label>
                                <Input
                                    id="newDomain"
                                    placeholder="e.g. Onboarding, Insurance"
                                    value={formData.domain}
                                    onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                                    className="bg-white"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="newFmsbRef" className="text-xs text-slate-500">FMSB Ref.</Label>
                                <Input
                                    id="newFmsbRef"
                                    placeholder="e.g. FMSB-01"
                                    value={formData.fmsbRef}
                                    onChange={(e) => setFormData({ ...formData, fmsbRef: e.target.value })}
                                    className="bg-white"
                                />
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
                                <Label htmlFor="newDesc" className="text-xs text-slate-500 flex justify-between">
                                    <span>Public Description</span>
                                </Label>
                                <Textarea
                                    id="newDesc"
                                    placeholder="Formal definition of what this field represents..."
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="min-h-[80px] bg-white resize-y"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="newNotes" className="text-xs text-slate-500 flex justify-between">
                                    <span>Private Admin Notes</span>
                                    <span className="text-[10px] text-slate-400 font-normal">Internal only</span>
                                </Label>
                                <Textarea
                                    id="newNotes"
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
                                Create Field
                            </Button>
                        </div>
                    </section>
                </div>
            </SheetContent>
        </Sheet>
    );
}
