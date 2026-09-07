"use client";

import React from "react";
import { Loader2, CheckCircle2, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SaveForReuseHandler } from "@/lib/master-data/field-display-model";
import { AddressValue, getCountryName, getAddressSummary, isAddressValue } from "@/lib/master-data/address-value";
export type { AddressValue };
export { getCountryName, getAddressSummary, isAddressValue };

interface AddressValueViewerProps {
    value: any;
    layout?: "compact" | "detailed";
    claimId?: string;
    isPromotedToCCC?: boolean;
    isPromoting?: boolean;
    onSaveForReuse?: SaveForReuseHandler;
}

export function AddressValueViewer({
    value,
    layout = "compact",
    claimId,
    isPromotedToCCC,
    isPromoting,
    onSaveForReuse
}: AddressValueViewerProps) {
    if (!value || typeof value !== "object") {
        return <span className="text-slate-400 italic">Empty</span>;
    }

    const addr = value as AddressValue;

    const renderActionButton = () => {
        if (isPromotedToCCC) {
            return (
                <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 ml-2 hover:bg-emerald-50 font-medium h-6 shrink-0" title="A reusable copy already exists for this item.">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Saved for reuse
                </Badge>
            );
        }
        if (onSaveForReuse && claimId) {
            return (
                <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] px-2 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100 hover:text-indigo-800 border-indigo-200 shrink-0 ml-2"
                    disabled={isPromoting}
                    onClick={(e) => {
                        e.stopPropagation();
                        onSaveForReuse({ kind: 'ADDRESS', claimId, address: addr });
                    }}
                    title="Save this address to your dossier library for reuse across other fields and questionnaires."
                >
                    {isPromoting ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Database className="w-3 h-3 mr-1" />}
                    Save for reuse
                </Button>
            );
        }
        return null;
    };

    if (layout === "compact") {
        return (
            <span className="inline-flex items-center gap-1.5 text-sm text-foreground font-medium">
                <span>{getAddressSummary(addr) || <span className="text-muted-foreground italic">Empty</span>}</span>
                {renderActionButton()}
            </span>
        );
    }

    const lines = addr.addressLines || [];
    const countryLabel = addr.countryName || getCountryName(addr.countryCode) || addr.rawCountry || addr.countryCode;

    return (
        <div className="grid grid-cols-1 gap-3.5 bg-muted/40 p-4 rounded-xl border border-border text-sm font-sans mt-2 shadow-inner">
            <div className="flex items-start justify-between gap-3 border-b border-border pb-2">
                <div>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Address</span>
                    <span className="text-foreground font-medium whitespace-pre-line leading-relaxed">
                        {lines.length > 0 ? lines.join("\n") : <span className="text-muted-foreground italic">—</span>}
                    </span>
                </div>
                {renderActionButton()}
            </div>
            <div className="grid grid-cols-2 gap-4 border-b border-border pb-2">
                <div>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Locality</span>
                    <span className="text-foreground font-medium">{addr.locality || <span className="text-muted-foreground italic">—</span>}</span>
                </div>
                <div>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Region</span>
                    <span className="text-foreground font-medium">{addr.region || <span className="text-muted-foreground italic">—</span>}</span>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Postcode</span>
                    <span className="text-foreground font-medium">{addr.postalCode || <span className="text-muted-foreground italic">—</span>}</span>
                </div>
                <div>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Country</span>
                    <span className="text-foreground font-medium">{countryLabel || <span className="text-muted-foreground italic">—</span>}</span>
                </div>
            </div>
        </div>
    );
}
