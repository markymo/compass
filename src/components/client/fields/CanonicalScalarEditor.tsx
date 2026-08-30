"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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
 *  - Configured options (data.options or appDataType === 'SELECT') -> Dropdown Select
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
    const normType = (dataType || 'TEXT').toUpperCase();

    // Helper: normalize explicitNone/tombstone sentinels to empty string for form inputs
    const isSentinel = (v: any) => {
        if (!v) return false;
        if (typeof v === 'object' && (v.explicitNone === true || v.tombstone === true)) return true;
        if (typeof v === 'string' && (v.includes('"explicitNone":true') || v.includes('"explicitNone": true') || v.includes('"tombstone":true'))) return true;
        return false;
    };

    const sanitizedValue = isSentinel(value) ? '' : value;

    // 1. Configured Options (Option-set or SELECT fields)
    if (options && options.length > 0) {
        return (
            <Select
                value={typeof sanitizedValue === 'string' || typeof sanitizedValue === 'number' ? String(sanitizedValue) : ''}
                onValueChange={(val) => onChange(val)}
                disabled={disabled}
            >
                <SelectTrigger className={cn("w-full bg-white border-slate-300", className)}>
                    <SelectValue placeholder={placeholder || `Select ${fieldName || 'value'}...`} />
                </SelectTrigger>
                <SelectContent position="item-aligned">
                    {options.map((opt) => {
                        const v = typeof opt === 'object' ? opt.value : opt;
                        const l = typeof opt === 'object' ? opt.label : opt;
                        return (
                            <SelectItem key={String(v)} value={String(v)}>
                                {l}
                            </SelectItem>
                        );
                    })}
                </SelectContent>
            </Select>
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
