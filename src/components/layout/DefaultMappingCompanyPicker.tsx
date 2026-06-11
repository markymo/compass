"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    listSelectableClientLEs,
    updateDefaultMappingCompany,
    getEffectiveMappingDefaults
} from "@/actions/user-preferences";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList
} from "@/components/ui/command";
import { Building2, HelpCircle, Check, Loader2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface SelectableCompany {
    id: string;
    name: string;
    lei?: string | null;
    registryReferences?: Array<{
        registryAuthorityId: string;
        localRegistrationNumber: string;
    }>;
}

export function DefaultMappingCompanyPicker({ isCollapsed = false }: { isCollapsed?: boolean }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [companies, setCompanies] = useState<SelectableCompany[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [selectedName, setSelectedName] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [activeIds, setActiveIds] = useState<{
        gleifLei?: string;
        registryOverrides?: Record<string, { registeredAs: string }>;
    } | null>(null);

    useEffect(() => {
        // Fetch current preference value
        getEffectiveMappingDefaults().then((res) => {
            if (res.selectedCompanyId) {
                setSelectedId(res.selectedCompanyId);
                setSelectedName(res.selectedCompanyName || null);
                setActiveIds({
                    gleifLei: res.gleifLei,
                    registryOverrides: res.registryOverrides
                });
            } else {
                setSelectedId(null);
                setSelectedName(null);
                setActiveIds(null);
            }
        });
    }, []);

    useEffect(() => {
        if (open && companies.length === 0) {
            setLoading(true);
            listSelectableClientLEs().then((res) => {
                if (res.success && res.companies) {
                    setCompanies(res.companies);
                }
                setLoading(false);
            });
        }
    }, [open, companies.length]);

    async function handleSelect(id: string | null, name: string | null) {
        setUpdating(true);
        try {
            const res = await updateDefaultMappingCompany(id);
            if (res.success) {
                setSelectedId(id);
                setSelectedName(name);
                toast.success(id ? `Default mapping company set to ${name}` : "System defaults restored");
                setOpen(false);
                window.location.reload();
            } else {
                toast.error(res.error || "Failed to update preference");
            }
        } catch (e) {
            console.error(e);
            toast.error("An error occurred");
        } finally {
            setUpdating(false);
        }
    }

    const currentLabel = selectedName || "System Defaults";

    if (isCollapsed) {
        return (
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <button
                        className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800",
                            selectedId && "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/20"
                        )}
                        title={`Default Mapping Company: ${currentLabel}`}
                    >
                        <Building2 className="h-4 w-4" />
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0" align="start" side="right">
                    <CommandListContent
                        loading={loading}
                        updating={updating}
                        companies={companies}
                        selectedId={selectedId}
                        onSelect={handleSelect}
                    />
                </PopoverContent>
            </Popover>
        );
    }

    return (
        <div className="px-3 py-2 space-y-1.5 border-t border-slate-100 dark:border-slate-800/50 mt-2">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                <span>Default Mapping Company</span>
                <TooltipProvider>
                    <Tooltip delayDuration={300}>
                        <TooltipTrigger asChild>
                            <button type="button" className="text-slate-400 hover:text-slate-600 transition-colors">
                                <HelpCircle className="h-3 w-3" />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[220px] text-xs font-normal normal-case tracking-normal">
                            Changes example data used in mapping tools only. Does not alter client records.
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>

            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-between h-8 text-xs font-medium text-slate-700 bg-white border-slate-200 hover:bg-slate-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800/50"
                    >
                        <span className="truncate flex items-center gap-1.5">
                            <Building2 className={cn("h-3.5 w-3.5", selectedId ? "text-indigo-500" : "text-slate-400")} />
                            {currentLabel}
                        </span>
                        <ChevronDown className="h-3 w-3 opacity-50 shrink-0 ml-1" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0" align="start">
                    <CommandListContent
                        loading={loading}
                        updating={updating}
                        companies={companies}
                        selectedId={selectedId}
                        onSelect={handleSelect}
                    />
                </PopoverContent>
            </Popover>

            {selectedId && activeIds && (
                <div className="mt-1 px-2 py-1.5 space-y-1 text-[10px] text-slate-400 dark:text-slate-500 font-mono bg-slate-50 dark:bg-slate-900/30 rounded border border-slate-100 dark:border-slate-800/30">
                    {activeIds.gleifLei && (
                        <div className="flex justify-between gap-2">
                            <span>LEI:</span>
                            <span className="text-slate-600 dark:text-slate-300 truncate select-all">{activeIds.gleifLei}</span>
                        </div>
                    )}
                    {activeIds.registryOverrides && Object.entries(activeIds.registryOverrides).map(([authId, val]) => (
                        <div key={authId} className="flex justify-between gap-2">
                            <span>{authId}:</span>
                            <span className="text-slate-600 dark:text-slate-300 truncate select-all">{val.registeredAs}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function CommandListContent({
    loading,
    updating,
    companies,
    selectedId,
    onSelect
}: {
    loading: boolean;
    updating: boolean;
    companies: SelectableCompany[];
    selectedId: string | null;
    onSelect: (id: string | null, name: string | null) => void;
}) {
    return (
        <Command className="text-xs">
            <CommandInput placeholder="Search ClientLEs..." className="h-8 text-xs" />
            <CommandList className="max-h-[200px]">
                <CommandEmpty>No companies found.</CommandEmpty>
                <CommandGroup>
                    <CommandItem
                        onSelect={() => onSelect(null, null)}
                        className="cursor-pointer text-xs"
                        disabled={updating}
                    >
                        <span className={cn("flex-1", !selectedId && "font-semibold text-indigo-600")}>
                            System Defaults (Clear)
                        </span>
                        {!selectedId && <Check className="h-3 w-3 text-indigo-600 ml-auto" />}
                    </CommandItem>

                    {loading && (
                        <div className="flex items-center justify-center p-3">
                            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                        </div>
                    )}

                    {!loading && companies.map((c) => {
                        const isSelected = selectedId === c.id;
                        const ids: string[] = [];
                        if (c.lei) {
                            ids.push(`LEI: ${c.lei}`);
                        }
                        if (c.registryReferences) {
                            c.registryReferences.forEach(ref => {
                                ids.push(`${ref.registryAuthorityId}: ${ref.localRegistrationNumber}`);
                            });
                        }
                        const idText = ids.join(" · ");

                        return (
                            <CommandItem
                                key={c.id}
                                onSelect={() => onSelect(c.id, c.name)}
                                className="cursor-pointer text-xs flex flex-col items-start gap-0.5 py-1.5"
                                disabled={updating}
                            >
                                <div className="flex w-full items-center justify-between">
                                    <span className={cn("truncate font-medium", isSelected && "font-semibold text-indigo-600")}>
                                        {c.name}
                                    </span>
                                    {isSelected && <Check className="h-3 w-3 text-indigo-600 ml-auto shrink-0" />}
                                </div>
                                {idText && (
                                    <span className="text-[10px] text-slate-400 font-mono truncate max-w-full">
                                        {idText}
                                    </span>
                                )}
                            </CommandItem>
                        );
                    })}
                </CommandGroup>
            </CommandList>
        </Command>
    );
}
