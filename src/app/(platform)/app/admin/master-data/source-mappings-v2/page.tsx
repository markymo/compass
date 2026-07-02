"use client";

import { useState, useEffect, useMemo } from "react";
import { GitBranch, Loader2, AlertTriangle, CheckCircle2, CircleDot, Trash2, Pencil, ChevronsUpDown, Check, Search, ChevronDown, ChevronUp } from "lucide-react";
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
import { getEffectiveMappingDefaults } from "@/actions/user-preferences";
import { DataInspectorPanel } from "@/components/client/admin/source-mappings/data-inspector-panel";
import { TRANSFORM_SELECT_OPTIONS, TRANSFORM_DEFINITION_MAP, getTransformDescription } from "@/lib/master-data/transform-registry";
import { getCountryName } from "@/components/client/fields/AddressValueViewer";
import { resolvePathString } from "@/services/kyc/normalization/pathResolver";
import { MappingFormDialog, type MappingRow, displayScope } from "@/components/client/admin/source-mappings/mapping-form-dialog";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-dialogs";



// ── Constants ─────────────────────────────────────────────────────────────────

/** Visual styling for mappingScope badges — keyed on the *display* label, not the DB value. */
const SCOPE_STYLES: Record<string, string> = {
    RAW_PAYLOAD:  "bg-green-50  text-green-700  border-green-200",
    BASELINE:     "bg-amber-50  text-amber-700  border-amber-200",
    GLEIF_DIRECT: "bg-indigo-50 text-indigo-700 border-indigo-200",
};



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
    const [prefillSubtype, setPrefillSubtype] = useState<string | null>(null);
    const [prefillTransformType, setPrefillTransformType] = useState<string | null>(null);
    const [prefillTransformConfig, setPrefillTransformConfig] = useState<any>(null);
    const [initialTargetFieldNo, setInitialTargetFieldNo] = useState<number | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const tfNo = params.get("targetFieldNo");
            if (tfNo) {
                setInitialTargetFieldNo(parseInt(tfNo, 10));
            }
        }
    }, []);

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

    const [resolvedDefaults, setResolvedDefaults] = useState<any>(null);

    useEffect(() => {
        getEffectiveMappingDefaults().then((res) => {
            setResolvedDefaults({
                gleifLei: res.gleifLei || "213800SN8QHYGA7QUF79",
                chCompanyNo: res.registryOverrides?.RA000585?.registeredAs || "14059418",
                frSiren: res.registryOverrides?.RA000192?.registeredAs || "542051180"
            });
        });
    }, []);

    useEffect(() => {
        getActiveFieldDefinitions().then(r => { if (r.success) setFieldDefs(r.fields); });
    }, []);

    const handleSourceChange = (value: string) => setSelectedValue(value);
    const handleSelectPath = (path: string, payloadSubtype?: string, transformType?: string, transformConfig?: any) => { 
        setPrefillPath(path); 
        setPrefillSubtype(payloadSubtype || null); 
        setPrefillTransformType(transformType || null);
        setPrefillTransformConfig(transformConfig || null);
        setEditingMapping(null); 
        setDialogOpen(true); 
    };
    const handleEdit = (m: MappingRow) => { setEditingMapping(m); setPrefillPath(""); setDialogOpen(true); };
    const handleDeleteClick = (id: string) => setDeleteId(id);
    const handleConfirmDelete = async () => {
        if (!deleteId) return;
        setIsDeleting(true);
        const res = await deleteSourceMapping(deleteId);
        if (res.success) { toast.success("Mapping deleted"); loadMappings(selectedOption); }
        else toast.error(res.error ?? "Failed to delete");
        setIsDeleting(false);
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
                        <MappingTable mappings={mappings} onEdit={handleEdit} onDelete={handleDeleteClick} onToggle={handleToggle} />
                    )}
                </div>

                {/* Right: Live Data Inspector */}
                <div className="flex flex-col gap-2">
                    {/* Explanatory note for first-time users */}
                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <span className="inline-block h-2 w-2 rounded-full bg-amber-400 shrink-0" />
                        Amber highlights indicate source paths already mapped to master fields.
                    </p>
                    {resolvedDefaults ? (
                        <DataInspectorPanel
                            key={selectedValue}
                            sourceType={selectedOption.sourceType}
                            sourceReference={selectedOption.sourceReference}
                            existingMappings={[]}
                            allSourceMappings={inspectorMappings}
                            onSelectPath={handleSelectPath}
                            readOnly={false}
                            title={selectedOption.label}
                            resolvedDefaults={resolvedDefaults}
                            fieldDefinitions={fieldDefs}
                            initialTargetFieldNo={initialTargetFieldNo}
                        />
                    ) : (
                        <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white/50 dark:bg-zinc-900/50 dark:border-zinc-800">
                            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                        </div>
                    )}
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
            initialPayloadSubtype={prefillSubtype}
            initialTransformType={prefillTransformType}
            initialTransformConfig={prefillTransformConfig}
            onSaved={handleSaved}
            resolvedDefaults={resolvedDefaults}
        />
        <ConfirmDeleteDialog
            open={!!deleteId}
            onOpenChange={(open) => { if (!open) setDeleteId(null); }}
            onConfirm={handleConfirmDelete}
            isLoading={isDeleting}
            title="Delete this mapping?"
            description="Are you sure you want to delete this source field mapping? This action cannot be undone."
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


