import React from "react";
import { ResolvedFieldValue } from "@/lib/master-data/field-display-model";

export interface CodeListRendererProps {
    value: Extract<ResolvedFieldValue, { kind: 'codeList' }>;
    className?: string;
}

export function CodeListRenderer({ value, className }: CodeListRendererProps) {
    if (!value.items || value.items.length === 0) {
        return null;
    }

    const text = value.items.map(item => {
        if (item.label && item.label !== item.code) {
            return `${item.code} — ${item.label}`;
        }
        return item.code;
    }).join('; ');

    return (
        <span className={className}>
            {text}
        </span>
    );
}
