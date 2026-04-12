"use client";

import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Save, FileText, Database, Link as LinkIcon, BookOpen, ScanSearch, Trash2 } from "lucide-react";
import { updateMasterField } from "@/actions/master-data-governance";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getOptionSets } from "@/actions/master-data-option-sets";
import { upsertSourceMapping, deleteSourceMapping } from "@/actions/source-mappings";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CategoryCombobox } from "./category-combobox";
import { DataInspectorPanel } from "@/components/client/admin/source-mappings/data-inspector-panel";

interface FieldDetailSheetProps {
    field: any;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    categories: any[];
}

export function FieldDetailSheet({ field, open, onOpenChange, categories=[] }: FieldDetailSheetProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [optionSets, setOptionSets] = useState<any[]>([]);

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

    // Update form state when the selected field changes
    useEffect(() => {
        if (field) {
            setFormData({
                fieldName: field.fieldName || "",
                categoryId: field.categoryId || "",
                newCategoryName: "",
                domain: field.domain?.join(", ") || "",
                fmsbRef: field.fmsbRef || "",
                description: field.description || "",
                notes: field.notes || "",
                isMultiValue: field.isMultiValue || false,
                optionSetId: field.optionSetId || "none",
                appDataType: field.appDataType || "TEXT"
            });
        }
    }, [field]);

    const [isAddMappingOpen, setIsAddMappingOpen] = useState(false);
    const [isBrowserOpen, setIsBrowserOpen] = useState(false);
    const [deletingMappingId, setDeletingMappingId] = useState<string | null>(null);
    const [mappingForm, setMappingForm] = useState({
        sourceType: "GLEIF",
        sourcePath: "",
        transformType: "DIRECT"
    });
    const [isMappingSaving, setIsMappingSaving] = useState(false);

    const liveSourceTypes = ["GLEIF", "NATIONAL_REGISTRY", "COMPANIES_HOUSE"];

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
            const res = await upsertSourceMapping({
                sourceType: mappingForm.sourceType as any,
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

    const handleSave = async () => {
        setLoading(true);
        try {
            const domainsArray = formData.domain ? formData.domain.split(",").map((d: string) => d.trim()).filter(Boolean) : [];
            const payload: any = { 
                ...formData, 
                domain: domainsArray
            };
            if (payload.optionSetId === "none" || payload.appDataType !== "SELECT") {
                payload.optionSetId = null;
            }
            if (payload.appDataType !== "SELECT") {
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
                            <span className="text-xs text-slate-500 font-mono self-center ml-2">{field.appDataType}</span>
                        </div>
                    </div>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto pt-6 pb-20 space-y-8 px-1">
                    
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
                                <Select value={formData.appDataType} onValueChange={(val) => setFormData({ ...formData, appDataType: val })}>
                                    <SelectTrigger className="w-full bg-white">
                                        <SelectValue placeholder="Select Data Type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="TEXT">Text (String)</SelectItem>
                                        <SelectItem value="NUMBER">Number</SelectItem>
                                        <SelectItem value="BOOLEAN">Boolean</SelectItem>
                                        <SelectItem value="DATE">Date</SelectItem>
                                        <SelectItem value="JSON">JSON</SelectItem>
                                        <SelectItem value="SELECT">Dropdown Selection</SelectItem>
                                    </SelectContent>
                                </Select>
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

                            {formData.appDataType === "SELECT" && (
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
                                                    <SelectItem value="GLEIF">GLEIF</SelectItem>
                                                    <SelectItem value="NATIONAL_REGISTRY">National Registry</SelectItem>
                                                    <SelectItem value="COMPANIES_HOUSE">Companies House</SelectItem>
                                                    <SelectItem value="USER_INPUT">User Input / Other</SelectItem>
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
                                            Browse {mappingForm.sourceType === "GLEIF" ? "GLEIF" : "Registry"} Schema
                                        </DialogTitle>
                                        <DialogDescription className="text-xs">
                                            Fetch a live record, then click <span className="font-semibold text-blue-600">⊕ Add</span> on any field to use it as the source path.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="flex-1 overflow-hidden p-4">
                                        <DataInspectorPanel
                                            sourceType={mappingForm.sourceType}
                                            existingMappings={field.sourceMappings || []}
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
                                {field.sourceMappings.map((mapping: any) => (
                                    <div key={mapping.id} className="bg-white border rounded-md p-3 text-sm flex items-center justify-between group">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <Badge variant="outline" className="bg-slate-50 shrink-0">{mapping.sourceType}</Badge>
                                            <span className="font-mono text-xs text-slate-600 truncate" title={mapping.sourcePath}>
                                                {mapping.sourcePath}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0 ml-3">
                                            <span className="text-xs text-slate-400">{mapping.transformType}</span>
                                            <Badge variant={mapping.isActive ? "default" : "secondary"} className={mapping.isActive ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : ""}>
                                                {mapping.priority}
                                            </Badge>
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
                </div>
            </SheetContent>
        </Sheet>
    );
}
