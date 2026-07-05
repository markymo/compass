import React from "react";
import { ResolvedFieldValue } from "@/lib/master-data/field-display-model";

export interface CodeListRendererProps {
    value: Extract<ResolvedFieldValue, { kind: 'codeList' }>;
    itemLimit?: number;
    className?: string;
}

export function CodeListRenderer({ value, itemLimit, className }: CodeListRendererProps) {
    if (!value.items || value.items.length === 0) {
        return null;
    }

    let text = "";
    if (itemLimit && value.items.length > itemLimit) {
        const visibleItems = value.items.slice(0, itemLimit);
        const hiddenCount = value.items.length - itemLimit;
        text = visibleItems.map(item => {
            if (item.label && item.label !== item.code) {
                return `${item.code} — ${item.label}`;
            }
            return item.code;
        }).join('; ') + `; +${hiddenCount} more`;
    } else {
        text = value.items.map(item => {
            if (item.label && item.label !== item.code) {
                return `${item.code} — ${item.label}`;
            }
            return item.code;
        }).join('; ');
    }

    return (
        <span className={className}>
            {text}
        </span>
    );
}
