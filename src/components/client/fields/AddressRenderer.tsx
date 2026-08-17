import React from "react";
import { ResolvedFieldValue, SaveForReuseHandler } from "@/lib/master-data/field-display-model";
import { AddressValueViewer } from "./AddressValueViewer";

export interface AddressRendererProps {
    value: Extract<ResolvedFieldValue, { kind: 'address' | 'addressRef' }>;
    layout?: "compact" | "row" | "detailed";
    className?: string;
    claimId?: string;
    isPromotedToCCC?: boolean;
    isPromoting?: boolean;
    onSaveForReuse?: SaveForReuseHandler;
}

export function AddressRenderer({
    value,
    layout = "compact",
    className,
    claimId,
    isPromotedToCCC,
    isPromoting,
    onSaveForReuse
}: AddressRendererProps) {
    const viewerLayout = layout === "row" ? "compact" : layout;

    if (value.kind === 'address') {
        return (
            <div className={className}>
                <AddressValueViewer
                    value={value.data}
                    layout={viewerLayout}
                    claimId={claimId}
                    isPromotedToCCC={isPromotedToCCC}
                    isPromoting={isPromoting}
                    onSaveForReuse={onSaveForReuse}
                />
            </div>
        );
    }

    // addressRef
    if (value.resolved) {
        return (
            <div className={className}>
                <AddressValueViewer
                    value={value.resolved}
                    layout={viewerLayout}
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
