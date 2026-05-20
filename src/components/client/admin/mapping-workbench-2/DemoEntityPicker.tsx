"use client";

import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pencil, Search, Loader2, Check, RotateCcw, Building2, Globe } from "lucide-react";
import { usePreferences } from "@/components/providers/user-preferences-provider";
import {
    searchGleifEntities,
    searchCHEntities,
    searchFREntities,
} from "@/actions/workbench-demo-entities";
import type { WbEntitySearchResult } from "@/lib/mapping-workbench/demo-entity-defaults";
import { cn } from "@/lib/utils";

type SourceKey = "GLEIF" | "CH_RA000585" | "FR_RA000192";

const SOURCE_CONFIG: Record<SourceKey, {
    label: string;
    prefKey: "gleif" | "ch" | "fr";
    idLabel: string;
    placeholder: string;
    accentBg: string;
    accentBorder: string;
    accentText: string;
    icon: React.ReactNode;
}> = {
    GLEIF: {
        label:    "GLEIF Demo Entity",
        prefKey:  "gleif",
        idLabel:  "LEI",
        placeholder: "Search by LEI or company name…",
        accentBg:     "bg-purple-50",
        accentBorder: "border-purple-200",
        accentText:   "text-purple-700",
        icon: <Globe className="w-4 h-4" />,
    },
    CH_RA000585: {
        label:    "Companies House Demo Entity",
        prefKey:  "ch",
        idLabel:  "Company No.",
        placeholder: "Search by company number or name…",
        accentBg:     "bg-red-50",
        accentBorder: "border-red-200",
        accentText:   "text-red-700",
        icon: <Building2 className="w-4 h-4" />,
    },
    FR_RA000192: {
        label:    "French Registry Demo Entity",
        prefKey:  "fr",
        idLabel:  "SIREN",
        placeholder: "Search by SIREN or company name…",
        accentBg:     "bg-blue-50",
        accentBorder: "border-blue-200",
        accentText:   "text-blue-700",
        icon: <Building2 className="w-4 h-4" />,
    },
};

interface DemoEntityPickerProps {
    sourceKey: SourceKey;
    currentName: string | null;
    currentId:   string;
}

export function DemoEntityPicker({ sourceKey, currentName, currentId }: DemoEntityPickerProps) {
    const [open, setOpen] = useState(false);
    const cfg = SOURCE_CONFIG[sourceKey];

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-current hover:text-slate-700 rounded p-0.5"
                title={`Change ${cfg.label}`}
            >
                <Pencil className="w-2.5 h-2.5" />
            </button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-md p-0 overflow-hidden">
                    <DialogHeader className={cn("px-5 py-4 border-b", cfg.accentBg, cfg.accentBorder)}>
                        <div className="flex items-center gap-2">
                            <span className={cfg.accentText}>{cfg.icon}</span>
                            <DialogTitle className="text-sm font-semibold text-slate-800">
                                {cfg.label}
                            </DialogTitle>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                            Currently: <span className="font-medium text-slate-700">{currentName ?? currentId}</span>
                        </p>
                    </DialogHeader>

                    <PickerBody
                        sourceKey={sourceKey}
                        cfg={cfg}
                        onClose={() => setOpen(false)}
                    />
                </DialogContent>
            </Dialog>
        </>
    );
}

function PickerBody({ sourceKey, cfg, onClose }: {
    sourceKey: SourceKey;
    cfg: typeof SOURCE_CONFIG[SourceKey];
    onClose: () => void;
}) {
    const { preferences, updatePreference } = usePreferences();
    const [query,     setQuery]     = useState("");
    const [results,   setResults]   = useState<WbEntitySearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [selected,  setSelected]  = useState<WbEntitySearchResult | null>(null);
    const [error,     setError]     = useState<string | null>(null);
    const [saving,    setSaving]    = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Debounced search-as-you-type
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (query.trim().length < 2) {
            setResults([]);
            setError(null);
            return;
        }
        debounceRef.current = setTimeout(async () => {
            setSearching(true);
            setError(null);
            setSelected(null);
            try {
                let res: { success: boolean; results?: WbEntitySearchResult[]; error?: string };
                if (sourceKey === "GLEIF")       res = await searchGleifEntities(query);
                else if (sourceKey === "CH_RA000585") res = await searchCHEntities(query);
                else                              res = await searchFREntities(query);

                if (res.success) setResults(res.results ?? []);
                else { setError(res.error ?? "Search failed"); setResults([]); }
            } catch (e: any) {
                setError(String(e));
                setResults([]);
            } finally {
                setSearching(false);
            }
        }, 300);
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [query, sourceKey]);

    const handleConfirm = async () => {
        if (!selected) return;
        setSaving(true);
        const currentDemoEntities = preferences.mappingWorkbench?.demoEntities ?? {};
        await updatePreference("mappingWorkbench", {
            demoEntities: {
                ...currentDemoEntities,
                [cfg.prefKey]: { id: selected.id, name: selected.name },
            },
        });
        setSaving(false);
        onClose();
    };

    const handleReset = async () => {
        setSaving(true);
        const currentDemoEntities = preferences.mappingWorkbench?.demoEntities ?? {};
        const { [cfg.prefKey]: _removed, ...rest } = currentDemoEntities as any;
        await updatePreference("mappingWorkbench", { demoEntities: rest });
        setSaving(false);
        onClose();
    };

    return (
        <div className="flex flex-col">
            {/* Search input */}
            <div className="px-4 py-3 border-b border-slate-100">
                <div className="relative">
                    {searching
                        ? <Loader2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 animate-spin" />
                        : <Search  className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    }
                    <Input
                        autoFocus
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder={cfg.placeholder}
                        className="pl-8 h-9 text-xs border-slate-200"
                    />
                </div>
                {error && (
                    <p className="text-[11px] text-red-600 mt-1.5">{error}</p>
                )}
            </div>

            {/* Results list */}
            <div className="max-h-64 overflow-y-auto">
                {results.length === 0 && !searching && query.trim().length >= 2 && (
                    <p className="text-[11px] text-slate-400 text-center py-6">No results found</p>
                )}
                {query.trim().length < 2 && (
                    <p className="text-[11px] text-slate-400 text-center py-6">
                        Type at least 2 characters to search
                    </p>
                )}
                {results.map(r => (
                    <button
                        key={r.id}
                        onClick={() => setSelected(r)}
                        className={cn(
                            "w-full text-left px-4 py-2.5 flex items-start gap-3 transition-colors border-b border-slate-50 hover:bg-slate-50",
                            selected?.id === r.id && cn(cfg.accentBg, "border-l-2", cfg.accentBorder.replace("border", "border-l"))
                        )}
                    >
                        <div className="w-4 h-4 mt-0.5 shrink-0 flex items-center justify-center">
                            {selected?.id === r.id
                                ? <Check className={cn("w-3.5 h-3.5", cfg.accentText)} />
                                : <div className="w-3 h-3 rounded-full border border-slate-300" />
                            }
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-medium text-slate-800 truncate">{r.name}</p>
                            <div className="flex gap-2 mt-0.5">
                                <span className="text-[10px] font-mono text-slate-500">{cfg.idLabel}: {r.id}</span>
                                {r.status && (
                                    <span className={cn(
                                        "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded",
                                        r.status.toUpperCase() === "ACTIVE" || r.status.toUpperCase() === "ISSUED"
                                            ? "bg-emerald-50 text-emerald-700"
                                            : "bg-slate-100 text-slate-500"
                                    )}>
                                        {r.status}
                                    </span>
                                )}
                                {r.extra && (
                                    <span className="text-[10px] text-slate-400">{r.extra}</span>
                                )}
                            </div>
                        </div>
                    </button>
                ))}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-slate-100 bg-slate-50/50">
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-[11px] text-slate-400 hover:text-slate-600 gap-1.5"
                    onClick={handleReset}
                    disabled={saving}
                >
                    <RotateCcw className="w-3 h-3" />
                    Reset to default
                </Button>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-8"
                        onClick={onClose}
                        disabled={saving}
                    >
                        Cancel
                    </Button>
                    <Button
                        size="sm"
                        className="text-xs h-8"
                        onClick={handleConfirm}
                        disabled={!selected || saving}
                    >
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Use this entity"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
