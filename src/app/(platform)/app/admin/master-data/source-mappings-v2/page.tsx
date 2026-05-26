"use client";

import { useState, useEffect } from "react";
import { GitBranch, Loader2, AlertTriangle, CheckCircle2, CircleDot } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { getSourceMappingsV2 } from "@/actions/source-mappings";
import { SOURCE_OPTIONS, type SourceOption } from "@/lib/source-display";
import { DataInspectorPanel } from "@/components/client/admin/source-mappings/data-inspector-panel";

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

/** Visual styling for mappingScope badges */
const SCOPE_STYLES: Record<string, string> = {
    RAW_PAYLOAD: "bg-green-50 text-green-700 border-green-200",
    BASELINE:    "bg-amber-50  text-amber-700  border-amber-200",
};

const SCOPE_LABELS: Record<string, string> = {
    RAW_PAYLOAD: "Raw Payload",
    BASELINE:    "Baseline",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SourceMappingsV2Page() {
    const [selectedValue, setSelectedValue] = useState<string>(SOURCE_OPTIONS[0].value);
    const [mappings, setMappings] = useState<MappingRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const selectedOption: SourceOption =
        SOURCE_OPTIONS.find(o => o.value === selectedValue) ?? SOURCE_OPTIONS[0];

    const loadMappings = async (option: SourceOption) => {
        setLoading(true);
        setError(null);
        const res = await getSourceMappingsV2(option.sourceType, option.sourceReference);
        if (res.success) {
            setMappings(res.mappings as MappingRow[]);
        } else {
            setError(res.error ?? "Failed to load mappings");
            setMappings([]);
        }
        setLoading(false);
    };

    // Load on mount and whenever the source selection changes
    useEffect(() => {
        loadMappings(selectedOption);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedValue]);

    const handleSourceChange = (value: string) => {
        setSelectedValue(value);
    };

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
                        <MappingTable mappings={mappings} />
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
                        onSelectPath={() => {}}
                        readOnly={true}
                        title={selectedOption.label}
                    />
                </div>
            </div>
        </div>
    );
}

// ── MappingTable ───────────────────────────────────────────────────────────────

function MappingTable({ mappings }: { mappings: MappingRow[] }) {
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
                        </tr>
                    </thead>
                    <tbody>
                        {mappings.map(m => (
                            <tr
                                key={m.id}
                                className={cn(
                                    "border-b border-slate-100 dark:border-slate-800 last:border-b-0",
                                    !m.isActive && "opacity-50"
                                )}
                            >
                                {/* Source Path */}
                                <Td>
                                    <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono text-green-700 dark:text-green-400 break-all">
                                        {m.sourcePath}
                                    </code>
                                </Td>

                                {/* Target Field */}
                                <Td>
                                    <div className="flex items-center gap-1.5">
                                        <Badge
                                            variant="outline"
                                            className="text-[10px] font-mono px-1.5 shrink-0"
                                        >
                                            F{m.targetFieldNo}
                                        </Badge>
                                        <span className="text-sm text-slate-700 dark:text-slate-300 truncate max-w-[140px]">
                                            {m.targetField?.fieldName ?? "—"}
                                        </span>
                                    </div>
                                </Td>

                                {/* mappingScope — key new column vs V1 */}
                                <Td center>
                                    <Badge
                                        variant="outline"
                                        className={cn(
                                            "text-[10px]",
                                            SCOPE_STYLES[m.mappingScope] ??
                                                "bg-slate-50 text-slate-500 border-slate-200"
                                        )}
                                    >
                                        {SCOPE_LABELS[m.mappingScope] ?? m.mappingScope}
                                    </Badge>
                                </Td>

                                {/* payloadSubtype — key new column vs V1 */}
                                <Td center>
                                    {m.payloadSubtype ? (
                                        <Badge
                                            variant="outline"
                                            className="text-[10px] bg-blue-50 text-blue-700 border-blue-200"
                                        >
                                            {m.payloadSubtype}
                                        </Badge>
                                    ) : (
                                        <span className="text-slate-300 text-xs">—</span>
                                    )}
                                </Td>

                                {/* Transform */}
                                <Td center>
                                    <Badge variant="secondary" className="text-[10px]">
                                        {m.transformType}
                                    </Badge>
                                </Td>

                                {/* Priority */}
                                <Td center>
                                    <span className="font-mono text-xs text-slate-600 dark:text-slate-400">
                                        {m.priority}
                                    </span>
                                </Td>

                                {/* Active indicator — read-only dot, no Switch */}
                                <Td center>
                                    <span
                                        className={cn(
                                            "inline-block h-2 w-2 rounded-full",
                                            m.isActive
                                                ? "bg-green-500"
                                                : "bg-slate-300 dark:bg-slate-600"
                                        )}
                                        title={m.isActive ? "Active" : "Inactive"}
                                    />
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
    children: React.ReactNode;
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

function Td({
    children,
    center,
}: {
    children: React.ReactNode;
    center?: boolean;
}) {
    return (
        <td
            className={cn(
                "px-3 py-2.5",
                center && "text-center"
            )}
        >
            {children}
        </td>
    );
}
