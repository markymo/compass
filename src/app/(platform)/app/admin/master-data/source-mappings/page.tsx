"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
    ColumnSizingState
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { fetchLiveRegistryRecord } from "@/actions/registry-live";
import {
    GitBranch, Plus, Loader2, Play, Zap, CheckCircle2, AlertTriangle,
    ChevronRight, Eye, ArrowRight, Info, FileJson, RefreshCw, Search, Trash2,
    ChevronsUpDown, Check
} from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
    getSourceMappings,
    upsertSourceMapping,
    toggleSourceMapping,
    testSourceMapping,
    testAllSourceMappings,
    bootstrapDefaultMappings,
    getAvailableSourcePaths,
    getSamplePayloads,
    getActiveFieldDefinitions,
    deleteSourceMapping,
} from "@/actions/source-mappings";
import { DataInspectorPanel } from "@/components/client/admin/source-mappings/data-inspector-panel";
import { getUserPreferences, updateUserPreferences } from "@/actions/user-preferences";

const TRANSFORM_TYPES = [
    { value: 'DIRECT', label: 'Direct (as-is)' },
    { value: 'DATE_TO_ISO', label: 'Date → ISO (YYYY-MM-DD)' },
    { value: 'DATETIME_TO_ISO', label: 'DateTime → ISO' },
    { value: 'COUNTRY_TO_NAME', label: 'Country Code → Name' },
    { value: 'COUNTRY_TO_ISO2', label: 'Country → ISO Alpha-2' },
    { value: 'ENUM_MAP', label: 'Enum Map (via config)' },
    { value: 'FIRST_ARRAY_ITEM', label: 'First Array Item' },
    { value: 'JOIN_ARRAY', label: 'Join Array' },
];

export default function SourceMappingsPage() {
    const [sourceType, setSourceType] = useState("GLEIF");
    const [mappings, setMappings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedMapping, setSelectedMapping] = useState<any>(null);
    const [previewResult, setPreviewResult] = useState<any>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [testAllResults, setTestAllResults] = useState<any>(null);
    const [testAllLoading, setTestAllLoading] = useState(false);
    const [availablePaths, setAvailablePaths] = useState<string[]>([]);
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [editMapping, setEditMapping] = useState<any>(null);
    const [fieldDefs, setFieldDefs] = useState<any[]>([]);
    
    // For passing paths from the Inspector to the Form
    const [prefilledPath, setPrefilledPath] = useState<string>("");

    // -- Column Sizing State (persisted per user) --
    const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});

    const handleSelectPathFromInspector = (path: string) => {
        setPrefilledPath(path);
        setAddDialogOpen(true);
    };

    const loadData = async () => {
        setLoading(true);
        const [mappingRes, pathRes] = await Promise.all([
            getSourceMappings(sourceType),
            getAvailableSourcePaths(sourceType),
        ]);
        if (mappingRes.success) setMappings(mappingRes.mappings);
        if (pathRes.success) setAvailablePaths(pathRes.paths);
        setLoading(false);
    };

    useEffect(() => {
        loadData();
        setSelectedMapping(null);
        setPreviewResult(null);
        setTestAllResults(null);
    }, [sourceType]);

    useEffect(() => {
        getActiveFieldDefinitions().then(res => {
            if (res.success) setFieldDefs(res.fields);
        });
        // Load saved column sizes
        getUserPreferences().then(res => {
            if (res.success && res.preferences?.sourceMappingsTable?.columnSizing) {
                setColumnSizing(res.preferences.sourceMappingsTable.columnSizing);
            }
        });
    }, []);

    // Persist column sizing
    useEffect(() => {
        if (Object.keys(columnSizing).length === 0) return;
        const timeoutId = setTimeout(() => {
            updateUserPreferences({
                sourceMappingsTable: { columnSizing }
            });
        }, 1000);
        return () => clearTimeout(timeoutId);
    }, [columnSizing]);

    // -- TanStack Table column definitions --
    const tableColumns = useMemo<ColumnDef<any>[]>(() => [
        {
            id: "sourcePath",
            accessorKey: "sourcePath",
            header: "Source Path",
            size: 280,
            minSize: 120,
        },
        {
            id: "targetField",
            accessorKey: "targetFieldNo",
            header: "Target Field",
            size: 200,
            minSize: 100,
        },
        {
            id: "transformType",
            accessorKey: "transformType",
            header: "Transform",
            size: 120,
            minSize: 80,
        },
        {
            id: "confidence",
            accessorKey: "confidenceDefault",
            header: "Conf",
            size: 65,
            minSize: 50,
        },
        {
            id: "priority",
            accessorKey: "priority",
            header: "Pri",
            size: 55,
            minSize: 40,
        },
        {
            id: "active",
            accessorKey: "isActive",
            header: "Active",
            size: 60,
            minSize: 50,
            enableResizing: false,
        },
        {
            id: "actions",
            header: "",
            size: 70,
            minSize: 60,
            enableResizing: false,
        },
    ], []);

    const mappingsTable = useReactTable({
        data: mappings,
        columns: tableColumns,
        columnResizeMode: "onChange",
        getCoreRowModel: getCoreRowModel(),
        onColumnSizingChange: setColumnSizing,
        state: { columnSizing },
    });

    const handleToggle = async (id: string, isActive: boolean) => {
        const res = await toggleSourceMapping(id, isActive);
        if (res.success) {
            toast.success(isActive ? "Mapping activated" : "Mapping deactivated");
            loadData();
        } else {
            toast.error(res.error || "Failed to toggle");
        }
    };

    const handlePreview = async (mapping: any) => {
        setSelectedMapping(mapping);
        setPreviewLoading(true);
        const res = await testSourceMapping(mapping.id);
        setPreviewResult(res.success ? res.result : null);
        setPreviewLoading(false);
    };

    const handleTestAll = async () => {
        setTestAllLoading(true);
        const res = await testAllSourceMappings(sourceType);
        setTestAllResults(res);
        setTestAllLoading(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this mapping?")) return;
        
        const res = await deleteSourceMapping(id);
        if (res.success) {
            toast.success("Mapping deleted");
            loadData();
            if (selectedMapping?.id === id) {
                setSelectedMapping(null);
                setPreviewResult(null);
            }
        } else {
            toast.error(res.error || "Failed to delete");
        }
    };

    const handleBootstrap = async () => {
        const res = await bootstrapDefaultMappings(sourceType);
        if (res.success) {
            toast.success(res.message);
            loadData();
        } else {
            toast.error(res.error || "Bootstrap failed");
        }
    };

    const hasNoMappings = !loading && mappings.length === 0;

    return (
        <div className="space-y-6">
            {/* Header */}
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
                            Configure how external data sources map to master fields
                        </p>
                    </div>
                </div>
            </div>

            {/* Source Selector */}
            <div className="flex items-center gap-3">
                <Label className="text-sm font-medium text-slate-600">Source:</Label>
                <Select value={sourceType} onValueChange={setSourceType}>
                    <SelectTrigger className="w-[200px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="GLEIF">GLEIF</SelectItem>
                        <SelectItem value="REGISTRATION_AUTHORITY">Registration Authority (Super Schema)</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-green-500" />
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Mapping Table */}
                        <div className="lg:col-span-2 space-y-4">
                            {/* Actions Bar */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <MappingFormDialog
                                    open={addDialogOpen}
                                    onOpenChange={setAddDialogOpen}
                                    sourceType={sourceType}
                                    availablePaths={availablePaths}
                                    fieldDefs={fieldDefs}
                                    onSave={loadData}
                                    initialSourcePath={prefilledPath}
                                />
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleTestAll}
                                    disabled={testAllLoading || mappings.length === 0}
                                >
                                    {testAllLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                                    Test All Mappings
                                </Button>
                                {hasNoMappings && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleBootstrap}
                                        className="border-green-200 text-green-700 hover:bg-green-50"
                                    >
                                        <Zap className="h-4 w-4 mr-2" />
                                        Bootstrap Defaults
                                    </Button>
                                )}
                            </div>

                            {/* Table */}
                            {hasNoMappings ? (
                                <Card className="border-dashed">
                                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                                        <div className="bg-slate-100 dark:bg-slate-800 h-12 w-12 rounded-full flex items-center justify-center mb-4">
                                            <GitBranch className="h-6 w-6 text-slate-400" />
                                        </div>
                                        <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">No mappings configured</h3>
                                        <p className="text-sm text-slate-500 mb-4 max-w-sm">
                                            Use &quot;Bootstrap Defaults&quot; to seed the standard {sourceType} mappings, or add them manually.
                                        </p>
                                    </CardContent>
                                </Card>
                            ) : (
                                <Card>
                                    <div className="overflow-x-auto">
                                        <table style={{ width: mappingsTable.getTotalSize(), tableLayout: "fixed" }}>
                                            <thead>
                                                {mappingsTable.getHeaderGroups().map(headerGroup => (
                                                    <tr key={headerGroup.id} className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200">
                                                        {headerGroup.headers.map(header => {
                                                            const colInfo: Record<string, string> = {
                                                                sourcePath: "Where to find this value in the source JSON",
                                                                targetField: "Which master field receives this value",
                                                                transformType: "DIRECT copies as-is. Others convert dates, country codes, or arrays before saving",
                                                                confidence: "How trustworthy this value is (0–1). Reduced automatically if a transform fails",
                                                                priority: "Tiebreaker when two mappings write to the same field. The lower number wins",
                                                                active: "Turn off without deleting. Inactive mappings are ignored",
                                                            };
                                                            const isCenter = ["confidence", "priority", "active"].includes(header.id);
                                                            const isRight = header.id === "actions";
                                                            return (
                                                                <th
                                                                    key={header.id}
                                                                    className={cn(
                                                                        "relative px-3 py-2.5 text-xs font-semibold text-slate-500 select-none",
                                                                        isCenter && "text-center",
                                                                        isRight && "text-right"
                                                                    )}
                                                                    style={{ width: header.getSize() }}
                                                                >
                                                                    {colInfo[header.id] ? (
                                                                        <ColumnInfo
                                                                            label={flexRender(header.column.columnDef.header, header.getContext()) as string}
                                                                            info={colInfo[header.id]}
                                                                            center={isCenter}
                                                                        />
                                                                    ) : (
                                                                        flexRender(header.column.columnDef.header, header.getContext())
                                                                    )}
                                                                    {header.column.getCanResize() && (
                                                                        <div
                                                                            onMouseDown={header.getResizeHandler()}
                                                                            onTouchStart={header.getResizeHandler()}
                                                                            className={cn(
                                                                                "absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none touch-none transition-colors hover:bg-indigo-500",
                                                                                header.column.getIsResizing() && "bg-indigo-500"
                                                                            )}
                                                                        />
                                                                    )}
                                                                </th>
                                                            );
                                                        })}
                                                    </tr>
                                                ))}
                                            </thead>
                                            <tbody>
                                                {mappings.map((m: any) => (
                                                    <tr
                                                        key={m.id}
                                                        className={cn(
                                                            "cursor-pointer transition-colors border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50",
                                                            !m.isActive && "opacity-50",
                                                            selectedMapping?.id === m.id && "bg-green-50/50 dark:bg-green-900/10"
                                                        )}
                                                        onClick={() => handlePreview(m)}
                                                    >
                                                        <td className="px-3 py-2.5" style={{ width: mappingsTable.getColumn("sourcePath")?.getSize() }}>
                                                            <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono text-green-700 dark:text-green-400">
                                                                {m.sourcePath}
                                                            </code>
                                                        </td>
                                                        <td className="px-3 py-2.5" style={{ width: mappingsTable.getColumn("targetField")?.getSize() }}>
                                                            <div className="flex items-center gap-1.5">
                                                                <Badge variant="outline" className="text-[10px] font-mono px-1.5">
                                                                    F{m.targetFieldNo}
                                                                </Badge>
                                                                <span className="text-sm text-slate-700 dark:text-slate-300 truncate">
                                                                    {m.targetField?.fieldName}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2.5" style={{ width: mappingsTable.getColumn("transformType")?.getSize() }}>
                                                            <Badge variant="secondary" className="text-[10px]">
                                                                {m.transformType}
                                                            </Badge>
                                                        </td>
                                                        <td className="px-3 py-2.5 text-center text-sm font-mono text-slate-600" style={{ width: mappingsTable.getColumn("confidence")?.getSize() }}>
                                                            {m.confidenceDefault}
                                                        </td>
                                                        <td className="px-3 py-2.5 text-center text-sm font-mono text-slate-600" style={{ width: mappingsTable.getColumn("priority")?.getSize() }}>
                                                            {m.priority}
                                                        </td>
                                                        <td className="px-3 py-2.5 text-center" style={{ width: mappingsTable.getColumn("active")?.getSize() }} onClick={(e) => e.stopPropagation()}>
                                                            <Switch
                                                                checked={m.isActive}
                                                                onCheckedChange={(checked) => handleToggle(m.id, checked)}
                                                            />
                                                        </td>
                                                        <td className="px-3 py-2.5 text-right" style={{ width: mappingsTable.getColumn("actions")?.getSize() }} onClick={(e) => e.stopPropagation()}>
                                                            <div className="flex items-center justify-end gap-1">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7 text-slate-400 hover:text-red-600"
                                                                    onClick={() => handleDelete(m.id)}
                                                                    title="Delete Mapping"
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7"
                                                                    onClick={() => {
                                                                        setEditMapping(m);
                                                                    }}
                                                                >
                                                                    <ChevronRight className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </Card>
                            )}

                            {/* Test All Results */}
                            {testAllResults?.success && (
                                <Card className="border-green-200 dark:border-green-800">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-sm flex items-center gap-2">
                                            <Play className="h-4 w-4 text-green-600" />
                                            Dry-Run Results
                                        </CardTitle>
                                        <CardDescription className="flex items-center gap-3 text-xs">
                                            <span className="flex items-center gap-1 text-green-600">
                                                <CheckCircle2 className="h-3 w-3" /> {testAllResults.summary.resolved} resolved
                                            </span>
                                            {testAllResults.summary.unresolved > 0 && (
                                                <span className="flex items-center gap-1 text-amber-600">
                                                    <AlertTriangle className="h-3 w-3" /> {testAllResults.summary.unresolved} unresolved
                                                </span>
                                            )}
                                            <span className="text-slate-400">→ {testAllResults.summary.candidateCount} candidates</span>
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="pt-0">
                                        <div className="space-y-1.5">
                                            {testAllResults.results.map((r: any) => (
                                                <div
                                                    key={r.mappingId}
                                                    className={cn(
                                                        "flex items-center justify-between p-2 rounded-lg text-xs",
                                                        r.resolved ? "bg-green-50 dark:bg-green-900/20" : "bg-amber-50 dark:bg-amber-900/20"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        {r.resolved ?
                                                            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> :
                                                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                                                        }
                                                        <Badge variant="outline" className="text-[9px] font-mono px-1">F{r.targetFieldNo}</Badge>
                                                        <span className="text-slate-600 dark:text-slate-300">{r.targetFieldName}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {r.resolved && (
                                                            <span className="font-mono text-slate-700 dark:text-slate-200 max-w-[200px] truncate" title={String(r.transformedValue)}>
                                                                &quot;{r.transformedValue}&quot;
                                                            </span>
                                                        )}
                                                        <Badge variant="outline" className="text-[9px]">
                                                            {r.confidence.toFixed(1)}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>

                        {/* Right Column: Inspector & Preview */}
                        <div className="space-y-4">
                            <DataInspectorPanel 
                                sourceType={sourceType} 
                                existingMappings={mappings} 
                                onSelectPath={handleSelectPathFromInspector} 
                                title={sourceType === "GLEIF" ? "GLEIF Data Inspector" : "Super Schema Inspector"}
                            />
                            
                            {/* Preview Panel below inspector when active */}
                            {previewResult && (
                                <Card className="border-indigo-100 dark:border-indigo-900/50 shadow-sm">
                                    <CardHeader className="pb-3 bg-indigo-50/50 dark:bg-indigo-900/10">
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-sm flex items-center gap-2 text-indigo-900 dark:text-indigo-300">
                                                <Eye className="h-4 w-4" />
                                                Mapping Preview
                                            </CardTitle>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 -mr-2" onClick={() => setPreviewResult(null)}>
                                                <span className="text-xs">&times;</span>
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pt-4">
                                        {previewLoading ? (
                                            <div className="flex justify-center py-4">
                                                <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                                            </div>
                                        ) : (
                                            <div className="space-y-3 text-sm">
                                                <div>
                                                    <Label className="text-[10px] text-slate-400 uppercase tracking-wider">Source Path</Label>
                                                    <code className="block mt-0.5 text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-1 rounded font-mono truncate">
                                                        {previewResult.sourcePath}
                                                    </code>
                                                </div>
                                                <div className="flex items-center justify-center -my-1">
                                                    <ArrowRight className="h-3 w-3 text-slate-300" />
                                                </div>
                                                <div>
                                                    <Label className="text-[10px] text-slate-400 uppercase tracking-wider">Target</Label>
                                                    <div className="mt-0.5 flex items-center gap-1.5">
                                                        <Badge variant="outline" className="font-mono text-[10px] px-1 bg-white">F{previewResult.targetFieldNo}</Badge>
                                                        <span className="text-xs text-slate-700 dark:text-slate-300 truncate">{previewResult.targetFieldName}</span>
                                                    </div>
                                                </div>
                                                <Separator className="my-2" />
                                                <div>
                                                    <Label className="text-[10px] text-slate-400 uppercase tracking-wider">Resolved Value</Label>
                                                    <div className={cn(
                                                        "mt-0.5 p-1.5 rounded text-xs font-mono break-all",
                                                        previewResult.resolved ? "bg-green-50 text-green-800 border border-green-100" : "bg-amber-50 text-amber-800 border border-amber-100"
                                                    )}>
                                                        {previewResult.resolved ? JSON.stringify(previewResult.resolvedValue) : "null (not found)"}
                                                    </div>
                                                </div>
                                                {previewResult.resolved && previewResult.transformedValue !== previewResult.resolvedValue && (
                                                    <div>
                                                        <Label className="text-[10px] text-slate-400 uppercase tracking-wider">After Transform</Label>
                                                        <div className="mt-0.5 p-1.5 rounded text-xs font-mono whitespace-pre-wrap break-all bg-indigo-50 text-indigo-800 border border-indigo-100">
                                                            {JSON.stringify(previewResult.transformedValue)}
                                                        </div>
                                                    </div>
                                                )}
                                                {previewResult.warnings.length > 0 && (
                                                    <div className="space-y-1 mt-2">
                                                        {previewResult.warnings.map((w: string, i: number) => (
                                                            <div key={i} className="flex items-start gap-1 text-[10px] text-amber-600 bg-amber-50 p-1.5 rounded">
                                                                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                                                                <span className="leading-snug">{w}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </div>

                    <Separator className="my-8" />

                    {/* Registry Deep Discovery Section */}
                    <div className="space-y-6">
                        <div className="flex flex-col gap-1">
                            <h2 className="text-xl font-semibold flex items-center gap-2">
                                <Zap className="h-5 w-5 text-blue-500" />
                                Registry Deep Discovery
                            </h2>
                            <p className="text-sm text-slate-500 max-w-2xl">
                                Explore how raw jurisdictional registry data is normalized into the Super Schema.
                                This mapping is managed in-code to ensure robustness across regions.
                            </p>
                        </div>
                        
                        <RegistryNormalizationInspector />
                    </div>
                </>
            )}

            {/* Edit Dialog */}
            {editMapping && (
                <MappingFormDialog
                    open={!!editMapping}
                    onOpenChange={(open) => { if (!open) setEditMapping(null); }}
                    sourceType={sourceType}
                    availablePaths={availablePaths}
                    fieldDefs={fieldDefs}
                    existingMapping={editMapping}
                    onSave={() => { loadData(); setEditMapping(null); }}
                />
            )}
        </div>
    );
}

// ── Add/Edit Mapping Dialog ────────────────────────────────────────────

function MappingFormDialog({
    open,
    onOpenChange,
    sourceType,
    availablePaths,
    fieldDefs,
    existingMapping,
    initialSourcePath,
    onSave,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sourceType: string;
    availablePaths: string[];
    fieldDefs: any[];
    existingMapping?: any;
    initialSourcePath?: string;
    onSave: () => void;
}) {
    const isEdit = !!existingMapping;
    const [saving, setSaving] = useState(false);
    const [sourcePath, setSourcePath] = useState("");
    const [targetFieldNo, setTargetFieldNo] = useState("");
    const [transformType, setTransformType] = useState("DIRECT");
    const [confidence, setConfidence] = useState("1.0");
    const [priority, setPriority] = useState("100");
    const [notes, setNotes] = useState("");
    const [filteredPaths, setFilteredPaths] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    // Initialize form states
    useEffect(() => {
        if (open) {
            setSourcePath(existingMapping?.sourcePath || initialSourcePath || "");
            setTargetFieldNo(existingMapping?.targetFieldNo?.toString() || "");
            setTransformType(existingMapping?.transformType || "DIRECT");
            setConfidence(existingMapping?.confidenceDefault?.toString() || "1.0");
            setPriority(existingMapping?.priority?.toString() || "100");
            setNotes(existingMapping?.notes || "");
        }
    }, [open, existingMapping, initialSourcePath]);

    useEffect(() => {
        if (sourcePath && availablePaths.length > 0) {
            const filtered = availablePaths.filter((p: string) =>
                p.toLowerCase().includes(sourcePath.toLowerCase())
            ).slice(0, 8);
            setFilteredPaths(filtered);
        } else {
            setFilteredPaths([]);
        }
    }, [sourcePath, availablePaths]);

    const handleSave = async () => {
        setSaving(true);
        const res = await upsertSourceMapping({
            id: existingMapping?.id,
            sourceType: sourceType as any,
            sourcePath,
            targetFieldNo: parseInt(targetFieldNo),
            confidenceDefault: parseFloat(confidence),
            transformType: transformType as any,
            priority: parseInt(priority),
            notes: notes || undefined,
        });

        if (res.success) {
            if (res.warnings && res.warnings.length > 0) {
                res.warnings.forEach((w: string) => toast.warning(w));
            }
            toast.success(isEdit ? "Mapping updated" : "Mapping created");
            onSave();
            onOpenChange(false);
        } else {
            toast.error(res.error || "Failed to save");
        }
        setSaving(false);
    };

    const triggerButton = !isEdit ? (
        <DialogTrigger asChild>
            <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Mapping
            </Button>
        </DialogTrigger>
    ) : null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {triggerButton}
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{isEdit ? "Edit" : "Add"} Source Mapping</DialogTitle>
                    <DialogDescription>
                        Map a source JSON path to a master field.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2 relative">
                        <Label htmlFor="sourcePath">Source Path</Label>
                        <Input
                            id="sourcePath"
                            value={sourcePath}
                            onChange={(e) => setSourcePath(e.target.value)}
                            onFocus={() => setShowSuggestions(true)}
                            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                            placeholder="e.g. entity.legalName.name"
                            className="font-mono text-sm"
                        />
                        {showSuggestions && filteredPaths.length > 0 && (
                            <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-auto">
                                {filteredPaths.map((p: string) => (
                                    <button
                                        key={p}
                                        className="w-full text-left px-3 py-1.5 text-xs font-mono hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                        onMouseDown={() => {
                                            setSourcePath(p);
                                            setShowSuggestions(false);
                                        }}
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>
                        )}
                        <p className="text-[10px] text-slate-400">
                            Dot-notation relative to payload root. Advisory autocomplete from sample data.
                        </p>
                    </div>
                    <TargetFieldPicker
                        fieldDefs={fieldDefs}
                        value={targetFieldNo}
                        onChange={setTargetFieldNo}
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Transform</Label>
                            <Select value={transformType} onValueChange={setTransformType}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {TRANSFORM_TYPES.map((t: any) => (
                                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="confidence">Confidence (0–1)</Label>
                            <Input
                                id="confidence"
                                type="number"
                                step="0.1"
                                min="0" max="1"
                                value={confidence}
                                onChange={(e) => setConfidence(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="priority">Priority (lower = higher)</Label>
                        <Input
                            id="priority"
                            type="number"
                            min={1}
                            value={priority}
                            onChange={(e) => setPriority(e.target.value)}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="notes">Notes (optional)</Label>
                        <Input
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="e.g. Registered address line 1"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving || !sourcePath || !targetFieldNo}>
                        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        {isEdit ? "Update" : "Create"} Mapping
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/**
 * Bottom section for exploring how a specific registry's raw JSON 
 * maps to our internal Super Schema. Read-only.
 */
function RegistryNormalizationInspector() {
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSearch = async () => {
        if (!query.trim() || query.length < 3) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetchLiveRegistryRecord(query);
            if (res.success) {
                setResult(res.payload);
            } else {
                setError(res.error || "Failed to fetch registry data");
                setResult(null);
            }
        } catch (e) {
            setError("An unexpected error occurred");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="bg-slate-50/30">
            <CardHeader className="pb-3 border-b border-slate-100">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-100 p-2 rounded-lg">
                            <FileJson className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500">Live Normalization Explorer</CardTitle>
                            <CardDescription className="text-xs">Compare raw jurisdictional data with the system Super Schema</CardDescription>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Input 
                            placeholder="Enter Company Number (e.g. 07640868)" 
                            className="h-9 text-xs w-[280px] bg-white"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && handleSearch()}
                        />
                        <Button 
                            size="sm" 
                            className="h-9" 
                            disabled={loading || query.length < 3}
                            onClick={handleSearch}
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                            Fetch & Normalize
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {error && (
                    <div className="p-6 text-center">
                        <div className="bg-amber-50 text-amber-700 p-3 rounded-lg text-sm inline-flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" />
                            {error}
                        </div>
                    </div>
                )}

                {result ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 divide-x divide-slate-100">
                        {/* Raw View */}
                        <div className="flex flex-col h-[600px]">
                            <div className="p-3 bg-slate-100/50 border-b border-slate-100 flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase text-slate-400">Step 1: Raw API Payload</span>
                                <Badge variant="outline" className="text-[9px] bg-white/50">{result.registryKey}</Badge>
                            </div>
                            <div className="flex-1 overflow-auto p-4 bg-white">
                                <DataInspectorPanel 
                                    sourceType="REGISTRATION_AUTHORITY"
                                    existingMappings={[]}
                                    onSelectPath={() => {}}
                                    readOnly={true}
                                    title="Raw Registry Data"
                                />
                            </div>
                        </div>

                        {/* Normalized View */}
                        <div className="flex flex-col h-[600px]">
                            <div className="p-3 bg-green-50/30 border-b border-slate-100 flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase text-green-600">Step 2: Normalized Super Schema</span>
                                <div className="flex items-center gap-1.5 text-[9px] text-green-600 font-medium">
                                    <CheckCircle2 className="h-3 w-3" /> Ready for Mapping
                                </div>
                            </div>
                            <div className="flex-1 overflow-auto p-4 bg-white">
                                <DataInspectorPanel 
                                    sourceType="REGISTRATION_AUTHORITY"
                                    existingMappings={[]}
                                    onSelectPath={() => {}}
                                    readOnly={true}
                                    title="Super Schema Record"
                                />
                            </div>
                        </div>
                    </div>
                ) : !loading && (
                    <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                        <Search className="h-10 w-10 mb-3 opacity-20" />
                        <p className="text-sm">Search a company number above to see the transformation.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// ── Column Header with Info Tooltip ────────────────────────────────────

function ColumnInfo({ label, info, center }: { label: string; info: string; center?: boolean }) {
    const [open, setOpen] = useState(false);

    return (
        <div className={cn("inline-flex items-center gap-1", center && "justify-center w-full")}>
            <span>{label}</span>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                    <button
                        type="button"
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    >
                        <Info className="h-3 w-3" />
                    </button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="text-base">{label}</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{info}</p>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ── Target Field Searchable Picker ─────────────────────────────────────

const DATA_TYPE_COLORS: Record<string, string> = {
    TEXT: "bg-blue-50 text-blue-600 border-blue-100",
    NUMBER: "bg-amber-50 text-amber-600 border-amber-100",
    DATE: "bg-purple-50 text-purple-600 border-purple-100",
    BOOLEAN: "bg-teal-50 text-teal-600 border-teal-100",
    JSON: "bg-orange-50 text-orange-600 border-orange-100",
    SELECT: "bg-indigo-50 text-indigo-600 border-indigo-100",
};

function TargetFieldPicker({
    fieldDefs,
    value,
    onChange,
}: {
    fieldDefs: any[];
    value: string;
    onChange: (value: string) => void;
}) {
    const [open, setOpen] = useState(false);

    const selectedField = fieldDefs.find((f: any) => String(f.fieldNo) === value);

    // Group fields by category
    const grouped = useMemo(() => {
        const groups: Record<string, any[]> = {};
        for (const f of fieldDefs) {
            const cat = f.masterDataCategory?.displayName || "Uncategorized";
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(f);
        }
        // Sort categories alphabetically, but put Uncategorized last
        const sorted = Object.entries(groups).sort(([a], [b]) => {
            if (a === "Uncategorized") return 1;
            if (b === "Uncategorized") return -1;
            return a.localeCompare(b);
        });
        return sorted;
    }, [fieldDefs]);

    return (
        <div className="grid gap-2">
            <Label className="flex items-center gap-2">
                <span>Target Field</span>
                <Badge variant="outline" className="text-[9px] font-normal text-slate-400 border-slate-200 px-1.5">
                    {fieldDefs.length} available
                </Badge>
            </Label>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className={cn(
                            "w-full justify-between h-auto min-h-[40px] py-2 font-normal text-left",
                            !value && "text-slate-400"
                        )}
                    >
                        {selectedField ? (
                            <div className="flex items-center gap-2 overflow-hidden">
                                <Badge variant="outline" className="font-mono text-[10px] px-1.5 shrink-0 bg-slate-50 border-slate-200 text-slate-600">
                                    F{selectedField.fieldNo}
                                </Badge>
                                <span className="truncate text-sm font-medium text-slate-800">
                                    {selectedField.fieldName}
                                </span>
                                <Badge className={cn("text-[9px] px-1 py-0 border shrink-0 shadow-none", DATA_TYPE_COLORS[selectedField.appDataType] || "bg-slate-50 text-slate-500 border-slate-200")}>
                                    {selectedField.appDataType}
                                </Badge>
                            </div>
                        ) : (
                            <span className="text-sm">Search and select a target field…</span>
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[460px] p-0" align="start">
                    <Command>
                        <CommandInput
                            placeholder="Search by name, number, or category…"
                        />
                        <CommandList className="max-h-[320px]">
                            <CommandEmpty>
                                <div className="flex flex-col items-center gap-1 py-6 text-slate-400">
                                    <Search className="h-5 w-5 opacity-40" />
                                    <span className="text-sm">No matching fields</span>
                                    <span className="text-xs">Try a different search term</span>
                                </div>
                            </CommandEmpty>
                            {grouped.map(([category, fields], gIdx) => (
                                <CommandGroup
                                    key={category}
                                    heading={
                                        <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                            {category}
                                            <span className="text-[9px] font-normal text-slate-300">({fields.length})</span>
                                        </span>
                                    }
                                >
                                    {fields.map((f: any) => {
                                        const isSelected = String(f.fieldNo) === value;
                                        return (
                                            <CommandItem
                                                key={f.fieldNo}
                                                value={`${f.fieldNo} ${f.fieldName} ${category}`}
                                                onSelect={() => {
                                                    onChange(String(f.fieldNo));
                                                    setOpen(false);
                                                }}
                                                className={cn(
                                                    "flex items-center gap-2.5 py-2 px-2 cursor-pointer",
                                                    isSelected && "bg-green-50/80 dark:bg-green-900/20"
                                                )}
                                            >
                                                <div className={cn(
                                                    "flex items-center justify-center h-5 w-5 rounded-md border shrink-0 transition-colors",
                                                    isSelected
                                                        ? "bg-green-600 border-green-600 text-white"
                                                        : "border-slate-200 bg-white text-transparent"
                                                )}>
                                                    <Check className="h-3 w-3" />
                                                </div>
                                                <Badge variant="outline" className="font-mono text-[10px] px-1.5 shrink-0 bg-slate-50/80 border-slate-200 text-slate-500 shadow-none">
                                                    F{f.fieldNo}
                                                </Badge>
                                                <span className={cn(
                                                    "flex-1 text-sm truncate",
                                                    isSelected ? "font-semibold text-green-800" : "text-slate-700"
                                                )}>
                                                    {f.fieldName}
                                                </span>
                                                <Badge className={cn(
                                                    "text-[9px] px-1.5 py-0 border shadow-none shrink-0",
                                                    DATA_TYPE_COLORS[f.appDataType] || "bg-slate-50 text-slate-500 border-slate-200"
                                                )}>
                                                    {f.appDataType}
                                                </Badge>
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

