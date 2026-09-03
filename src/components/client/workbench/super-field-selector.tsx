"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, Sparkles, Plus, Check, ChevronRight, XCircle, Type, Calendar, Hash, ToggleLeft, FileText, Braces } from "lucide-react";
import { getAISemanticMatch } from "@/actions/kyc-workbench";
import { getAddressSummary } from "@/components/client/fields/AddressValueViewer";
import { applyMasterDataProjection } from "@/lib/kyc/projection";
import { resolveFieldForDisplay, getCompactCanonicalSummary } from "@/lib/master-data/field-interpreter";

function getDataTypeIcon(dataType: string | null | undefined) {
    if (!dataType) return null;
    const t = dataType.toLowerCase();
    const className = "h-3.5 w-3.5 text-slate-400 shrink-0";
    if (t.includes('date')) return <Calendar className={className} />;
    if (t.includes('num') || t.includes('int') || t.includes('float')) return <Hash className={className} />;
    if (t.includes('bool') || t.includes('yes')) return <ToggleLeft className={className} />;
    if (t.includes('doc') || t.includes('file')) return <FileText className={className} />;
    if (t.includes('json') || t.includes('obj') || t.includes('group')) return <Braces className={className} />;
    return <Type className={className} />;
}
// FIELD_DEFINITIONS and FIELD_GROUPS removed
import { toast } from "sonner";

interface Props {
    value: string | null;
    onSelect: (val: string, type: 'master' | 'group' | 'custom' | 'create' | 'clear', label?: string) => void;
    masterFields: Array<{ fieldNo: number; label: string; dataType?: string | null; currentValue?: any }>;
    masterGroups: Array<{ key: string; label: string; dataType?: string | null; currentValue?: any }>;
    customFields: Array<{ id: string; label: string; dataType?: string | null; currentValue?: any }>;
    questionText: string;
    compact?: boolean;
    disabled?: boolean;
}

export function SuperFieldSelector({
    value,
    onSelect,
    masterFields,
    masterGroups,
    customFields,
    questionText,
    compact = false,
    disabled = false
}: Props) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [isAIThinking, setIsAIThinking] = useState(false);
    const [aiSuggestions, setAiSuggestions] = useState<Array<{ id: string; confidence: number; reasoning: string }>>([]);

    // 1. Prepare Local Options
    const masterOptions = useMemo(() => {
        const options: any[] = [];
        masterFields.forEach((f: any) => {
            let previewText: string | null = null;
            if (f.currentValue != null && f.currentValue !== "") {
                const metadata = {
                    fieldNo: f.fieldNo,
                    label: f.label,
                    appDataType: f.dataType as any,
                    displayState: 'HAS_VALUE' as const,
                    isMultiValue: Array.isArray(f.currentValue)
                };
                const displayModel = resolveFieldForDisplay(f.currentValue, null, metadata);
                const summary = getCompactCanonicalSummary(displayModel, { label: f.label, appDataType: f.dataType, isMultiValue: Array.isArray(f.currentValue) });
                previewText = summary || null;
            }

            options.push({
                value: `master:${f.fieldNo}`,
                label: f.label,
                type: 'master',
                meta: `Standard Field ${f.fieldNo}`,
                dataType: f.dataType,
                currentValue: f.currentValue,
                previewText,
                category: f.category
            });
            if (f.dataType === 'ADDRESS') {
                const projections = [
                    { path: 'locality', label: 'Locality' },
                    { path: 'region', label: 'Region' },
                    { path: 'postalCode', label: 'Postal Code' },
                    { path: 'countryCode', label: 'Country Code' },
                    { path: 'addressLines[0]', label: 'Address Line 1' },
                    { path: 'addressLines[1]', label: 'Address Line 2' },
                ];
                projections.forEach(proj => {
                    const extractedValue = applyMasterDataProjection(f.currentValue, proj.path);
                    options.push({
                        value: `master:${f.fieldNo}:${proj.path}`,
                        label: `${f.label} · ${proj.label}`,
                        type: 'master',
                        meta: `Standard Field ${f.fieldNo} Projection`,
                        dataType: 'STRING',
                        currentValue: null, // Keep null to keep UI simple
                        previewText: extractedValue ? String(extractedValue) : `Extracts ${proj.path}`,
                        category: f.category
                    });
                });
            }
        });
        return options;
    }, [masterFields]);

    const groupOptions = useMemo(() => masterGroups.map((g: any) => {
        let previewText: string | null = null;
        if (g.currentValue != null && g.currentValue !== "") {
            previewText = Array.isArray(g.currentValue) 
                ? `${g.currentValue.length} items` 
                : (typeof g.currentValue === 'object' ? null : String(g.currentValue));
        }
        return {
            value: `group:${g.key}`,
            label: g.label,
            type: 'group' as const,
            meta: 'Composite Group',
            dataType: g.dataType,
            currentValue: g.currentValue,
            previewText
        };
    }), [masterGroups]);

    const customOptions = useMemo(() => customFields.map((f: any) => {
        let previewText: string | null = null;
        if (f.currentValue != null && f.currentValue !== "") {
            const metadata = {
                fieldNo: -1,
                label: f.label,
                appDataType: f.dataType as any,
                displayState: 'HAS_VALUE' as const,
                isMultiValue: Array.isArray(f.currentValue)
            };
            const displayModel = resolveFieldForDisplay(f.currentValue, null, metadata);
            const summary = getCompactCanonicalSummary(displayModel, { label: f.label, appDataType: f.dataType, isMultiValue: Array.isArray(f.currentValue) });
            previewText = summary || null;
        }
        return {
            value: `custom:${f.id}`,
            label: f.label,
            type: 'custom' as const,
            meta: 'Custom Field',
            dataType: f.dataType,
            currentValue: f.currentValue,
            previewText
        };
    }), [customFields]);

    const allOptions = useMemo(() => [...groupOptions, ...masterOptions, ...customOptions], [groupOptions, masterOptions, customOptions]);
    const selectedOption = allOptions.find((o: any) => o.value === value);

    // 2. Filter logic (since we use shouldFilter={false} to control AI & creation)
    const filteredOptions = useMemo(() => {
        const s = search.toLowerCase();
        if (!s) return allOptions;
        return allOptions.filter((o: any) =>
            o.label.toLowerCase().includes(s) ||
            o.meta.toLowerCase().includes(s)
        );
    }, [allOptions, search]);

    // 3. AI Search Handler
    const handleAISearch = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsAIThinking(true);
        try {
            const res = await getAISemanticMatch(questionText, search || undefined);
            if (res.success && res.suggestions) {
                setAiSuggestions(res.suggestions);
                if (res.suggestions.length === 0) {
                    toast.info("AI couldn't find a perfect match. Try a manual search.");
                }
            } else {
                toast.error("AI Semantic Search failed");
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsAIThinking(false);
        }
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    disabled={disabled}
                    className={cn(
                        "w-full justify-between font-normal text-left transition-all",
                        compact ? "h-9 px-3 py-1 text-xs" : "h-auto py-3 px-4",
                        !value ? "border-amber-200 dark:border-amber-800 bg-amber-50/10 dark:bg-amber-950/20 hover:bg-amber-50/20" : "bg-card border-border text-card-foreground"
                    )}
                >
                    <div className="flex items-center gap-2 overflow-hidden">
                        {selectedOption ? (
                            <div className="flex flex-col min-w-0">
                                <span className="font-semibold text-foreground truncate">{selectedOption.label}</span>
                                {!compact && <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{selectedOption.meta}</span>}
                            </div>
                        ) : (
                            <span className="text-muted-foreground">Select master field...</span>
                        )}
                    </div>
                    <ChevronRight className={cn("ml-2 h-4 w-4 shrink-0 opacity-40 transition-transform duration-200", open ? "rotate-90" : "")} />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[420px] p-0 bg-card text-card-foreground shadow-2xl z-50 border-border" align="start">
                <Command shouldFilter={false} className="max-h-[450px]">
                    <div className="flex items-center border-b border-border px-3">
                        <CommandInput
                            placeholder="Search by name or keyword..."
                            className="flex-1 h-11 border-none bg-transparent"
                            value={search}
                            onValueChange={setSearch}
                        />
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs gap-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                            onClick={handleAISearch}
                            disabled={isAIThinking}
                        >
                            {isAIThinking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                            AI Match
                        </Button>
                    </div>

                    <CommandList>
                        <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">No matching fields found.</CommandEmpty>

                        {/* Clear option if selected */}
                        {value && (
                            <CommandGroup>
                                <CommandItem
                                    onSelect={() => { onSelect("", 'clear'); setOpen(false); }}
                                    className="text-destructive font-medium cursor-pointer"
                                >
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Unmap Field
                                </CommandItem>
                            </CommandGroup>
                        )}

                        {/* AI Suggestions Section */}
                        {aiSuggestions.length > 0 && (
                            <CommandGroup heading="AI Recommended Matches">
                                {aiSuggestions
                                    .map(sug => {
                                        const opt = allOptions.find(o => o.value === sug.id);
                                        if (!opt) return null;
                                        return (
                                            <CommandItem
                                                key={`ai-${sug.id}`}
                                                onSelect={() => {
                                                    const type = opt.type as 'master' | 'group' | 'custom';
                                                    const rawVal = opt.value.substring(opt.value.indexOf(':') + 1);
                                                    onSelect(rawVal, type);
                                                    setOpen(false);
                                                }}
                                                className="flex flex-col items-start gap-1 py-2 bg-indigo-50/40 dark:bg-indigo-950/30 hover:bg-indigo-50/80 cursor-pointer"
                                            >
                                                <div className="flex items-center w-full justify-between">
                                                    <span className="font-semibold text-indigo-700 dark:text-indigo-300">{opt.label}</span>
                                                    <Badge variant="outline" className="text-[10px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800">
                                                        {Math.round(sug.confidence * 100)}% Match
                                                    </Badge>
                                                </div>
                                                <p className="text-[11px] text-muted-foreground italic leading-snug">{sug.reasoning}</p>
                                            </CommandItem>
                                        );
                                    })}
                            </CommandGroup>
                        )}

                        {/* 3. Tiered Results */}
                        {filteredOptions.length > 0 && (
                            <>
                                <CommandGroup heading="Groups">
                                    {filteredOptions.filter((o: any) => o.type === 'group').map((o: any) => (
                                        <CommandItem
                                            key={o.value}
                                            onSelect={() => { 
                                                const val = o.value.substring(o.value.indexOf(':') + 1);
                                                onSelect(val, 'group'); 
                                                setOpen(false); 
                                            }}
                                            className="flex flex-col items-start gap-1 py-2 cursor-pointer"
                                        >
                                            <div className="flex items-center w-full gap-2">
                                                <Check className={cn("h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0", value === o.value ? "opacity-100" : "opacity-0")} />
                                                <span className="text-sm font-medium flex-1">{o.label}</span>
                                                {getDataTypeIcon(o.dataType)}
                                            </div>
                                            <div className="pl-6 flex flex-col w-full text-muted-foreground">
                                                {o.previewText ? (
                                                    <span className="text-[11px] font-medium text-foreground truncate italic bg-muted px-1.5 py-0.5 rounded border border-border mt-1">
                                                        {o.previewText}
                                                    </span>
                                                ) : null}
                                            </div>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>

                                <CommandSeparator />

                                {(() => {
                                    const masterOptions = filteredOptions.filter((o: any) => o.type === 'master');
                                    if (masterOptions.length === 0) return null;
                                    
                                    const grouped = new Map<string, any[]>();
                                    masterOptions.forEach((o: any) => {
                                        const cat = o.category || 'Uncategorized';
                                        if (!grouped.has(cat)) grouped.set(cat, []);
                                        grouped.get(cat)!.push(o);
                                    });

                                    return Array.from(grouped.entries()).map(([cat, opts]) => (
                                        <CommandGroup key={`cat-${cat}`} heading={cat}>
                                            {opts.map((o: any) => (
                                                <CommandItem
                                                    key={o.value}
                                                    onSelect={() => { 
                                                        const val = o.value.substring(o.value.indexOf(':') + 1);
                                                        onSelect(val, 'master'); 
                                                        setOpen(false); 
                                                    }}
                                                    className="flex flex-col items-start gap-1 py-2 cursor-pointer"
                                                >
                                                    <div className="flex items-center w-full gap-2">
                                                        <Check className={cn("h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0", value === o.value ? "opacity-100" : "opacity-0")} />
                                                        <span className="text-sm font-medium flex-1">{o.label}</span>
                                                        {getDataTypeIcon(o.dataType)}
                                                    </div>
                                                    <div className="pl-6 flex flex-col w-full text-muted-foreground">
                                                        {o.previewText ? (
                                                            <span className="text-[11px] font-medium text-foreground truncate italic bg-muted px-1.5 py-0.5 rounded border border-border mt-1">
                                                                {o.previewText}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    ));
                                })()}

                                <CommandSeparator />

                                <CommandGroup heading="Custom Fields">
                                    {filteredOptions.filter((o: any) => o.type === 'custom').map((o: any) => (
                                        <CommandItem
                                            key={o.value}
                                            onSelect={() => { 
                                                const val = o.value.substring(o.value.indexOf(':') + 1);
                                                onSelect(val, 'custom'); 
                                                setOpen(false); 
                                            }}
                                            className="flex flex-col items-start gap-1 py-2 cursor-pointer"
                                        >
                                            <div className="flex items-center w-full gap-2">
                                                <Check className={cn("h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0", value === o.value ? "opacity-100" : "opacity-0")} />
                                                <span className="text-sm font-medium flex-1">{o.label}</span>
                                                {getDataTypeIcon(o.dataType)}
                                            </div>
                                            <div className="pl-6 flex flex-col w-full text-muted-foreground">
                                                {o.previewText ? (
                                                    <span className="text-[11px] font-medium text-foreground truncate italic bg-muted px-1.5 py-0.5 rounded border border-border mt-1">
                                                        {o.previewText}
                                                    </span>
                                                ) : null}
                                            </div>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </>
                        )}
                    </CommandList>

                    {/* Sticky Footer: Create New */}
                    <div className="p-2 border-t border-border bg-muted/50">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start text-indigo-600 dark:text-indigo-400 hover:bg-muted h-9 font-semibold"
                            onClick={() => {
                                onSelect("", 'create', search);
                                setOpen(false);
                            }}
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Create New Master Field
                        </Button>
                    </div>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

// Mini Badge for AI confidence
function Badge({ children, variant, className }: any) {
    return (
        <span className={cn("px-1.5 py-0.5 rounded-full text-[10px] font-bold border", className)}>
            {children}
        </span>
    );
}
