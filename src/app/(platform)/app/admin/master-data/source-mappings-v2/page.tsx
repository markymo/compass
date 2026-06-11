"use client";

import { useState, useEffect, useMemo } from "react";
import { GitBranch, Loader2, AlertTriangle, CheckCircle2, CircleDot, Trash2, Pencil, ChevronsUpDown, Check, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getSourceMappingsV2, upsertSourceMapping, deleteSourceMapping, toggleSourceMapping, getActiveFieldDefinitions } from "@/actions/source-mappings";
import { SOURCE_OPTIONS, type SourceOption } from "@/lib/source-display";
import { DataInspectorPanel } from "@/components/client/admin/source-mappings/data-inspector-panel";
import { TRANSFORM_SELECT_OPTIONS, TRANSFORM_DEFINITION_MAP, getTransformDescription } from "@/lib/master-data/transform-registry";

// ── Types ─────────────────────────────────────────────────────────────────────

interface MappingRow {
    id: string;
    sourcePath: string;
    targetFieldNo: number;
    mappingScope: string;
    payloadSubtype: string | null;
    transformType: string;
    priority: number;
    isActive: boolean;
    notes: string | null;
    sourceType: string;
    sourceReference: string | null;
    targetField?: {
        fieldNo: number;
        fieldName: string;
        appDataType: string;
        isActive: boolean;
    } | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Visual styling for mappingScope badges — keyed on the *display* label, not the DB value. */
const SCOPE_STYLES: Record<string, string> = {
    RAW_PAYLOAD:  "bg-green-50  text-green-700  border-green-200",
    BASELINE:     "bg-amber-50  text-amber-700  border-amber-200",
    GLEIF_DIRECT: "bg-indigo-50 text-indigo-700 border-indigo-200",
};

const SCOPE_LABELS: Record<string, string> = {
    RAW_PAYLOAD: "Raw Payload",
    BASELINE:    "Baseline",
};

/**
 * Display-layer translation for mappingScope.
 * GLEIF rows store "BASELINE" in the DB (correct Prisma enum value) but should
 * render as "GLEIF_DIRECT" in the UI because GleifNormalizer ignores scope entirely
 * and operates directly on ClientLE.gleifData — the BASELINE label is misleading.
 * RA rows use SCOPE_LABELS as before. No DB values are changed by this function.
 */
function displayScope(rawScope: string, sourceType: string): string {
    if (sourceType === "GLEIF") return "GLEIF_DIRECT";
    return SCOPE_LABELS[rawScope] ?? rawScope;
}

// TRANSFORM_TYPES is now sourced from the central transform-registry (see import above).
// TRANSFORM_SELECT_OPTIONS provides { value, label } pairs for the <Select> dropdown.

const PAYLOAD_SUBTYPES = [
    { value: "COMPANY_PROFILE",  label: "Company Profile" },
    { value: "OFFICERS",         label: "Officers" },
    { value: "PSC",              label: "Persons with Significant Control" },
    { value: "FILING_HISTORY",   label: "Filing History" },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SourceMappingsV2Page() {
    const [selectedValue, setSelectedValue] = useState<string>(SOURCE_OPTIONS[0].value);
    const [mappings, setMappings] = useState<MappingRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [fieldDefs, setFieldDefs] = useState<any[]>([]);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingMapping, setEditingMapping] = useState<MappingRow | null>(null);
    const [prefillPath, setPrefillPath] = useState("");

    const selectedOption: SourceOption = SOURCE_OPTIONS.find(o => o.value === selectedValue) ?? SOURCE_OPTIONS[0];

    const loadMappings = async (option: SourceOption) => {
        setLoading(true);
        setError(null);
        const res = await getSourceMappingsV2(option.sourceType, option.sourceReference);
        if (res.success) setMappings(res.mappings as MappingRow[]);
        else { setError(res.error ?? "Failed to load mappings"); setMappings([]); }
        setLoading(false);
    };

    useEffect(() => {
        loadMappings(selectedOption);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedValue]);

    useEffect(() => {
        getActiveFieldDefinitions().then(r => { if (r.success) setFieldDefs(r.fields); });
    }, []);

    const handleSourceChange = (value: string) => setSelectedValue(value);
    const handleSelectPath = (path: string) => { setPrefillPath(path); setEditingMapping(null); setDialogOpen(true); };
    const handleEdit = (m: MappingRow) => { setEditingMapping(m); setPrefillPath(""); setDialogOpen(true); };
    const handleDelete = async (id: string) => {
        if (!confirm("Delete this mapping? This cannot be undone.")) return;
        const res = await deleteSourceMapping(id);
        if (res.success) { toast.success("Mapping deleted"); loadMappings(selectedOption); }
        else toast.error(res.error ?? "Failed to delete");
    };
    const handleToggle = async (id: string, isActive: boolean) => {
        const res = await toggleSourceMapping(id, isActive);
        if (res.success) loadMappings(selectedOption);
        else toast.error(res.error ?? "Failed to toggle");
    };
    const handleSaved = () => { setDialogOpen(false); loadMappings(selectedOption); };

    const activeCount   = mappings.filter(m => m.isActive).length;
    const baselineCount = mappings.filter(m => m.mappingScope === "BASELINE").length;

    // Project MappingRow[] → CrossFieldMapping[] for DataInspectorPanel's allSourceMappings prop.
    // V2 has no "field being edited", so all mapped paths appear as amber indicators.
    const inspectorMappings = mappings.map(m => ({
        sourceType: m.sourceType,
        sourceReference: m.sourceReference,
        sourcePath: m.sourcePath,
        fieldNo: m.targetFieldNo,
        fieldName: m.targetField?.fieldName ?? `Field ${m.targetFieldNo}`,
        isActive: m.isActive,
    }));

    return (
        <>
            <div className="space-y-6">
            {/* ── Page Header ─────────────────────────────────────────── */}
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                    <div className="bg-green-100 dark:bg-green-900/30 p-2.5 rounded-lg">
                        <GitBranch className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                            Source Field Mappings
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Configure how external data sources map to master fields.
                            Select a source below to view its active mapping configuration.
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Source Selector ──────────────────────────────────────── */}
            <div className="flex items-center gap-3">
                <Label className="text-sm font-medium text-slate-600 dark:text-slate-400 shrink-0">
                    Source:
                </Label>
                <Select value={selectedValue} onValueChange={handleSourceChange}>
                    <SelectTrigger className="w-[300px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {SOURCE_OPTIONS.map((opt, idx) => (
                            <div key={opt.value}>
                                {/* Separator between GLEIF and RA sources */}
                                {idx === 1 && (
                                    <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 border-t mt-1 pt-2">
                                        Registration Authorities
                                    </div>
                                )}
                                <SelectItem value={opt.value}>
                                    <div className="flex items-center gap-2">
                                        <span>{opt.label}</span>
                                        {!opt.supportsLiveBrowser && (
                                            <Badge variant="outline" className="text-[9px] text-slate-400 border-slate-200">
                                                No live browse
                                            </Badge>
                                        )}
                                    </div>
                                </SelectItem>
                            </div>
                        ))}
                    </SelectContent>
                </Select>

                {/* Quick summary stats */}
                {!loading && mappings.length > 0 && (
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                            {activeCount} active
                        </span>
                        <span className="flex items-center gap-1">
                            <CircleDot className="h-3.5 w-3.5 text-slate-400" />
                            {mappings.length - activeCount} inactive
                        </span>
                        {baselineCount > 0 && (
                            <span className="flex items-center gap-1 text-amber-600">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                {baselineCount} legacy BASELINE scope
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* ── Main Content Grid ────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Mapping Table (2/3 width) */}
                <div className="lg:col-span-2">
                    {loading ? (
                        <div className="flex justify-center items-center py-20">
                            <Loader2 className="h-8 w-8 animate-spin text-green-500" />
                        </div>
                    ) : error ? (
                        <Card className="border-red-200">
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-2 text-red-600 text-sm">
                                    <AlertTriangle className="h-4 w-4 shrink-0" />
                                    <span>{error}</span>
                                </div>
                            </CardContent>
                        </Card>
                    ) : mappings.length === 0 ? (
                        <Card className="border-dashed">
                            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                                <div className="bg-slate-100 dark:bg-slate-800 h-12 w-12 rounded-full flex items-center justify-center mb-4">
                                    <GitBranch className="h-6 w-6 text-slate-400" />
                                </div>
                                <h3 className="text-base font-medium text-slate-900 dark:text-slate-100 mb-1">
                                    No mappings for {selectedOption.label}
                                </h3>
                                <p className="text-sm text-slate-500 max-w-sm">
                                    Mappings for this source can be added from the Master Data Manager
                                    field editor (field detail sheet → Source Mappings section).
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <MappingTable mappings={mappings} onEdit={handleEdit} onDelete={handleDelete} onToggle={handleToggle} />
                    )}
                </div>

                {/* Right: Live Data Inspector */}
                <div className="flex flex-col gap-2">
                    {/* Explanatory note for first-time users */}
                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <span className="inline-block h-2 w-2 rounded-full bg-amber-400 shrink-0" />
                        Amber highlights indicate source paths already mapped to master fields.
                    </p>
                    <DataInspectorPanel
                        key={selectedValue}
                        sourceType={selectedOption.sourceType}
                        sourceReference={selectedOption.sourceReference}
                        existingMappings={[]}
                        allSourceMappings={inspectorMappings}
                        onSelectPath={handleSelectPath}
                        readOnly={false}
                        title={selectedOption.label}
                    />
                </div>
            </div>
        </div>
        <MappingFormDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            selectedOption={selectedOption}
            fieldDefs={fieldDefs}
            existingMapping={editingMapping}
            initialSourcePath={prefillPath}
            onSaved={handleSaved}
        />
        </>
    );
}

// ── MappingTable ───────────────────────────────────────────────────────────────

function MappingTable({ mappings, onEdit, onDelete, onToggle }: {
    mappings: MappingRow[];
    onEdit: (m: MappingRow) => void;
    onDelete: (id: string) => void;
    onToggle: (id: string, active: boolean) => void;
}) {
    return (
        <Card>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                            <Th>Source Path</Th>
                            <Th>Target Field</Th>
                            <Th center>Scope</Th>
                            <Th center>Subtype</Th>
                            <Th center>Transform</Th>
                            <Th center>Priority</Th>
                            <Th center>Active</Th>
                            <Th center>{null}</Th>
                        </tr>
                    </thead>
                    <tbody>
                        {mappings.map(m => (
                            <tr key={m.id} className={cn("border-b border-slate-100 dark:border-slate-800 last:border-b-0", !m.isActive && "opacity-50")}>
                                <Td><code className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono text-green-700 dark:text-green-400 break-all">{m.sourcePath}</code></Td>
                                <Td>
                                    <div className="flex items-center gap-1.5">
                                        <Badge variant="outline" className="text-[10px] font-mono px-1.5 shrink-0">F{m.targetFieldNo}</Badge>
                                        <span className="text-sm text-slate-700 dark:text-slate-300 truncate max-w-[140px]">{m.targetField?.fieldName ?? "—"}</span>
                                    </div>
                                </Td>
                                <Td center>
                                    {(() => {
                                        const label = displayScope(m.mappingScope, m.sourceType);
                                        return (
                                            <Badge variant="outline" className={cn("text-[10px]", SCOPE_STYLES[label] ?? "bg-slate-50 text-slate-500 border-slate-200")}>
                                                {label}
                                            </Badge>
                                        );
                                    })()}
                                </Td>
                                <Td center>
                                    {m.payloadSubtype
                                        ? <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">{m.payloadSubtype}</Badge>
                                        : <span className="text-slate-300 text-xs">—</span>}
                                </Td>
                                <Td center>
                                    <Badge
                                        variant="secondary"
                                        className="text-[10px] max-w-[140px] truncate block text-center"
                                        title={m.transformType}
                                    >
                                        {TRANSFORM_DEFINITION_MAP[m.transformType]?.label ?? m.transformType}
                                    </Badge>
                                </Td>
                                <Td center><span className="font-mono text-xs text-slate-600 dark:text-slate-400">{m.priority}</span></Td>
                                <Td center>
                                    <Switch checked={m.isActive} onCheckedChange={v => onToggle(m.id, v)} />
                                </Td>
                                <Td center>
                                    <div className="flex items-center gap-1">
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-indigo-600" onClick={() => onEdit(m)} title="Edit">
                                            <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-600" onClick={() => onDelete(m.id)} title="Delete">
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </Td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );
}

// ── Table cell helpers ────────────────────────────────────────────────────────

function Th({
    children,
    center,
}: {
    children?: React.ReactNode;
    center?: boolean;
}) {
    return (
        <th
            className={cn(
                "px-3 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap",
                center ? "text-center" : "text-left"
            )}
        >
            {children}
        </th>
    );
}

function Td({ children, center }: { children: React.ReactNode; center?: boolean }) {
    return (
        <td className={cn("px-3 py-2.5", center && "text-center")}>
            {children}
        </td>
    );
}

// ── Add / Edit Mapping Dialog ─────────────────────────────────────────────────

const GLEIF_SCOPE_DEFAULT    = "BASELINE";
const RA_SCOPE_DEFAULT       = "RAW_PAYLOAD";
const RA_SUBTYPE_DEFAULT     = "COMPANY_PROFILE";

function MappingFormDialog({ open, onOpenChange, selectedOption, fieldDefs, existingMapping, initialSourcePath, onSaved }: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    selectedOption: SourceOption;
    fieldDefs: any[];
    existingMapping: MappingRow | null;
    initialSourcePath: string;
    onSaved: () => void;
}) {
    const isGleif  = selectedOption.sourceType === "GLEIF";
    const isEdit   = !!existingMapping;

    const [sourcePath,    setSourcePath]    = useState("");
    const [targetFieldNo, setTargetFieldNo] = useState("");
    const [mappingScope,  setMappingScope]  = useState(isGleif ? GLEIF_SCOPE_DEFAULT : RA_SCOPE_DEFAULT);
    const [payloadSubtype,setPayloadSubtype]= useState(isGleif ? "NONE" : RA_SUBTYPE_DEFAULT);
    const [transformType, setTransformType] = useState("DIRECT");
    const [priority,      setPriority]      = useState("100");
    const [notes,         setNotes]         = useState("");
    const [saving,        setSaving]        = useState(false);

    const transformDescription = getTransformDescription(transformType);

    useEffect(() => {
        if (!open) return;
        setSourcePath(existingMapping?.sourcePath ?? initialSourcePath ?? "");
        setTargetFieldNo(existingMapping?.targetFieldNo?.toString() ?? "");
        setMappingScope(existingMapping?.mappingScope ?? (isGleif ? GLEIF_SCOPE_DEFAULT : RA_SCOPE_DEFAULT));
        setPayloadSubtype(existingMapping?.payloadSubtype ?? (isGleif ? "NONE" : RA_SUBTYPE_DEFAULT));
        setTransformType(existingMapping?.transformType ?? "DIRECT");
        setPriority(existingMapping?.priority?.toString() ?? "100");
        setNotes(existingMapping?.notes ?? "");
    }, [open, existingMapping, initialSourcePath, isGleif]);

    const handleSave = async () => {
        if (!sourcePath.trim() || !targetFieldNo) return;
        setSaving(true);
        const res = await upsertSourceMapping({
            id:             existingMapping?.id,
            sourceType:     selectedOption.sourceType as any,
            sourceReference:selectedOption.sourceReference,
            sourcePath:     sourcePath.trim(),
            targetFieldNo:  parseInt(targetFieldNo),
            transformType:  transformType as any,
            priority:       parseInt(priority) || 100,
            notes:          notes || undefined,
            mappingScope,
            payloadSubtype: (payloadSubtype === "NONE" || !payloadSubtype) ? null : payloadSubtype,
        });
        if (res.success) {
            if (res.warnings?.length) res.warnings.forEach((w: string) => toast.warning(w));
            toast.success(isEdit ? "Mapping updated" : "Mapping created");
            onSaved();
        } else {
            toast.error(res.error ?? "Failed to save");
        }
        setSaving(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{isEdit ? "Edit" : "Add"} Source Mapping</DialogTitle>
                    <DialogDescription>
                        <span className="font-medium">{selectedOption.label}</span>
                        {selectedOption.sourceReference && (
                            <span className="ml-1 text-slate-400">· {selectedOption.sourceReference}</span>
                        )}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                    <div className="grid gap-1.5">
                        <Label htmlFor="v2-sourcePath">Source Path</Label>
                        <Input
                            id="v2-sourcePath"
                            value={sourcePath}
                            onChange={e => setSourcePath(e.target.value)}
                            placeholder="e.g. company_name"
                            className="font-mono text-sm"
                            readOnly={!!initialSourcePath && !isEdit}
                        />
                        <p className="text-[10px] text-slate-400">Dot-notation path relative to payload root.</p>
                    </div>
                    <TargetFieldPicker fieldDefs={fieldDefs} value={targetFieldNo} onChange={setTargetFieldNo} />
                    {/* Scope / Subtype — implementation detail, shown for debugging only */}
                    <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-400 bg-slate-50 border border-slate-100 rounded px-2.5 py-1.5">
                        <span className="text-slate-300">scope:</span>
                        <span className="text-slate-500">{displayScope(mappingScope, selectedOption.sourceType)}</span>
                        <span className="text-slate-200 mx-0.5">·</span>
                        <span className="text-slate-300">subtype:</span>
                        <span className="text-slate-500">{(!payloadSubtype || payloadSubtype === "NONE") ? "—" : payloadSubtype}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                            <Label>Transform</Label>
                            <Select value={transformType} onValueChange={setTransformType}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {TRANSFORM_SELECT_OPTIONS.map(t => (
                                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {transformDescription && (
                                <p className="text-[11px] text-slate-500 leading-snug">
                                    {transformDescription}
                                </p>
                            )}
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="v2-priority">Priority</Label>
                            <Input id="v2-priority" type="number" min={1} value={priority} onChange={e => setPriority(e.target.value)} />
                            <p className="text-[10px] text-slate-400">Lower = higher precedence.</p>
                        </div>
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor="v2-notes">Notes (optional)</Label>
                        <Input id="v2-notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. UK registered company name" />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving || !sourcePath.trim() || !targetFieldNo}>
                        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        {isEdit ? "Update" : "Create"} Mapping
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ── Target Field Picker ───────────────────────────────────────────────────────

const DATA_TYPE_COLORS: Record<string, string> = {
    TEXT:    "bg-blue-50 text-blue-600 border-blue-100",
    NUMBER:  "bg-amber-50 text-amber-600 border-amber-100",
    DATE:    "bg-purple-50 text-purple-600 border-purple-100",
    BOOLEAN: "bg-teal-50 text-teal-600 border-teal-100",
    JSON:    "bg-orange-50 text-orange-600 border-orange-100",
    SELECT:  "bg-indigo-50 text-indigo-600 border-indigo-100",
};

function TargetFieldPicker({ fieldDefs, value, onChange }: {
    fieldDefs: any[];
    value: string;
    onChange: (v: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const selected = fieldDefs.find((f: any) => String(f.fieldNo) === value);
    const grouped = useMemo(() => {
        const g: Record<string, any[]> = {};
        for (const f of fieldDefs) {
            const cat = f.masterDataCategory?.displayName ?? "Uncategorized";
            (g[cat] = g[cat] ?? []).push(f);
        }
        return Object.entries(g).sort(([a], [b]) => a === "Uncategorized" ? 1 : b === "Uncategorized" ? -1 : a.localeCompare(b));
    }, [fieldDefs]);

    return (
        <div className="grid gap-1.5">
            <Label>Target Field <Badge variant="outline" className="text-[9px] font-normal text-slate-400 border-slate-200 px-1.5 ml-1">{fieldDefs.length} available</Badge></Label>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={open}
                        className={cn("w-full justify-between h-auto min-h-[40px] py-2 font-normal text-left", !value && "text-slate-400")}>
                        {selected ? (
                            <div className="flex items-center gap-2 overflow-hidden">
                                <Badge variant="outline" className="font-mono text-[10px] px-1.5 shrink-0 bg-slate-50 border-slate-200 text-slate-600">F{selected.fieldNo}</Badge>
                                <span className="truncate text-sm font-medium text-slate-800">{selected.fieldName}</span>
                                <Badge className={cn("text-[9px] px-1 py-0 border shrink-0 shadow-none", DATA_TYPE_COLORS[selected.appDataType] ?? "bg-slate-50 text-slate-500 border-slate-200")}>{selected.appDataType}</Badge>
                            </div>
                        ) : <span className="text-sm">Search and select a target field…</span>}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[460px] p-0" align="start">
                    <Command>
                        <CommandInput placeholder="Search by name, number, or category…" />
                        <CommandList className="max-h-[300px]">
                            <CommandEmpty>
                                <div className="flex flex-col items-center gap-1 py-6 text-slate-400">
                                    <Search className="h-5 w-5 opacity-40" />
                                    <span className="text-sm">No matching fields</span>
                                </div>
                            </CommandEmpty>
                            {grouped.map(([cat, fields]) => (
                                <CommandGroup key={cat} heading={<span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{cat} ({fields.length})</span>}>
                                    {fields.map((f: any) => {
                                        const sel = String(f.fieldNo) === value;
                                        return (
                                            <CommandItem key={f.fieldNo} value={`${f.fieldNo} ${f.fieldName} ${cat}`}
                                                onSelect={() => { onChange(String(f.fieldNo)); setOpen(false); }}
                                                className={cn("flex items-center gap-2.5 py-2 px-2 cursor-pointer", sel && "bg-green-50/80")}>
                                                <div className={cn("flex items-center justify-center h-5 w-5 rounded-md border shrink-0", sel ? "bg-green-600 border-green-600 text-white" : "border-slate-200 bg-white text-transparent")}>
                                                    <Check className="h-3 w-3" />
                                                </div>
                                                <Badge variant="outline" className="font-mono text-[10px] px-1.5 shrink-0 bg-slate-50/80 border-slate-200 text-slate-500 shadow-none">F{f.fieldNo}</Badge>
                                                <span className={cn("flex-1 text-sm truncate", sel ? "font-semibold text-green-800" : "text-slate-700")}>{f.fieldName}</span>
                                                <Badge className={cn("text-[9px] px-1.5 py-0 border shadow-none shrink-0", DATA_TYPE_COLORS[f.appDataType] ?? "bg-slate-50 text-slate-500 border-slate-200")}>{f.appDataType}</Badge>
                                            </CommandItem>
                                        );
                                    })}
                                </CommandGroup>
                            ))}
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    );
}
