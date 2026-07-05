import React from "react";
import { ResolvedFieldValue } from "@/lib/master-data/field-display-model";
import { AddressValueViewer } from "./AddressValueViewer";

export interface AddressRendererProps {
    value: Extract<ResolvedFieldValue, { kind: 'address' | 'addressRef' }>;
    layout?: "compact" | "row" | "detailed";
    className?: string;
}

export function AddressRenderer({ value, layout = "compact", className }: AddressRendererProps) {
    const viewerLayout = layout === "row" ? "compact" : layout;

    if (value.kind === 'address') {
        return (
            <div className={className}>
                <AddressValueViewer value={value.data} layout={viewerLayout} />
            </div>
        );
    }

    // addressRef
    if (value.resolved) {
        return (
            <div className={className}>
                <AddressValueViewer value={value.resolved} layout={viewerLayout} />
            </div>
        );
    }

    return (
        <span className={`text-slate-400 italic ${className || ''}`}>
            {value.summary}
        </span>
    );
}
