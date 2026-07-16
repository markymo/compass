"use client";

import React, { useState, useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, MapPin, Loader2, X, Check } from "lucide-react";
import { searchCCAddresses } from "@/actions/cc-address-actions";
import { AddressValue, getAddressSummary } from "./AddressValueViewer";

export interface PartyAddressRef {
    ccAddressId: string;
}

export interface CCAddressSelectorProps {
    clientLEId: string;
    currentRef?: PartyAddressRef | null;
    onSelect: (ref: PartyAddressRef | null, data?: AddressValue) => void;
    onCreateNew?: () => void;
    disabled?: boolean;
}

export function CCAddressSelector({
    clientLEId,
    currentRef,
    onSelect,
    onCreateNew,
    disabled
}: CCAddressSelectorProps) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [isSearching, startSearchTransition] = useTransition();

    const [knownAddresses, setKnownAddresses] = useState<Map<string, any>>(new Map());

    // Load initial addresses or perform search
    useEffect(() => {
        startSearchTransition(async () => {
            try {
                const data = await searchCCAddresses(clientLEId, query);
                setResults(data);
                
                // Keep track of any addresses we've seen, especially useful for preserving 
                // the current address data even when the user filters it out via search.
                setKnownAddresses(prev => {
                    const next = new Map(prev);
                    data.forEach((d: any) => next.set(d.id, d));
                    return next;
                });
            } catch (err) {
                console.error("Search failed", err);
            }
        });
    }, [query, clientLEId]);

    // Find current address data if it exists in known addresses
    const currentAddressData = currentRef ? knownAddresses.get(currentRef.ccAddressId) : null;
    const hasCurrentRef = !!currentRef;
    
    // Determine if we have searched at least once with an empty query (meaning we've loaded the full list)
    // If we have, and the currentAddressData is still null, it truly is a broken reference.
    // If not, we might just be waiting for the initial load.
    const isInitialLoadPending = knownAddresses.size === 0 && isSearching;

    return (
        <div className="space-y-4">
            {hasCurrentRef && (
                <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-md">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-indigo-800 uppercase tracking-wider">Current Selection</span>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => onSelect(null)}
                            disabled={disabled}
                            className="h-6 px-2 text-indigo-600 hover:text-rose-600 hover:bg-rose-50"
                        >
                            <X className="h-3 w-3 mr-1" />
                            Clear
                        </Button>
                    </div>
                    <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-indigo-500 mt-0.5" />
                        <div className="font-medium text-sm text-indigo-900">
                            {currentAddressData ? (
                                getAddressSummary(currentAddressData.data) || 'Incomplete Address'
                            ) : isInitialLoadPending ? (
                                <span className="text-indigo-400 italic">Loading...</span>
                            ) : (
                                <span className="text-amber-600 font-medium flex items-center">
                                    Broken Reference / Missing Address
                                    <span className="text-amber-500/80 text-xs ml-2 font-normal">(ID: {currentRef.ccAddressId})</span>
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                    placeholder="Search existing saved addresses..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-9 h-10 bg-slate-50 border-slate-200 focus:bg-white"
                    disabled={disabled}
                />
                {isSearching && (
                    <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-slate-400" />
                )}
            </div>

            <div className="border border-slate-200 rounded-md overflow-hidden bg-white">
                {results.length > 0 ? (
                    <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
                        {results.map((a) => {
                            const summary = getAddressSummary(a.data);
                            const isSelected = currentRef?.ccAddressId === a.id;
                            
                            return (
                                <button
                                    key={a.id}
                                    className={`w-full text-left px-4 py-3 flex flex-col gap-1 transition-colors group ${isSelected ? 'bg-indigo-50/50 hover:bg-indigo-50' : 'hover:bg-slate-50'}`}
                                    onClick={() => !isSelected && onSelect({ ccAddressId: a.id }, a.data)}
                                    disabled={disabled || isSelected}
                                >
                                    <div className="flex items-center justify-between w-full">
                                        <div className="flex items-center gap-2">
                                            <MapPin className={`h-4 w-4 ${isSelected ? 'text-indigo-500' : 'text-slate-400'}`} />
                                            <span className={`font-medium text-sm truncate pr-4 ${isSelected ? 'text-indigo-900' : 'text-slate-700 group-hover:text-indigo-700'}`}>
                                                {summary || 'Incomplete Address'}
                                            </span>
                                        </div>
                                        {isSelected ? (
                                            <span className="flex items-center text-xs font-semibold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">
                                                <Check className="h-3 w-3 mr-1" /> Selected
                                            </span>
                                        ) : (
                                            <span className="text-xs font-medium text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {hasCurrentRef ? 'Replace' : 'Select'}
                                            </span>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div className="p-8 text-center flex flex-col items-center justify-center space-y-2">
                        <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                            <Search className="h-5 w-5" />
                        </div>
                        <p className="text-sm text-slate-500">
                            {query ? "No matching addresses found." : "Start typing to search saved addresses."}
                        </p>
                    </div>
                )}
                
                {onCreateNew && (
                    <div className="p-3 border-t border-slate-100 bg-slate-50/50">
                        <Button 
                            variant="outline" 
                            className="w-full bg-white shadow-sm border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                            onClick={onCreateNew}
                            disabled={disabled}
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Create new address
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
