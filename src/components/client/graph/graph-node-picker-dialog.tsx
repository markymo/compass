"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { getGraphNodesForPicker, GraphNodePickerItem } from "@/actions/graph-node-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, X, Users, Building2, MapPin, Star, Plus, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

// ── Types ──────────────────────────────────────────────────────────────────

export interface GraphNodePickerDialogSelection {
    nodeId: string;
    nodeType: "PERSON" | "LEGAL_ENTITY" | "ADDRESS";
    personId: string | null;
    legalEntityId: string | null;
    addressId: string | null;
    displayLabel: string;
}

interface GraphNodePickerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    clientLEId: string;
    graphNodeType: "PERSON" | "LEGAL_ENTITY" | "ADDRESS";
    filterEdgeType?: string | null;
    filterActiveOnly?: boolean;
    allowCreate?: boolean;
    pickerLabel?: string | null;

    selectedNodeIds?: string[];

    onSelect: (item: GraphNodePickerDialogSelection) => void;
    onDeselect?: (nodeId: string) => void;

    isMultiValue?: boolean;
    disabled?: boolean;

    onCreateNew?: () => void;
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
                "w-full flex items-center gap-3 px-3 py-3 text-left transition-colors rounded-md text-sm group border border-transparent",
                isSelected
                    ? "bg-indigo-50 border-indigo-200 dark:bg-indigo-950/30 dark:border-indigo-800"
                    : "hover:bg-slate-50 hover:border-slate-200 dark:hover:bg-slate-800/50"
            )}
        >
            {/* Selection indicator */}
            <div className={cn(
                "flex-none w-4 h-4 rounded border flex items-center justify-center transition-colors",
                isMultiValue ? "rounded" : "rounded-full",
                isSelected
                    ? "bg-indigo-600 border-indigo-600"
                    : "border-slate-300 dark:border-slate-600 group-hover:border-slate-400"
            )}>
                {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
            </div>

            {/* Node type icon */}
            <div className={cn("flex-none p-1.5 rounded", typeConfig.color)}>
                <TypeIcon className="h-4 w-4" />
            </div>

            {/* Labels */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0 mb-0.5">
                    <span className="font-medium text-slate-900 dark:text-slate-100 truncate text-base">
                        {item.displayLabel}
                    </span>
                    {item.isPromoted && (
                        <Star className="h-3.5 w-3.5 text-amber-500 flex-none" fill="currentColor" />
                    )}
                </div>
                {item.subLabel && (
                    <p className="text-xs text-slate-500 truncate">{item.subLabel}</p>
                )}
            </div>

            {/* Badges: source + active edge roles */}
            <div className="flex-none flex flex-col items-end gap-1.5">
                <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", sourceInfo.color)}>
                    {sourceInfo.label}
                </span>
                <div className="flex gap-1">
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
            </div>
        </button>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────

export function GraphNodePickerDialog({
    open,
    onOpenChange,
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
}: GraphNodePickerDialogProps) {
    const [items, setItems] = useState<GraphNodePickerItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    const typeConfig = NODE_TYPE_CONFIG[graphNodeType];
    const label = pickerLabel || `Select a ${typeConfig.label}`;

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
                setTimeout(() => inputRef.current?.focus(), 50);
            });
    }, [open, clientLEId, graphNodeType, filterEdgeType, filterActiveOnly]);

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

        if (!isMultiValue) onOpenChange(false);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden bg-slate-50/50">
                <DialogHeader className="px-6 pt-6 pb-4 bg-white border-b border-slate-100">
                    <DialogTitle className="text-xl">Add {typeConfig.label}</DialogTitle>
                    <DialogDescription>
                        Search the Knowledge Graph for an existing {typeConfig.label.toLowerCase()} or create a new one.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col">
                    <div className="px-6 py-4 bg-white">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                            <Input
                                ref={inputRef}
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder={`Search by name, nationality, or role...`}
                                className="pl-10 h-12 text-base bg-slate-50 border-slate-200 focus-visible:ring-indigo-500"
                            />
                            {query && (
                                <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    <ScrollArea className="max-h-[400px] bg-slate-50/50 px-4 pb-4">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
                                <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                                <span className="text-sm font-medium">Querying Knowledge Graph...</span>
                            </div>
                        ) : error ? (
                            <div className="py-8 text-center text-sm text-red-500 px-4">{error}</div>
                        ) : filtered.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                                <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                                    <Search className="h-6 w-6 text-slate-400" />
                                </div>
                                <h3 className="text-lg font-medium text-slate-900 mb-1">No matches found</h3>
                                <p className="text-sm text-slate-500 mb-6">
                                    {query ? `No ${typeConfig.label.toLowerCase()}s match "${query}".` : `No ${typeConfig.label.toLowerCase()}s in this graph.`}
                                </p>
                                {allowCreate && (
                                    <Button
                                        onClick={() => {
                                            onOpenChange(false);
                                            onCreateNew?.();
                                        }}
                                        className="bg-indigo-600 hover:bg-indigo-700 shadow-sm"
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Create New {typeConfig.label}
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-4 pt-2">
                                {promoted.length > 0 && (
                                    <div>
                                        <p className="px-2 pb-2 text-[11px] font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1.5">
                                            <Star className="h-3.5 w-3.5" fill="currentColor" />
                                            Suggested matches
                                        </p>
                                        <div className="space-y-1.5 bg-white p-2 rounded-xl shadow-sm border border-amber-100">
                                            {promoted.map(item => (
                                                <NodeRow
                                                    key={item.nodeId}
                                                    item={item}
                                                    isSelected={selectedNodeIds.includes(item.nodeId)}
                                                    isMultiValue={isMultiValue}
                                                    onSelect={handleSelect}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {others.length > 0 && (
                                    <div>
                                        {promoted.length > 0 && (
                                            <p className="px-2 pb-2 pt-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                                All other {typeConfig.label}s
                                            </p>
                                        )}
                                        <div className="space-y-1.5 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
                                            {others.map(item => (
                                                <NodeRow
                                                    key={item.nodeId}
                                                    item={item}
                                                    isSelected={selectedNodeIds.includes(item.nodeId)}
                                                    isMultiValue={isMultiValue}
                                                    onSelect={handleSelect}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </ScrollArea>

                    <div className="px-6 py-4 bg-white border-t border-slate-100 flex items-center justify-between">
                        <p className="text-xs font-medium text-slate-500">
                            {items.length} total node{items.length !== 1 ? 's' : ''} in graph
                        </p>
                        {allowCreate && filtered.length > 0 && (
                            <Button
                                variant="outline"
                                onClick={() => {
                                    onOpenChange(false);
                                    onCreateNew?.();
                                }}
                                className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Create New {typeConfig.label}
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
