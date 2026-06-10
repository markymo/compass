"use client";

/**
 * GroupAnswerRenderer
 *
 * Presentation-only component. Renders a questionnaire answer that is mapped
 * to a MasterFieldGroup as a vertical list of populated field rows.
 *
 * Rules:
 *  - Empty / unsynced fields are hidden (isSynced: false).
 *  - Source + Updated date shown per field row.
 *  - No DB calls. No client-side SIC lookup.
 *  - RA display names resolved from the pre-fetched raNameLookup prop.
 */

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Database } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveSourceLabel, RaNameLookup } from "@/lib/kyc/source-label";
import type { HydratedValue } from "@/actions/kyc-query";

// ── Public API ────────────────────────────────────────────────────────────────

export interface GroupFieldData {
    fieldNo: number;
    /** Display label from MasterFieldDefinition.fieldName */
    fieldName: string;
    /** Prisma appDataType: 'TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'JSONB', etc. */
    appDataType: string;
    /** True for collection fields (SIC codes, directors, etc.) */
    isMultiValue: boolean;
    /**
     * If set, the field is a controlled-vocabulary code list.
     * Each item in value[] may be a string (old format) or { code, label } (new format).
     * e.g. 'SIC_2007_UK'
     */
    codeSystem?: string;
    /** Resolved value + provenance from resolveMasterData / resolveMasterDataBatch */
    hydrated: HydratedValue;
}

export interface GroupAnswerRendererProps {
    /** Display label for the group, e.g. 'Nature of Business' */
    groupLabel: string;
    /** Per-field data in MasterFieldGroupItem.order */
    fields: GroupFieldData[];
    /**
     * Pre-fetched RA name map: { 'RA000585': 'Companies House', ... }
     * Serialisable Record<string,string> — safe across server/client boundary.
     */
    raNameLookup: RaNameLookup;
    /** Optional extra class on the outer wrapper */
    className?: string;
}

// ── Helpers (exported for unit testing) ──────────────────────────────────────

/** Format a date value for display. Accepts Date, ISO string, or timestamp. */
export function formatFieldDate(raw: Date | string | number | null | undefined): string {
    if (!raw) return "—";
    try {
        const d = raw instanceof Date ? raw : new Date(raw);
        if (isNaN(d.getTime())) return String(raw);
        return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
    } catch {
        return String(raw);
    }
}

/** Format a single SIC code item (string or { code, label } object). */
export function formatSicItem(item: unknown): string {
    if (typeof item === "string") return item;
    if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        if (typeof obj.code === "string") {
            const label = typeof obj.label === "string" && obj.label ? obj.label : null;
            return label ? `${obj.code}  ${label}` : obj.code;
        }
    }
    // Fallback: safe stringify
    try { return JSON.stringify(item); } catch { return String(item); }
}

/**
 * Render a scalar field value to a display string.
 * Returns null if the value is genuinely empty (null/undefined/"").
 */
export function formatScalarValue(value: unknown, appDataType: string): string | null {
    if (value === null || value === undefined) return null;

    switch (appDataType) {
        case "BOOLEAN":
            return value ? "Yes" : "No";
        case "NUMBER":
            return typeof value === "number"
                ? value.toLocaleString()
                : String(value);
        case "DATE":
            return formatFieldDate(value as any);
        default:
            // TEXT, ENUM, and unknown types
            const str = String(value);
            return str === "" ? null : str;
    }
}

// ── Sub-components ────────────────────────────────────────────────────────────

// Source badge colours mirror knowledge-graph-table.tsx
const SOURCE_COLORS: Record<string, string> = {
    "User Input":    "bg-indigo-50 text-indigo-700 border-indigo-200",
    "GLEIF":         "bg-violet-50 text-violet-700 border-violet-200",
    "Master Record": "bg-slate-100 text-slate-500 border-slate-200",
};

function SourceBadge({ label }: { label: string }) {
    const color = SOURCE_COLORS[label] ?? "bg-emerald-50 text-emerald-700 border-emerald-200";
    return (
        <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border", color)}>
            {label}
        </span>
    );
}

/** Per-field provenance line: source badge + date */
function ProvenanceLine({
    source,
    sourceReference,
    updatedAt,
    raNameLookup,
}: {
    source: string | null;
    sourceReference?: string | null;
    updatedAt?: Date | null;
    raNameLookup: RaNameLookup;
}) {
    const label = resolveSourceLabel(source, sourceReference, raNameLookup);
    const dateStr = updatedAt ? formatFieldDate(updatedAt) : null;

    return (
        <div className="flex items-center gap-1.5 mt-1">
            <SourceBadge label={label} />
            {dateStr && (
                <span className="text-[10px] text-slate-400">{dateStr}</span>
            )}
        </div>
    );
}

/** Renders a single scalar field value */
function ScalarFieldValue({ value, appDataType }: { value: unknown; appDataType: string }) {
    // JSONB / unsupported — safe fallback
    if (appDataType === "JSONB" || (typeof value === "object" && value !== null && !Array.isArray(value))) {
        try {
            return (
                <code className="text-xs text-slate-500 break-all bg-slate-50 rounded px-1 py-0.5">
                    {JSON.stringify(value)}
                </code>
            );
        } catch {
            return <span className="text-xs text-slate-400 italic">Unable to display</span>;
        }
    }

    const display = formatScalarValue(value, appDataType);
    if (!display) return <span className="text-xs text-slate-400 italic">—</span>;

    return <span className="text-sm text-slate-900">{display}</span>;
}

/**
 * Renders a code-list collection (e.g. SIC codes).
 * Shows first 3 inline; collapses the rest behind a toggle for 5+.
 */
function CodeListValue({ items }: { items: unknown[] }) {
    const ALWAYS_SHOW = 3;
    const COLLAPSE_THRESHOLD = 5; // only collapse if > 4 items
    const [expanded, setExpanded] = useState(false);

    const needsCollapse = items.length >= COLLAPSE_THRESHOLD;
    const visible = needsCollapse && !expanded ? items.slice(0, ALWAYS_SHOW) : items;
    const hiddenCount = items.length - ALWAYS_SHOW;

    return (
        <div className="space-y-1">
            {visible.map((item, idx) => (
                <div key={idx} className="flex items-baseline gap-1.5">
                    <span className="text-slate-300 text-xs shrink-0">●</span>
                    <span className="text-sm text-slate-900 font-mono leading-snug">
                        {formatSicItem(item)}
                    </span>
                </div>
            ))}
            {needsCollapse && (
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1 text-xs text-slate-500 hover:text-slate-700 -ml-1"
                    onClick={() => setExpanded(v => !v)}
                >
                    {expanded ? (
                        <><ChevronUp className="h-3 w-3 mr-1" />Show less</>
                    ) : (
                        <><ChevronDown className="h-3 w-3 mr-1" />+ {hiddenCount} more</>
                    )}
                </Button>
            )}
        </div>
    );
}

/** Renders an arbitrary array of non-code-list values (fallback) */
function ArrayValue({ items }: { items: unknown[] }) {
    return (
        <div className="flex flex-wrap gap-1 mt-0.5">
            {items.map((item, idx) => (
                <Badge
                    key={idx}
                    variant="outline"
                    className="text-xs bg-white border-slate-200 text-slate-700 font-normal py-0.5"
                >
                    {typeof item === "object" ? JSON.stringify(item) : String(item ?? "")}
                </Badge>
            ))}
        </div>
    );
}

/** A single group field row */
function GroupFieldRow({
    field,
    raNameLookup,
}: {
    field: GroupFieldData;
    raNameLookup: RaNameLookup;
}) {
    const { fieldName, appDataType, isMultiValue, codeSystem, hydrated } = field;
    const { value, source, sourceReference, updatedAt } = hydrated;

    const renderValue = () => {
        if (isMultiValue && Array.isArray(value)) {
            if (codeSystem) {
                return <CodeListValue items={value} />;
            }
            return <ArrayValue items={value} />;
        }
        return <ScalarFieldValue value={value} appDataType={appDataType} />;
    };

    return (
        <div className="py-3 border-b border-slate-50 last:border-0">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                {fieldName}
            </p>
            <div className="text-sm text-slate-900">
                {renderValue()}
            </div>
            <ProvenanceLine
                source={source}
                sourceReference={sourceReference}
                updatedAt={updatedAt}
                raNameLookup={raNameLookup}
            />
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export function GroupAnswerRenderer({
    groupLabel,
    fields,
    raNameLookup,
    className,
}: GroupAnswerRendererProps) {
    // Filter: only show fields that have data
    const populated = fields.filter(f => f.hydrated.isSynced);

    if (populated.length === 0) {
        return (
            <div className={cn("flex items-center gap-2 text-xs text-slate-400 italic py-2", className)}>
                <Database className="h-3 w-3 shrink-0" />
                No master data recorded for this group.
            </div>
        );
    }

    return (
        <div className={cn("space-y-0", className)}>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Database className="h-3 w-3" />
                {groupLabel}
            </div>
            <div className="rounded-lg border border-slate-100 bg-white overflow-hidden divide-y divide-slate-50 px-3">
                {populated.map(field => (
                    <GroupFieldRow
                        key={field.fieldNo}
                        field={field}
                        raNameLookup={raNameLookup}
                    />
                ))}
            </div>
        </div>
    );
}
