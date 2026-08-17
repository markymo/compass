import React from "react";
import { ResolvedFieldValue, SaveForReuseHandler } from "@/lib/master-data/field-display-model";
import { PersonOrContactValueViewer } from "./PersonOrContactValueViewer";

export interface PartyRendererProps {
    value: Extract<ResolvedFieldValue, { kind: 'party' | 'partyRef' }>;
    layout?: "compact" | "row" | "detailed";
    className?: string;
    attachments?: import("@/lib/master-data/field-display-model").ResolvedAttachment[];
    claimId?: string;
    isPromotedToCCC?: boolean;
    isPromoting?: boolean;
    onSaveForReuse?: SaveForReuseHandler;
}

export function PartyRenderer({
    value,
    layout = "compact",
    className,
    attachments,
    claimId,
    isPromotedToCCC,
    isPromoting,
    onSaveForReuse
}: PartyRendererProps) {
    if (value.kind === 'party') {
        return (
            <div className={className}>
                <PersonOrContactValueViewer 
                    value={value.data} 
                    layout={layout} 
                    displayMask={value.displayMask} 
                    partyLabel={value.partyLabel}
                    attachments={attachments}
                    claimId={claimId}
                    isPromotedToCCC={isPromotedToCCC}
                    isPromoting={isPromoting}
                    onSaveForReuse={onSaveForReuse}
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
                    isPromotedToCCC={true}
                    claimId={claimId}
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
