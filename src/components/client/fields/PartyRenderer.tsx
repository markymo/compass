import React from "react";
import { ResolvedFieldValue } from "@/lib/master-data/field-display-model";
import { PersonOrContactValueViewer } from "./PersonOrContactValueViewer";

export interface PartyRendererProps {
    value: Extract<ResolvedFieldValue, { kind: 'party' | 'partyRef' }>;
    layout?: "compact" | "row" | "detailed";
    className?: string;
}

export function PartyRenderer({ value, layout = "compact", className }: PartyRendererProps) {
    if (value.kind === 'party') {
        return (
            <div className={className}>
                <PersonOrContactValueViewer 
                    value={value.data} 
                    layout={layout} 
                    displayMask={value.displayMask} 
                    partyLabel={value.partyLabel}
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
