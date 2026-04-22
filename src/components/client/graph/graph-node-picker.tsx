"use client";

import { useState, useEffect, useMemo, useTransition, useRef } from "react";
import { getGraphNodesForPicker, GraphNodePickerItem } from "@/actions/graph-node-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, X, Users, Building2, MapPin, Star, ChevronDown, Plus, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

// ── Types ──────────────────────────────────────────────────────────────────

export interface GraphNodePickerSelection {
    nodeId: string;
    nodeType: "PERSON" | "LEGAL_ENTITY" | "ADDRESS";
    personId: string | null;
    legalEntityId: string | null;
    addressId: string | null;
    displayLabel: string;
}

interface GraphNodePickerProps {
    clientLEId: string;
    graphNodeType: "PERSON" | "LEGAL_ENTITY" | "ADDRESS";
    filterEdgeType?: string | null;
    filterActiveOnly?: boolean;
    allowCreate?: boolean;
    pickerLabel?: string | null;

    /** Currently selected node IDs (for multi-value fields) */
    selectedNodeIds?: string[];

    /** Called when the user selects or deselects a node */
    onSelect: (item: GraphNodePickerSelection) => void;
    onDeselect?: (nodeId: string) => void;

    /** If true, allow multiple selections */
    isMultiValue?: boolean;

    /** Whether the picker is disabled */
    disabled?: boolean;

    /** Called when user clicks "Create new" (if allowCreate is true) */
    onCreateNew?: () => void;

    className?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const NODE_TYPE_CONFIG = {
    PERSON:       { icon: Users,     label: "Person",       color: "text-cyan-700 bg-cyan-50 border-cyan-200" },
    LEGAL_ENTITY: { icon: Building2, label: "Company",      color: "text-fuchsia-700 bg-fuchsia-50 border-fuchsia-200" },
    ADDRESS:      { icon: MapPin,    label: "Address",      color: "text-orange-700 bg-orange-50 border-orange-200" },
};

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
    REGISTRATION_AUTHORITY: { label: "Registry",   color: "text-emerald-700 bg-emerald-50" },
    GLEIF:                  { label: "GLEIF",       color: "text-blue-700 bg-blue-50" },
    USER_INPUT:             { label: "User Input",  color: "text-amber-700 bg-amber-50" },
    SYSTEM_DERIVED:         { label: "System",      color: "text-slate-600 bg-slate-50" },
};

function NodeRow({
    item,
    isSelected,
    isMultiValue,
    onSelect,
}: {
    item: GraphNodePickerItem;
    isSelected: boolean;
    isMultiValue: boolean;
    onSelect: (item: GraphNodePickerItem) => void;
}) {
    const typeConfig = NODE_TYPE_CONFIG[item.nodeType];
    const TypeIcon = typeConfig.icon;
    const sourceInfo = SOURCE_LABELS[item.source] ?? { label: item.source, color: "text-slate-500 bg-slate-50" };

    return (
        <button
            type="button"
            onClick={() => onSelect(item)}
            className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors rounded-md text-sm group",
                isSelected
                    ? "bg-indigo-50 dark:bg-indigo-950/30"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
            )}
        >
            {/* Selection indicator */}
            <div className={cn(
                "flex-none w-4 h-4 rounded border flex items-center justify-center transition-colors",
                isMultiValue ? "rounded" : "rounded-full",
                isSelected
                    ? "bg-indigo-600 border-indigo-600"
                    : "border-slate-300 dark:border-slate-600"
            )}>
                {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
            </div>

            {/* Node type icon */}
            <div className={cn("flex-none p-1 rounded", typeConfig.color)}>
                <TypeIcon className="h-3 w-3" />
            </div>

            {/* Labels */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-slate-900 dark:text-slate-100 truncate">
                        {item.displayLabel}
                    </span>
                    {item.isPromoted && (
                        <Star className="h-3 w-3 text-amber-500 flex-none" />
                    )}
                </div>
                {item.subLabel && (
                    <p className="text-[10px] text-slate-400 truncate">{item.subLabel}</p>
                )}
            </div>

            {/* Badges: source + active edge roles */}
            <div className="flex-none flex items-center gap-1.5">
                <span className={cn("text-[10px] px-1.5 py-0 rounded font-medium", sourceInfo.color)}>
                    {sourceInfo.label}
                </span>
                {item.activeEdgeTypes.slice(0, 2).map(et => (
                    <Badge
                        key={et}
                        variant="outline"
                        className="text-[9px] h-4 px-1 py-0 bg-slate-50 text-slate-500 hidden sm:flex"
                    >
                        {et.replace(/_/g, " ")}
                    </Badge>
                ))}
            </div>
        </button>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────

export function GraphNodePicker({
    clientLEId,
    graphNodeType,
    filterEdgeType,
    filterActiveOnly = true,
    allowCreate = true,
    pickerLabel,
    selectedNodeIds = [],
    onSelect,
    onDeselect,
    isMultiValue = false,
    disabled = false,
    onCreateNew,
    className,
}: GraphNodePickerProps) {
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<GraphNodePickerItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    const typeConfig = NODE_TYPE_CONFIG[graphNodeType];
    const label = pickerLabel || `Select a ${typeConfig.label}`;

    // ── Load nodes when popover opens ─────────────────────────────────────
    useEffect(() => {
        if (!open) return;
        setLoading(true);
        setError(null);
        getGraphNodesForPicker({ clientLEId, graphNodeType, filterEdgeType, filterActiveOnly })
            .then(res => {
                if (res.success) setItems(res.items);
                else setError(res.error);
            })
            .finally(() => {
                setLoading(false);
                // Focus search after load
                setTimeout(() => inputRef.current?.focus(), 50);
            });
    }, [open, clientLEId, graphNodeType, filterEdgeType, filterActiveOnly]);

    // ── Filtered items ────────────────────────────────────────────────────
    const filtered = useMemo(() => {
        if (!query.trim()) return items;
        const q = query.toLowerCase();
        return items.filter(item =>
            item.displayLabel.toLowerCase().includes(q) ||
            (item.subLabel?.toLowerCase().includes(q) ?? false) ||
            item.activeEdgeTypes.some(et => et.toLowerCase().includes(q))
        );
    }, [items, query]);

    const promoted = filtered.filter(i => i.isPromoted);
    const others   = filtered.filter(i => !i.isPromoted);

    // ── Current selection labels (for trigger display) ────────────────────
    const selectedItems = items.filter(i => selectedNodeIds.includes(i.nodeId));

    function handleSelect(item: GraphNodePickerItem) {
        const isSelected = selectedNodeIds.includes(item.nodeId);

        if (isSelected) {
            onDeselect?.(item.nodeId);
        } else {
            onSelect({
                nodeId: item.nodeId,
                nodeType: item.nodeType,
                personId: item.personId,
                legalEntityId: item.legalEntityId,
                addressId: item.addressId,
                displayLabel: item.displayLabel,
            });
        }

        // For single-value, close after selection
        if (!isMultiValue) setOpen(false);
    }

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    disabled={disabled}
                    className={cn(
                        "w-full flex items-center justify-between gap-2 rounded-md border px-3 py-2",
                        "bg-white dark:bg-slate-950 text-left text-sm transition-colors",
                        "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700",
                        "focus:outline-none focus:ring-2 focus:ring-indigo-500/30",
                        disabled && "opacity-50 cursor-not-allowed",
                        className
                    )}
                >
                    <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
                        {selectedItems.length === 0 ? (
                            <span className="text-slate-400 text-sm">{label}</span>
                        ) : (
                            selectedItems.map(item => (
                                <span
                                    key={item.nodeId}
                                    className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md px-2 py-0.5 text-xs font-medium"
                                >
                                    {item.displayLabel}
                                    {onDeselect && (
                                        <button
                                            type="button"
                                            onClick={e => {
                                                e.stopPropagation();
                                                onDeselect(item.nodeId);
                                            }}
                                            className="hover:text-red-500 ml-0.5"
                                        >
                                            <X className="h-2.5 w-2.5" />
                                        </button>
                                    )}
                                </span>
                            ))
                        )}
                    </div>
                    <ChevronDown className="h-4 w-4 text-slate-400 flex-none" />
                </button>
            </PopoverTrigger>

            <PopoverContent
                className="w-[480px] p-0 shadow-lg border border-slate-200 dark:border-slate-800"
                align="start"
                sideOffset={4}
            >
                {/* Search header */}
                <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                    <Search className="h-4 w-4 text-slate-400 flex-none" />
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder={`Search ${typeConfig.label.toLowerCase()}s…`}
                        className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                    {query && (
                        <button onClick={() => setQuery("")} className="text-slate-400 hover:text-slate-600">
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>

                {/* Results */}
                <ScrollArea className="max-h-72">
                    {loading ? (
                        <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
                            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                        </div>
                    ) : error ? (
                        <div className="py-8 text-center text-xs text-red-500 px-4">{error}</div>
                    ) : filtered.length === 0 ? (
                        <div className="py-8 text-center text-sm text-slate-400">
                            {query ? `No results for "${query}"` : `No ${typeConfig.label.toLowerCase()}s in this graph`}
                        </div>
                    ) : (
                        <div className="p-1.5 space-y-1">
                            {/* Promoted section */}
                            {promoted.length > 0 && (
                                <>
                                    <p className="px-2 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-600 flex items-center gap-1">
                                        <Star className="h-3 w-3" />
                                        {filterEdgeType?.replace(/_/g, " ")} ({promoted.length})
                                    </p>
                                    {promoted.map(item => (
                                        <NodeRow
                                            key={item.nodeId}
                                            item={item}
                                            isSelected={selectedNodeIds.includes(item.nodeId)}
                                            isMultiValue={isMultiValue}
                                            onSelect={handleSelect}
                                        />
                                    ))}
                                    {others.length > 0 && (
                                        <div className="border-t border-slate-100 dark:border-slate-800 my-1" />
                                    )}
                                </>
                            )}

                            {/* Other nodes */}
                            {others.length > 0 && (
                                <>
                                    {promoted.length > 0 && (
                                        <p className="px-2 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                            Other {typeConfig.label}s ({others.length})
                                        </p>
                                    )}
                                    {others.map(item => (
                                        <NodeRow
                                            key={item.nodeId}
                                            item={item}
                                            isSelected={selectedNodeIds.includes(item.nodeId)}
                                            isMultiValue={isMultiValue}
                                            onSelect={handleSelect}
                                        />
                                    ))}
                                </>
                            )}
                        </div>
                    )}
                </ScrollArea>

                {/* Footer: Create new + count */}
                <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                    <p className="text-[10px] text-slate-400">
                        {items.length} {typeConfig.label.toLowerCase()}{items.length !== 1 ? "s" : ""} in graph
                    </p>
                    {allowCreate && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-2"
                            onClick={() => {
                                setOpen(false);
                                onCreateNew?.();
                            }}
                        >
                            <Plus className="h-3 w-3 mr-1" />
                            Create new {typeConfig.label.toLowerCase()}
                        </Button>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
