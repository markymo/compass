"use client";

import React from "react";

import { COUNTRY_CODES } from "@/lib/master-data/countries";

export interface AddressValue {
    addressLines?: string[];
    locality?: string | null;
    region?: string | null;
    postalCode?: string | null;
    countryCode?: string | null;
    countryName?: string | null;
    rawCountry?: string | null;
}

interface AddressValueViewerProps {
    value: any;
    layout?: "compact" | "detailed";
}

export function getCountryName(code: string | null | undefined): string {
    if (!code) return "";
    const cleanCode = code.toUpperCase().trim();
    return COUNTRY_CODES[cleanCode] || code;
}

export function getAddressSummary(addr: any): string {
    if (!addr) return "";

    let resolvedAddr = addr;
    if (addr.ccAddressId && addr._resolvedData?.ccAddress?.data) {
        resolvedAddr = addr._resolvedData.ccAddress.data;
    }

    const lines = resolvedAddr.addressLines || [];
    const parts = [
        ...lines,
        resolvedAddr.locality,
        resolvedAddr.region,
        resolvedAddr.postalCode,
        resolvedAddr.countryName || getCountryName(resolvedAddr.countryCode) || resolvedAddr.rawCountry || resolvedAddr.countryCode,
    ].filter(Boolean);
    return parts.join(", ");
}

export function isAddressValue(value: any): boolean {
    if (!value || typeof value !== "object") return false;
    
    if (value.ccAddressId && value._resolvedData?.ccAddress?.data) return true;

    // An ADDRESS value is canonical if it contains addressLines.
    // However, do not mistake it for ADDRESS_REF which uses line1, line2, etc.
    return "addressLines" in value && !("line1" in value);
}

export function AddressValueViewer({ value, layout = "compact" }: AddressValueViewerProps) {
    if (!value || typeof value !== "object") {
        return <span className="text-slate-400 italic">Empty</span>;
    }

    const addr = value as AddressValue;

    if (layout === "compact") {
        return <span>{getAddressSummary(addr) || <span className="text-slate-400 italic">Empty</span>}</span>;
    }

    const lines = addr.addressLines || [];
    const countryLabel = addr.countryName || getCountryName(addr.countryCode) || addr.rawCountry || addr.countryCode;

    return (
        <div className="grid grid-cols-1 gap-3.5 bg-slate-50/50 p-4 rounded-xl border border-slate-100 text-sm font-sans mt-2 shadow-inner">
            <div className="border-b border-slate-100 pb-2">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Address</span>
                <span className="text-slate-900 font-medium whitespace-pre-line leading-relaxed">
                    {lines.length > 0 ? lines.join("\n") : <span className="text-slate-400 italic">—</span>}
                </span>
            </div>
            <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-2">
                <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Locality</span>
                    <span className="text-slate-900 font-medium">{addr.locality || <span className="text-slate-400 italic">—</span>}</span>
                </div>
                <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Region</span>
                    <span className="text-slate-900 font-medium">{addr.region || <span className="text-slate-400 italic">—</span>}</span>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Postcode</span>
                    <span className="text-slate-900 font-medium">{addr.postalCode || <span className="text-slate-400 italic">—</span>}</span>
                </div>
                <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Country</span>
                    <span className="text-slate-900 font-medium">{countryLabel || <span className="text-slate-400 italic">—</span>}</span>
                </div>
            </div>
        </div>
    );
}
