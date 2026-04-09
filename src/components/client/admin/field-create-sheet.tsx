"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Save, Database, BookOpen } from "lucide-react";
import { createMasterField } from "@/actions/master-data-governance";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { getOptionSets } from "@/actions/master-data-option-sets";
import { useEffect } from "react";
interface FieldCreateSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function FieldCreateSheet({ open, onOpenChange }: FieldCreateSheetProps) {
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
        fieldName: "",
        category: "General",
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
            if (payload.appDataType !== "SELECT") {
                payload.optionSetId = undefined;
                payload.isMultiValue = false;
            }

            const res = await createMasterField(payload);
            if (res.success) {
                toast.success("Field created successfully");
                setFormData({
                    fieldName: "",
                    category: "General",
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
                                        <SelectItem value="TEXT">Text (String)</SelectItem>
                                        <SelectItem value="NUMBER">Number</SelectItem>
                                        <SelectItem value="BOOLEAN">Boolean</SelectItem>
                                        <SelectItem value="DATE">Date</SelectItem>
                                        <SelectItem value="JSON">JSON</SelectItem>
                                        <SelectItem value="SELECT">Dropdown Selection</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {formData.appDataType === "SELECT" && (
                                <>
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
                                    <div className="grid gap-2 col-span-2 flex-row items-center border rounded-md p-3">
                                        <div className="flex-1 space-y-1">
                                            <p className="text-sm font-medium leading-none">Allow Multiple Selections</p>
                                            <p className="text-xs text-muted-foreground">End users can pick more than one option.</p>
                                        </div>
                                        <Switch
                                            checked={formData.isMultiValue}
                                            onCheckedChange={(val) => setFormData({ ...formData, isMultiValue: val })}
                                        />
                                    </div>
                                </>
                            )}

                            <div className="grid gap-2">
                                <Label htmlFor="newCategory" className="text-xs text-slate-500">Category</Label>
                                <Input
                                    id="newCategory"
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    className="bg-white"
                                    placeholder="e.g. General"
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
