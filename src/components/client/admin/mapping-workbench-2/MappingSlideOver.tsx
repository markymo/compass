"use client";

import { useState, useEffect } from "react";
import { Wb2PathMapping } from "@/actions/mapping-workbench-2";
import { upsertSourceMapping, toggleSourceMapping, deleteSourceMapping } from "@/actions/source-mappings";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TRANSFORM_TYPES = [
    { value: "DIRECT",           label: "Direct (as-is)" },
    { value: "DATE_TO_ISO",      label: "Date → ISO (YYYY-MM-DD)" },
    { value: "DATETIME_TO_ISO",  label: "DateTime → ISO" },
    { value: "COUNTRY_TO_NAME",  label: "Country Code → Name" },
    { value: "COUNTRY_TO_ISO2",  label: "Country → ISO Alpha-2" },
    { value: "ENUM_MAP",         label: "Enum Map (via config)" },
    { value: "FIRST_ARRAY_ITEM", label: "First Array Item" },
    { value: "JOIN_ARRAY",       label: "Join Array" },
    { value: "TO_ADDRESS_OBJECT",label: "→ Address Object" },
    { value: "TO_PARTY_OBJECT",  label: "→ Party Object" },
    { value: "TO_PARTY_LIST",    label: "→ Party List" },
];

export interface MappingSlideOverProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;

    // Source side (always set)
    sourceType: string;
    sourceReference: string | null;
    sourcePath: string;
    sourceLabel: string;
    pathMeaning: string | null;
    exampleValue: string | null;

    // Target side
    targetFieldNo: number;
    targetFieldName: string;

    // If editing, the existing mapping
    existingMapping: Wb2PathMapping | null;
}

export function MappingSlideOver({
    open, onOpenChange, onSuccess,
    sourceType, sourceReference, sourcePath, sourceLabel, pathMeaning, exampleValue,
    targetFieldNo, targetFieldName,
    existingMapping,
}: MappingSlideOverProps) {
    const isEdit = !!existingMapping;

    const [transformType, setTransformType] = useState("DIRECT");
    const [priority, setPriority] = useState(50);
    const [confidence, setConfidence] = useState(0.9);
    const [notes, setNotes] = useState("");
    const [isActive, setIsActive] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    // Sync form when existing mapping changes
    useEffect(() => {
        if (existingMapping) {
            setTransformType(existingMapping.transformType ?? "DIRECT");
            setPriority(existingMapping.priority ?? 50);
            setConfidence(existingMapping.confidenceDefault ?? 0.9);
            setNotes(existingMapping.notes ?? "");
            setIsActive(existingMapping.isActive ?? true);
        } else {
            setTransformType("DIRECT");
            setPriority(50);
            setConfidence(0.9);
            setNotes("");
            setIsActive(true);
        }
        setConfirmDelete(false);
    }, [existingMapping, open]);

    async function handleSave() {
        setSaving(true);
        try {
            const res = await upsertSourceMapping({
                id: existingMapping?.mappingId,
                sourceType: sourceType as any,
                sourceReference: sourceReference ?? undefined,
                sourcePath,
                targetFieldNo,
                transformType: transformType as any,
                priority,
                confidenceDefault: confidence,
                notes: notes.trim() || undefined,
            });
            if (res.success) {
                toast.success(isEdit ? "Mapping updated" : "Mapping created");
                onOpenChange(false);
                onSuccess();
            } else {
                toast.error((res as any).error ?? "Failed to save mapping");
            }
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete() {
        if (!existingMapping || !confirmDelete) {
            setConfirmDelete(true);
            return;
        }
        setDeleting(true);
        try {
            const res = await deleteSourceMapping(existingMapping.mappingId);
            if (res.success) {
                toast.success("Mapping deleted");
                onOpenChange(false);
                onSuccess();
            } else {
                toast.error((res as any).error ?? "Failed to delete");
            }
        } finally {
            setDeleting(false);
        }
    }

    async function handleToggle() {
        if (!existingMapping) return;
        const res = await toggleSourceMapping(existingMapping.mappingId, !existingMapping.isActive);
        if (res.success) {
            toast.success(existingMapping.isActive ? "Mapping deactivated" : "Mapping activated");
            onSuccess();
        } else {
            toast.error((res as any).error ?? "Failed to toggle");
        }
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-[440px] sm:w-[520px] flex flex-col gap-0 p-0">
                <SheetHeader className="px-6 pt-6 pb-4 border-b border-slate-100 space-y-1">
                    <SheetTitle className="text-base font-semibold text-slate-900">
                        {isEdit ? "Edit Mapping" : "New Mapping"}
                    </SheetTitle>
                    <SheetDescription className="text-xs text-slate-500">
                        {sourceLabel}
                    </SheetDescription>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                    {/* Source path (read-only) */}
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Source Path</Label>
                        <div className="bg-slate-50 border border-slate-200 rounded-md px-3 py-2.5 space-y-1">
                            <code className="text-xs font-mono text-slate-800 break-all">{sourcePath}</code>
                            {pathMeaning && (
                                <p className="text-[11px] text-slate-500">{pathMeaning}</p>
                            )}
                            {exampleValue && (
                                <div className="mt-1.5 flex items-center gap-1.5">
                                    <span className="text-[9px] font-bold uppercase tracking-wide text-emerald-600">Live</span>
                                    <code className="text-[11px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-1.5 py-0.5 max-w-full truncate">{exampleValue}</code>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Target field (read-only) */}
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Target Master Field</Label>
                        <div className="bg-indigo-50 border border-indigo-100 rounded-md px-3 py-2.5">
                            <span className="text-xs font-mono text-indigo-500 mr-2">F{targetFieldNo}</span>
                            <span className="text-sm font-semibold text-indigo-900">{targetFieldName}</span>
                        </div>
                    </div>

                    {/* Transform */}
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Transform</Label>
                        <Select value={transformType} onValueChange={setTransformType}>
                            <SelectTrigger className="h-9 text-sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {TRANSFORM_TYPES.map(t => (
                                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Priority + Confidence */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Priority</Label>
                            <Input
                                type="number"
                                min={1} max={999}
                                value={priority}
                                onChange={e => setPriority(Number(e.target.value))}
                                className="h-9 text-sm"
                            />
                            <p className="text-[10px] text-slate-400">Lower = higher priority</p>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Confidence</Label>
                            <Input
                                type="number"
                                min={0} max={1} step={0.05}
                                value={confidence}
                                onChange={e => setConfidence(Number(e.target.value))}
                                className="h-9 text-sm"
                            />
                            <p className="text-[10px] text-slate-400">0.0 – 1.0</p>
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Admin Notes / Meaning</Label>
                        <Textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="e.g. Official registered company name at Companies House"
                            className="text-sm resize-none h-20"
                        />
                        <p className="text-[10px] text-slate-400">Shown as the human-readable meaning for this path in the workbench</p>
                    </div>

                    {/* Active toggle — only shown when editing */}
                    {isEdit && (
                        <div className="flex items-center justify-between py-1">
                            <div>
                                <p className="text-sm font-medium text-slate-700">Active</p>
                                <p className="text-xs text-slate-400">Inactive mappings are ignored during data ingestion</p>
                            </div>
                            <Switch checked={existingMapping?.isActive ?? true} onCheckedChange={handleToggle} />
                        </div>
                    )}
                </div>

                {/* Footer actions */}
                <div className="px-6 py-4 border-t border-slate-100 flex items-center gap-3">
                    <Button onClick={handleSave} disabled={saving} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white">
                        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        {isEdit ? "Save Changes" : "Create Mapping"}
                    </Button>

                    {isEdit && existingMapping && (
                        <Button
                            variant="outline"
                            onClick={handleDelete}
                            disabled={deleting}
                            className={cn(
                                "border transition-colors",
                                confirmDelete
                                    ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                                    : "border-slate-200 text-slate-600 hover:text-red-600 hover:border-red-200"
                            )}
                        >
                            {deleting
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : confirmDelete
                                ? <><AlertTriangle className="w-3.5 h-3.5 mr-1.5" />Confirm delete</>
                                : <Trash2 className="w-4 h-4" />
                            }
                        </Button>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
