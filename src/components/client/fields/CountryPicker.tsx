"use client";

import React, { useState, useMemo } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { COUNTRY_CODES, resolveCountry } from "@/lib/master-data/countries";
import { cn } from "@/lib/utils";

export interface CountryOption {
    value: string;
    label: string;
}

interface CountryPickerProps {
    value?: string | null;
    onChange: (code: string, name: string) => void;
    disabled?: boolean;
    placeholder?: string;
    searchPlaceholder?: string;
    emptyMessage?: string;
    autoFocus?: boolean;
    className?: string;
    triggerClassName?: string;
    options?: Array<{ value: string; label: string }>;
}

export function CountryPicker({
    value,
    onChange,
    disabled = false,
    placeholder = "Select country...",
    searchPlaceholder,
    emptyMessage,
    autoFocus = false,
    className,
    triggerClassName,
    options,
}: CountryPickerProps) {
    const [open, setOpen] = useState(false);

    const countryList = useMemo(() => {
        if (options && options.length > 0) {
            return options.map((opt) => {
                const code = String(opt.value);
                const rawLabel = String(opt.label);
                // Strip code prefix from name if rawLabel already starts with it (e.g. "US-DE – Delaware")
                let name = rawLabel;
                if (rawLabel.startsWith(code + ' – ')) {
                    name = rawLabel.slice(code.length + 3);
                } else if (rawLabel.startsWith(code + ' - ')) {
                    name = rawLabel.slice(code.length + 3);
                }
                const label = rawLabel.startsWith(code) ? rawLabel : `${code} – ${rawLabel}`;
                return { code, name, label };
            });
        }
        return Object.entries(COUNTRY_CODES).map(([code, name]) => ({
            code,
            name,
            label: `${code} – ${name}`,
        }));
    }, [options]);

    const resolved = useMemo(() => {
        if (!value) return null;
        const trimmed = value.trim();
        const codeMatch = countryList.find(c => c.code.toLowerCase() === trimmed.toLowerCase());
        if (codeMatch) return codeMatch;
        const nameMatch = countryList.find(c => c.name.toLowerCase() === trimmed.toLowerCase() || c.label.toLowerCase() === trimmed.toLowerCase());
        if (nameMatch) return nameMatch;
        if (!options || options.length === 0) {
            const r = resolveCountry(trimmed);
            if (r) return { code: r.code, name: r.name, label: `${r.code} – ${r.name}` };
        }
        return null;
    }, [value, countryList, options]);

    const displayLabel = resolved
        ? resolved.label
        : value && value.trim()
        ? value
        : null;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    disabled={disabled}
                    autoFocus={autoFocus}
                    className={cn(
                        "w-full justify-between bg-card text-foreground border-border font-normal h-8 text-xs px-2.5",
                        !displayLabel && "text-muted-foreground",
                        triggerClassName
                    )}
                >
                    <span className="truncate">{displayLabel || placeholder}</span>
                    <ChevronsUpDown className="ml-1.5 h-3.5 w-3.5 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className={cn("w-[280px] p-0 z-[70] shadow-md border-border bg-popover text-popover-foreground", className)}
                align="start"
                onEscapeKeyDown={(e) => e.stopPropagation()}
            >
                <Command
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') e.stopPropagation();
                    }}
                >
                    <CommandInput
                        placeholder={searchPlaceholder || (options && options.length > 0 ? "Search options..." : "Search country or code...")}
                        className="h-8 text-xs"
                    />
                    <CommandList className="max-h-[240px] overflow-y-auto">
                        <CommandEmpty className="p-3 text-xs text-center text-muted-foreground">
                            {emptyMessage || (options && options.length > 0 ? "No options found." : "No country found.")}
                        </CommandEmpty>
                        <CommandGroup>
                            {countryList.map((c) => {
                                const isSelected = resolved?.code === c.code;
                                return (
                                    <CommandItem
                                        key={c.code}
                                        value={`${c.code} ${c.name} ${c.label}`}
                                        role="option"
                                        aria-selected={isSelected}
                                        onSelect={() => {
                                            onChange(c.code, c.name);
                                            setOpen(false);
                                        }}
                                        className="text-xs flex items-center justify-between cursor-pointer py-1.5 px-2"
                                    >
                                        <div className="flex items-center gap-1.5 truncate">
                                            <span className="font-mono font-bold text-[11px] text-muted-foreground shrink-0">{c.code}</span>
                                            <span className="text-muted-foreground/60 shrink-0">–</span>
                                            <span className="truncate text-foreground font-medium">{c.name}</span>
                                        </div>
                                        <Check className={cn("ml-2 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400", isSelected ? "opacity-100" : "opacity-0")} />
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

export function isCountryField(fieldNo?: number | null, fieldName?: string | null, fmsbRef?: string | null): boolean {
    if (!fieldNo && !fieldName) return false;
    if (fieldNo === 134) return true;
    if (fmsbRef === 'A3') return true;
    const lowerName = (fieldName || '').toLowerCase();
    if (lowerName.includes('country of formation') || lowerName.includes('country of incorporation')) {
        return true;
    }
    return false;
}
