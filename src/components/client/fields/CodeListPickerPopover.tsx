"use client";

/**
 * CodeListPickerPopover.tsx
 *
 * A popover-based controlled-vocabulary picker using shadcn Command.
 *
 * Usage:
 *   <CodeListPickerPopover
 *     codeSystem="SIC_2007_UK"
 *     disabledCodes={['35110', '35120']}
 *     onSelect={(code) => handleAdd(code)}
 *   />
 *
 * Design:
 *   - Lazy loads entries from server action on first open; caches in state.
 *   - Filters client-side via useMemo — instant for 731-entry datasets.
 *   - Disabled codes shown with "✓ Added" indicator (visible but not selectable).
 *   - Keyboard-navigable via shadcn Command.
 *   - onSelect receives only the code string. Label is resolved server-side.
 */

import { useState, useMemo, useTransition } from 'react';
import { Plus, Loader2, Check } from 'lucide-react';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { getCodeSystemEntries, type CodeSystemEntry } from '@/actions/code-system';
import { CODE_SYSTEMS } from '@/lib/master-data/code-systems';

interface CodeListPickerPopoverProps {
    /** Code system identifier — must match a key in CODE_SYSTEMS. */
    codeSystem: string;
    /** Codes already active in the collection — rendered as disabled "✓ Added". */
    disabledCodes: string[];
    /** Called when the user selects a code. Only the code string is passed. */
    onSelect: (code: string) => void;
    /** When true, the trigger button is disabled (e.g. while a write is in flight). */
    isSubmitting?: boolean;
}

export function CodeListPickerPopover({
    codeSystem,
    disabledCodes,
    onSelect,
    isSubmitting = false,
}: CodeListPickerPopoverProps) {
    const sysConfig = CODE_SYSTEMS[codeSystem];

    const [open, setOpen] = useState(false);
    const [entries, setEntries] = useState<CodeSystemEntry[]>([]);
    const [isLoadingEntries, startLoading] = useTransition();
    const [hasLoaded, setHasLoaded] = useState(false);
    const [search, setSearch] = useState('');

    // Lazy-load entries on first open
    const handleOpenChange = (next: boolean) => {
        setOpen(next);
        if (next && !hasLoaded) {
            startLoading(async () => {
                const data = await getCodeSystemEntries(codeSystem);
                setEntries(data);
                setHasLoaded(true);
            });
        }
        if (!next) setSearch('');
    };

    // Client-side filter: match code prefix or label substring (case-insensitive)
    const filtered = useMemo(() => {
        if (!search.trim()) return entries;
        const q = search.trim().toLowerCase();
        return entries.filter(
            e => e.code.startsWith(q) || e.label.toLowerCase().includes(q)
        );
    }, [entries, search]);

    const disabledSet = useMemo(() => new Set(disabledCodes), [disabledCodes]);

    if (!sysConfig) return null;

    return (
        <Popover open={open} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    disabled={isSubmitting}
                    className="w-full justify-center bg-indigo-50/50 hover:bg-indigo-50 border-indigo-200 text-indigo-700 border-dashed"
                >
                    {isSubmitting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                        <Plus className="h-4 w-4 mr-2" />
                    )}
                    {sysConfig.addButtonLabel}
                </Button>
            </PopoverTrigger>

            <PopoverContent
                className="w-[340px] p-0"
                align="start"
                side="bottom"
            >
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder={sysConfig.searchPlaceholder}
                        value={search}
                        onValueChange={setSearch}
                    />

                    <CommandList className="max-h-[280px]">
                        {isLoadingEntries ? (
                            <div className="flex items-center justify-center py-6 text-sm text-slate-400 gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading…
                            </div>
                        ) : (
                            <>
                                <CommandEmpty className="py-4 text-center text-sm text-slate-400">
                                    {sysConfig.noResultsText}
                                </CommandEmpty>

                                <CommandGroup>
                                    {filtered.map(entry => {
                                        const isDisabled = disabledSet.has(entry.code);
                                        return (
                                            <CommandItem
                                                key={entry.code}
                                                value={entry.code}
                                                disabled={isDisabled}
                                                onSelect={() => {
                                                    if (!isDisabled) {
                                                        onSelect(entry.code);
                                                        setOpen(false);
                                                        setSearch('');
                                                    }
                                                }}
                                                className={
                                                    isDisabled
                                                        ? 'opacity-50 cursor-not-allowed'
                                                        : 'cursor-pointer'
                                                }
                                            >
                                                <span className="font-mono text-xs text-slate-500 w-12 shrink-0">
                                                    {entry.code}
                                                </span>
                                                <span className="flex-1 text-sm text-slate-800 truncate ml-2">
                                                    {entry.label}
                                                </span>
                                                {isDisabled && (
                                                    <span className="ml-2 shrink-0 flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                                                        <Check className="h-3 w-3" />
                                                        Added
                                                    </span>
                                                )}
                                            </CommandItem>
                                        );
                                    })}
                                </CommandGroup>
                            </>
                        )}
                    </CommandList>

                    {/* Footer — shows code system label and total count */}
                    {hasLoaded && entries.length > 0 && (
                        <div className="border-t border-slate-100 px-3 py-2 flex items-center justify-between">
                            <span className="text-[10px] text-slate-400">
                                {entries.length} codes · {sysConfig.label}
                            </span>
                            {filtered.length < entries.length && search && (
                                <span className="text-[10px] text-slate-400">
                                    {filtered.length} match{filtered.length !== 1 ? 'es' : ''}
                                </span>
                            )}
                        </div>
                    )}
                </Command>
            </PopoverContent>
        </Popover>
    );
}
