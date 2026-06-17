"use client";

import React, { useState, useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Search, Plus, MapPin, Loader2 } from "lucide-react";
import { searchCCAddresses } from "@/actions/cc-address-actions";
import { addExistingCCAddressReferenceToField, createCCAddressAndReferenceField } from "@/actions/kyc-manual-update";
import { AddressValueEditor } from "./AddressValueEditor";
import { AddressValue } from "./AddressValueViewer";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface UnifiedAddressPickerProps {
    clientLEId: string;
    fieldNo: number;
    trigger?: React.ReactNode;
    onSuccess?: () => void;
    rowId?: string;
}

export function UnifiedAddressPicker({ clientLEId, fieldNo, trigger, onSuccess, rowId }: UnifiedAddressPickerProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [isSearching, startSearchTransition] = useTransition();
    const [isSaving, startSaveTransition] = useTransition();

    const [isCreatingNew, setIsCreatingNew] = useState(false);
    const [newAddressData, setNewAddressData] = useState<AddressValue | null>(null);

    // Reset state on open
    useEffect(() => {
        if (open) {
            setQuery("");
            setResults([]);
            setIsCreatingNew(false);
            setNewAddressData(null);
        }
    }, [open]);

    // Handle Search
    useEffect(() => {
        if (!open) return;
        
        startSearchTransition(async () => {
            try {
                const data = await searchCCAddresses(clientLEId, query);
                setResults(data);
            } catch (err) {
                console.error("Search failed", err);
            }
        });
    }, [query, clientLEId, open]);

    const handleSelectExisting = (address: any) => {
        startSaveTransition(async () => {
            try {
                const res = await addExistingCCAddressReferenceToField(clientLEId, fieldNo, address.id, rowId);
                if (res.success) {
                    toast.success("Address added successfully");
                    setOpen(false);
                    onSuccess?.();
                } else {
                    toast.error(res.message || "Failed to add address");
                }
            } catch (err: any) {
                toast.error(err.message || "An error occurred");
            }
        });
    };

    const handleCreateNew = () => {
        setIsCreatingNew(true);
        // Initialize default empty structure
        setNewAddressData({
            addressLines: [],
            locality: null,
            region: null,
            postalCode: null,
            countryCode: null,
            countryName: null,
            rawCountry: null
        } as any);
    };

    const handleSaveNew = () => {
        if (!newAddressData) return;

        startSaveTransition(async () => {
            try {
                const res = await createCCAddressAndReferenceField(clientLEId, fieldNo, newAddressData, rowId);
                if (res.success) {
                    toast.success("New address created and added successfully");
                    setOpen(false);
                    onSuccess?.();
                } else {
                    toast.error(res.message || "Failed to create address");
                }
            } catch (err: any) {
                toast.error(err.message || "An error occurred");
            }
        });
    };

    const formatAddressSummary = (data: AddressValue) => {
        const parts = [
            ...(data.addressLines || []),
            data.locality,
            data.region,
            data.postalCode,
            data.countryName || data.countryCode
        ].filter(Boolean);
        return parts.join(", ");
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button
                        variant="outline"
                        className="w-full justify-center bg-indigo-50/50 hover:bg-indigo-50 border-indigo-200 text-indigo-700 border-dashed"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Address
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{isCreatingNew ? "Create New Address" : "Select or Create Address"}</DialogTitle>
                </DialogHeader>

                {!isCreatingNew ? (
                    <div className="space-y-4 pt-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Search existing curated addresses..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                className="pl-9 h-10 bg-slate-50 border-slate-200 focus:bg-white"
                            />
                            {isSearching && (
                                <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-slate-400" />
                            )}
                        </div>

                        <div className="border border-slate-200 rounded-md overflow-hidden bg-white">
                            {results.length > 0 ? (
                                <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
                                    {results.map((a) => {
                                        const summary = formatAddressSummary(a.data);
                                        
                                        return (
                                            <button
                                                key={a.id}
                                                className="w-full text-left px-4 py-3 hover:bg-slate-50 flex flex-col gap-1 transition-colors group"
                                                onClick={() => handleSelectExisting(a)}
                                                disabled={isSaving}
                                            >
                                                <div className="flex items-center justify-between w-full">
                                                    <div className="flex items-center gap-2">
                                                        <MapPin className="h-4 w-4 text-slate-400" />
                                                        <span className="font-medium text-sm text-slate-700 group-hover:text-indigo-700 truncate pr-4">
                                                            {summary || 'Incomplete Address'}
                                                        </span>
                                                    </div>
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
                                        {query ? "No matching addresses found." : "Start typing to search curated addresses."}
                                    </p>
                                </div>
                            )}
                            
                            <div className="p-3 border-t border-slate-100 bg-slate-50/50">
                                <Button 
                                    variant="outline" 
                                    className="w-full bg-white shadow-sm border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                                    onClick={handleCreateNew}
                                    disabled={isSaving}
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Create new address
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 pt-4">
                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <AddressValueEditor
                                value={newAddressData!}
                                onChange={(val) => setNewAddressData(val as any)}
                                disabled={isSaving}
                            />
                        </div>
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 mt-4">
                            <Button
                                variant="ghost"
                                onClick={() => setIsCreatingNew(false)}
                                disabled={isSaving}
                            >
                                Back to search
                            </Button>
                            <Button
                                onClick={handleSaveNew}
                                disabled={isSaving || !newAddressData}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                            >
                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Save & Select
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
