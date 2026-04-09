"use client";
import React, { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { OptionSetValueType, MasterDataOptionSetPayload } from "@/types/master-data";
import { createOptionSet, updateOptionSet } from "@/actions/master-data-option-sets";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface OptionSetSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    optionSet?: any | null; // null means create mode
}

export function OptionSetSheet({ open, onOpenChange, optionSet }: OptionSetSheetProps) {
    const router = useRouter();
    const isEdit = !!optionSet;
    const [loading, setLoading] = useState(false);

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [valueType, setValueType] = useState<OptionSetValueType>("STRING");
    const [options, setOptions] = useState<{ label: string; value: string }[]>([]);

    useEffect(() => {
        if (open) {
            if (isEdit && optionSet) {
                setName(optionSet.name || "");
                setDescription(optionSet.description || "");
                setValueType((optionSet.valueType as OptionSetValueType) || "STRING");
                
                // Parse options safely
                const opts = Array.isArray(optionSet.options) ? optionSet.options : [];
                setOptions(opts.map((o: any) => ({ 
                    label: o.label || "", 
                    value: String(o.value || "") 
                })));
            } else {
                setName("");
                setDescription("");
                setValueType("STRING");
                setOptions([{ label: "", value: "" }]);
            }
        }
    }, [open, isEdit, optionSet]);

    const handleAddOption = () => {
        setOptions([...options, { label: "", value: "" }]);
    };

    const handleRemoveOption = (index: number) => {
        setOptions(options.filter((_, i) => i !== index));
    };

    const handleOptionChange = (index: number, field: "label" | "value", val: string) => {
        const newOpts = [...options];
        newOpts[index][field] = val;
        setOptions(newOpts);
    };

    const handleSave = async () => {
        if (!name.trim()) {
            toast.error("Name is required");
            return;
        }

        // Validate options
        const validOptions = options.filter(o => o.label.trim() && o.value.trim());
        if (validOptions.length === 0) {
            toast.error("At least one valid option is required");
            return;
        }

        // Typed values based on valueType
        const formattedOptions = validOptions.map(o => {
            let processedValue: string | number | boolean = o.value;
            if (valueType === "NUMBER") {
                processedValue = Number(o.value);
            } else if (valueType === "BOOLEAN") {
                processedValue = o.value.toLowerCase() === "true";
            }
            return {
                label: o.label.trim(),
                value: processedValue
            };
        });

        const payload: MasterDataOptionSetPayload = {
            name: name.trim(),
            description: description.trim() || undefined,
            valueType,
            options: formattedOptions,
        };

        setLoading(true);
        try {
            if (isEdit) {
                const res = await updateOptionSet(optionSet.id, payload);
                if (res.success) {
                    toast.success("Option set updated");
                    onOpenChange(false);
                } else {
                    toast.error(res.error || "Failed to update");
                }
            } else {
                const res = await createOptionSet(payload);
                if (res.success) {
                    toast.success("Option set created");
                    onOpenChange(false);
                } else {
                    toast.error(res.error || "Failed to create set");
                }
            }
            router.refresh();
        } catch (e) {
            toast.error("An error occurred");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-[500px] flex flex-col gap-0 p-0 border-l border-slate-200">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                    <SheetHeader>
                        <SheetTitle className="font-serif text-xl text-slate-800">
                            {isEdit ? "Edit Option Set" : "Create Option Set"}
                        </SheetTitle>
                        <SheetDescription>
                            Define a reusable list of selections for master data fields.
                        </SheetDescription>
                    </SheetHeader>
                </div>

                <ScrollArea className="flex-1 p-6">
                    <div className="space-y-6 pb-[100px]">
                        <div className="space-y-2">
                            <Label>Internal Name <span className="text-red-500">*</span></Label>
                            <Input 
                                placeholder="e.g. ISO_Country_Codes" 
                                value={name} 
                                onChange={(e) => setName(e.target.value)} 
                            />
                            <p className="text-[11px] text-slate-500">Should be unique. Usually uppercase with underscores.</p>
                        </div>

                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Input 
                                placeholder="Optional description..." 
                                value={description} 
                                onChange={(e) => setDescription(e.target.value)} 
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Value Data Type <span className="text-red-500">*</span></Label>
                            <Select 
                                value={valueType} 
                                onValueChange={(v) => setValueType(v as OptionSetValueType)}
                                disabled={isEdit} // Disabling changing type once created for safety
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="STRING">String (Text)</SelectItem>
                                    <SelectItem value="NUMBER">Number</SelectItem>
                                    <SelectItem value="BOOLEAN">Boolean (True/False)</SelectItem>
                                </SelectContent>
                            </Select>
                            {isEdit && <p className="text-[11px] text-amber-600">Data type cannot be changed after creation.</p>}
                        </div>

                        <div className="pt-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <Label className="text-base font-semibold">Options</Label>
                                <Button type="button" variant="outline" size="sm" onClick={handleAddOption} className="h-8">
                                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Option
                                </Button>
                            </div>

                            <div className="space-y-3">
                                {options.map((opt, idx) => (
                                    <div key={idx} className="flex gap-2 items-start bg-slate-50 p-2 rounded-md border border-slate-100">
                                        <div className="grid grid-cols-2 gap-2 flex-1">
                                            <div className="space-y-1">
                                                <Label className="text-[10px] text-slate-500 uppercase tracking-wider">Display Label</Label>
                                                <Input 
                                                    placeholder="e.g. United States" 
                                                    className="h-8 text-sm" 
                                                    value={opt.label}
                                                    onChange={(e) => handleOptionChange(idx, "label", e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] text-slate-500 uppercase tracking-wider">Raw Value</Label>
                                                <Input 
                                                    placeholder={valueType === "NUMBER" ? "123" : valueType === "BOOLEAN" ? "true/false" : "e.g. US"} 
                                                    className="h-8 text-sm font-mono" 
                                                    value={opt.value}
                                                    onChange={(e) => handleOptionChange(idx, "value", e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="mt-[18px] text-slate-400 hover:text-red-500 h-8 w-8 shrink-0"
                                            onClick={() => handleRemoveOption(idx)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                </ScrollArea>

                <div className="p-6 border-t bg-slate-50 flex items-center justify-end gap-3 shrink-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button 
                        onClick={handleSave} 
                        disabled={loading}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[100px]"
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Option Set"}
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
}
