import React from "react";
import { ResolvedFieldValue } from "@/lib/master-data/field-display-model";
import { PersonOrContactValueViewer } from "./PersonOrContactValueViewer";

export interface PartyRendererProps {
    value: Extract<ResolvedFieldValue, { kind: 'party' | 'partyRef' }>;
    layout?: "compact" | "row" | "detailed";
    className?: string;
    attachments?: import("@/lib/master-data/field-display-model").ResolvedAttachment[];
}

export function PartyRenderer({ value, layout = "compact", className, attachments }: PartyRendererProps) {
    if (value.kind === 'party') {
        return (
            <div className={className}>
                <PersonOrContactValueViewer 
                    value={value.data} 
                    layout={layout} 
                    displayMask={value.displayMask} 
                    partyLabel={value.partyLabel}
                    attachments={attachments}
                />
            </div>
        );
    }

    // partyRef
    if (value.resolved) {
        return (
            <div className={className}>
                <PersonOrContactValueViewer 
                    value={value.resolved} 
                    layout={layout} 
                    displayMask={value.displayMask} 
                    partyLabel={value.partyLabel}
                    attachments={attachments}
                />
            </div>
        );
    }

    return (
        <span className={`text-slate-400 italic ${className || ''}`}>
            {value.summary}
        </span>
    );
}
