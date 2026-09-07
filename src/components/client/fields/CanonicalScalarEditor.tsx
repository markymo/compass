"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CanonicalScalarEditorProps {
    /** The MasterFieldDefinition appDataType (e.g. 'BOOLEAN', 'DATE', 'DATETIME', 'TEXT', 'NUMBER', 'SELECT', 'JSONB') */
    dataType?: string;
    /** Current form value */
    value: any;
    /** Callback to update value */
    onChange: (value: any) => void;
    /** Configured dropdown options (if option-set backed) */
    options?: (string | { value: string; label: string })[];
    /** Disabled state during saving */
    disabled?: boolean;
    /** Input placeholder text */
    placeholder?: string;
    /** AutoFocus for instant typing */
    autoFocus?: boolean;
    /** Keyboard event handler (e.g., Enter key to submit) */
    onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    /** Additional CSS classes */
    className?: string;
    /** Optional field name for UI placeholders */
    fieldName?: string;
}

// Helpers for date input handling
const formatDateForInput = (val: any): string => {
    if (!val) return '';
    try {
        const d = new Date(val);
        if (isNaN(d.getTime())) return String(val);
        return d.toISOString().split('T')[0];
    } catch {
        return String(val);
    }
};

const parseDateFromInput = (val: string): string => {
    if (!val) return '';
    return new Date(val + 'T00:00:00.000Z').toISOString();
};

/**
 * CanonicalScalarEditor
 *
 * Single source of truth for selecting and rendering input controls for primitive/scalar datatypes
 * within the Master Record inspector drawer.
 *
 * Supported datatypes:
 *  - Configured options (data.options or appDataType === 'SELECT') -> Searchable Dropdown Combobox
 *  - BOOLEAN -> Constrained Yes/No Select (no free text)
 *  - DATE / DATETIME -> HTML date picker input
 *  - NUMBER -> Number input
 *  - TEXT / JSONB / Default -> Standard text input
 *  - Unsupported types -> Safe non-editable message
 */
export function CanonicalScalarEditor({
    dataType,
    value,
    onChange,
    options,
    disabled = false,
    placeholder,
    autoFocus = false,
    onKeyDown,
    className,
    fieldName,
}: CanonicalScalarEditorProps) {
    const [open, setOpen] = useState(false);
    const normType = (dataType || 'TEXT').toUpperCase();

    // Canonical scalar editor operates on primitive values (string, number, boolean).
    // If an explicitNone sentinel object reaches the editor, treat as empty for input rendering.
    const isExplicitNoneObject = value && typeof value === 'object' && value.explicitNone === true;
    const sanitizedValue = isExplicitNoneObject ? '' : value;

    // 1. Configured Options (Option-set or SELECT fields) -> Searchable Combobox
    if (options && options.length > 0) {
        const selectedOption = options.find((opt) => {
            const v = typeof opt === 'object' ? opt.value : opt;
            return String(v) === String(sanitizedValue);
        });
        const displayLabel = selectedOption
            ? (typeof selectedOption === 'object' ? selectedOption.label : selectedOption)
            : (sanitizedValue !== undefined && sanitizedValue !== null && sanitizedValue !== '' ? String(sanitizedValue) : '');

        return (
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        disabled={disabled}
                        className={cn(
                            "w-full justify-between bg-white border-slate-300 font-normal h-9 text-left px-3 text-sm",
                            !displayLabel && "text-muted-foreground",
                            className
                        )}
                    >
                        <span className="truncate">{displayLabel || placeholder || `Select ${fieldName || 'value'}...`}</span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent
                    className="w-[--radix-popover-trigger-width] min-w-[240px] p-0 z-[70]"
                    align="start"
                    onEscapeKeyDown={(e) => {
                        // Prevent escape from bubbling to parent Sheet/drawer
                        e.stopPropagation();
                    }}
                >
                    <Command
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.stopPropagation();
                            }
                        }}
                    >
                        <CommandInput
                            placeholder={`Search ${fieldName || 'options'}...`}
                        />
                        <CommandList className="max-h-[280px] overflow-y-auto">
                            <CommandEmpty className="p-3 text-xs text-center text-slate-500">
                                No options found.
                            </CommandEmpty>
                            <CommandGroup>
                                {options.map((opt) => {
                                    const v = typeof opt === 'object' ? opt.value : opt;
                                    const l = typeof opt === 'object' ? opt.label : opt;
                                    const strVal = String(v);
                                    const strLabel = String(l);
                                    const isSelected = String(sanitizedValue) === strVal;
                                    return (
                                        <CommandItem
                                            key={strVal}
                                            value={strVal}
                                            keywords={[strVal, strLabel]}
                                            onSelect={() => {
                                                onChange(v);
                                                setOpen(false);
                                            }}
                                            className="text-xs flex items-center justify-between cursor-pointer"
                                        >
                                            <span className="truncate">{strLabel}</span>
                                            <Check className={cn("ml-2 h-4 w-4 shrink-0", isSelected ? "opacity-100" : "opacity-0")} />
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

    // 2. BOOLEAN Datatype -> Constrained Yes/No Select
    if (normType === 'BOOLEAN') {
        const strVal = (sanitizedValue === true || sanitizedValue === 'true')
            ? 'true'
            : (sanitizedValue === false || sanitizedValue === 'false')
                ? 'false'
                : '';

        return (
            <Select
                value={strVal}
                onValueChange={(val) => onChange(val === 'true')}
                disabled={disabled}
            >
                <SelectTrigger className={cn("w-full bg-white border-slate-300", className)}>
                    <SelectValue placeholder={placeholder || "Select Yes/No..."} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="true">Yes</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                </SelectContent>
            </Select>
        );
    }

    // 3. DATE / DATETIME Datatype
    if (normType === 'DATE' || normType === 'DATETIME') {
        return (
            <Input
                type="date"
                value={formatDateForInput(sanitizedValue)}
                onChange={(e) => onChange(parseDateFromInput(e.target.value))}
                onKeyDown={onKeyDown}
                disabled={disabled}
                autoFocus={autoFocus}
                className={cn("bg-white border-slate-300", className)}
            />
        );
    }

    // 4. Standard Scalar Datatypes (TEXT, NUMBER, JSONB, etc.)
    if (
        normType === 'TEXT' ||
        normType === 'NUMBER' ||
        normType === 'JSONB' ||
        normType === 'STRING' ||
        !dataType
    ) {
        return (
            <Input
                type={normType === 'NUMBER' ? 'number' : 'text'}
                value={typeof sanitizedValue === 'object' && sanitizedValue !== null ? JSON.stringify(sanitizedValue) : (sanitizedValue ?? '')}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={placeholder || "Enter value..."}
                disabled={disabled}
                autoFocus={autoFocus}
                className={cn("bg-white border-slate-300", className)}
            />
        );
    }

    // 5. Unsupported Datatypes -> Fail safely with informative non-editable notice
    return (
        <div className="text-xs text-amber-800 bg-amber-50 p-2.5 rounded border border-amber-200 font-medium">
            Editing is not supported for field type &quot;{dataType}&quot;.
        </div>
    );
}

function isDateTypePlaceholder(normType: string) {
    return normType === 'DATE' || normType === 'DATETIME';
}
