"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, Sparkles, Plus, Check, ChevronRight, XCircle } from "lucide-react";
import { getAISemanticMatch } from "@/actions/kyc-workbench";
// FIELD_DEFINITIONS and FIELD_GROUPS removed
import { toast } from "sonner";

interface Props {
    value: string | null;
    onSelect: (val: string, type: 'master' | 'group' | 'custom' | 'create' | 'clear', label?: string) => void;
    masterFields: Array<{ fieldNo: number; label: string }>;
    masterGroups: Array<{ key: string; label: string }>;
    customFields: Array<{ id: string; label: string }>;
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
    const masterOptions = useMemo(() => masterFields.map((f: any) => ({
        value: `master:${f.fieldNo}`,
        label: f.label,
        type: 'master' as const,
        meta: `Standard Field ${f.fieldNo}`,
    })), [masterFields]);

    const groupOptions = useMemo(() => masterGroups.map((g: any) => ({
        value: `group:${g.key}`,
        label: g.label,
        type: 'group' as const,
        meta: 'Composite Group',
    })), [masterGroups]);

    const customOptions = useMemo(() => customFields.map((f: any) => ({
        value: `custom:${f.id}`,
        label: f.label,
        type: 'custom' as const,
        meta: 'Custom Field',
    })), [customFields]);

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
                        !value ? "border-amber-200 bg-amber-50/10 hover:bg-amber-50/20" : "bg-white border-slate-200"
                    )}
                >
                    <div className="flex items-center gap-2 overflow-hidden">
                        {selectedOption ? (
                            <div className="flex flex-col min-w-0">
                                <span className="font-semibold text-slate-900 truncate">{selectedOption.label}</span>
                                {!compact && <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">{selectedOption.meta}</span>}
                            </div>
                        ) : (
                            <span className="text-slate-400">Select master field...</span>
                        )}
                    </div>
                    <ChevronRight className={cn("ml-2 h-4 w-4 shrink-0 opacity-40 transition-transform duration-200", open ? "rotate-90" : "")} />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[420px] p-0 bg-white shadow-2xl z-50 border-slate-200" align="start">
                <Command shouldFilter={false} className="max-h-[450px]">
                    <div className="flex items-center border-b px-3">
                        <CommandInput
                            placeholder="Search by name or keyword..."
                            className="flex-1 h-11 border-none bg-transparent"
                            value={search}
                            onValueChange={setSearch}
                        />
                        <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                                "h-8 gap-1.5 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 transition-colors shrink-0",
                                isAIThinking ? "animate-pulse" : ""
                            )}
                            onClick={handleAISearch}
                            disabled={isAIThinking}
                        >
                            {isAIThinking ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Sparkles className="h-3.5 w-3.5" />
                            )}
                            <span className="text-xs font-semibold">AI Match</span>
                        </Button>
                    </div>

                    <CommandList className="max-h-[380px] overflow-y-auto">
                        <CommandEmpty className="py-6 text-center">
                            <div className="text-sm text-slate-500 mb-4">No matching fields found.</div>
                            {search && (
                                <Button
                                    size="sm"
                                    className="bg-indigo-600 hover:bg-indigo-700"
                                    onClick={() => {
                                        onSelect(search, 'create', search);
                                        setOpen(false);
                                    }}
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Create "{search}" as New Field
                                </Button>
                            )}
                        </CommandEmpty>

                        {/* 1. Clear Selection */}
                        {value && (
                            <CommandGroup>
                                <CommandItem
                                    className="text-slate-500 text-xs py-2"
                                    onSelect={() => { onSelect("", 'clear'); setOpen(false); }}
                                >
                                    <XCircle className="h-3.5 w-3.5 mr-2" />
                                    Clear Selection
                                </CommandItem>
                            </CommandGroup>
                        )}

                        {/* 2. AI Suggestions (If search resulted in matches) */}
                        {aiSuggestions.length > 0 && (
                            <CommandGroup heading="AI Semantic Best Matches">
                                {aiSuggestions
                                    .filter((sug, index, self) => self.findIndex(s => s.id === sug.id) === index)
                                    .map((sug: any) => {
                                        const opt = allOptions.find((o: any) => o.value === sug.id);
                                        if (!opt) return null;
                                        return (
                                            <CommandItem
                                                key={`ai-${sug.id}`}
                                                onSelect={() => {
                                                    const [type, val] = sug.id.split(':');
                                                    onSelect(val, type as any);
                                                    setOpen(false);
                                                    setAiSuggestions([]);
                                                }}
                                                className="flex flex-col items-start gap-1 py-3"
                                            >
                                                <div className="flex items-center justify-between w-full">
                                                    <span className="font-semibold text-indigo-700">{opt.label}</span>
                                                    <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-600 border-indigo-100">
                                                        {Math.round(sug.confidence * 100)}% Match
                                                    </Badge>
                                                </div>
                                                <p className="text-[11px] text-slate-500 italic leading-snug">{sug.reasoning}</p>
                                            </CommandItem>
                                        );
                                    })}
                            </CommandGroup>
                        )}

                        {(aiSuggestions.length > 0) && <CommandSeparator />}

                        {/* 3. Tiered Results */}
                        {filteredOptions.length > 0 && (
                            <>
                                <CommandGroup heading="Groups">
                                    {filteredOptions.filter((o: any) => o.type === 'group').map((o: any) => (
                                        <CommandItem
                                            key={o.value}
                                            onSelect={() => { onSelect(o.value.split(':')[1], 'group'); setOpen(false); }}
                                            className="flex items-center gap-2 py-2"
                                        >
                                            <Check className={cn("h-4 w-4 text-indigo-600", value === o.value ? "opacity-100" : "opacity-0")} />
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium">{o.label}</span>
                                                <span className="text-[10px] text-slate-400">{o.meta}</span>
                                            </div>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>

                                <CommandSeparator />

                                <CommandGroup heading="Standard Fields">
                                    {filteredOptions.filter((o: any) => o.type === 'master').map((o: any) => (
                                        <CommandItem
                                            key={o.value}
                                            onSelect={() => { onSelect(o.value.split(':')[1], 'master'); setOpen(false); }}
                                            className="flex items-center gap-2 py-2"
                                        >
                                            <Check className={cn("h-4 w-4 text-indigo-600", value === o.value ? "opacity-100" : "opacity-0")} />
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium">{o.label}</span>
                                                <span className="text-[10px] text-slate-400">{o.meta}</span>
                                            </div>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>

                                <CommandSeparator />

                                <CommandGroup heading="Custom Fields">
                                    {filteredOptions.filter((o: any) => o.type === 'custom').map((o: any) => (
                                        <CommandItem
                                            key={o.value}
                                            onSelect={() => { onSelect(o.value.split(':')[1], 'custom'); setOpen(false); }}
                                            className="flex items-center gap-2 py-2"
                                        >
                                            <Check className={cn("h-4 w-4 text-indigo-600", value === o.value ? "opacity-100" : "opacity-0")} />
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium">{o.label}</span>
                                                <span className="text-[10px] text-slate-400">{o.meta}</span>
                                            </div>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </>
                        )}
                    </CommandList>

                    {/* Sticky Footer: Create New */}
                    <div className="p-2 border-t bg-slate-50/50">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start text-indigo-600 hover:bg-slate-100 h-9 font-semibold"
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
