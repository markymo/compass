"use client";

import React, { useState, useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Loader2 } from "lucide-react";
import { addExistingCCAddressReferenceToField, createCCAddressAndReferenceField } from "@/actions/kyc-manual-update";
import { AddressValueEditor } from "./AddressValueEditor";
import { AddressValue } from "./AddressValueViewer";
import { toast } from "sonner";
import { CCAddressSelector, PartyAddressRef } from "./CCAddressSelector";

interface UnifiedAddressPickerProps {
    clientLEId: string;
    fieldNo: number;
    trigger?: React.ReactNode;
    onSuccess?: () => void;
    rowId?: string;
}

export function UnifiedAddressPicker({ clientLEId, fieldNo, trigger, onSuccess, rowId }: UnifiedAddressPickerProps) {
    const [open, setOpen] = useState(false);
    const [isSaving, startSaveTransition] = useTransition();

    const [isCreatingNew, setIsCreatingNew] = useState(false);
    const [newAddressData, setNewAddressData] = useState<AddressValue | null>(null);

    // Reset state on open
    useEffect(() => {
        if (open) {
            setIsCreatingNew(false);
            setNewAddressData(null);
        }
    }, [open]);

    const handleSelectExisting = (ref: PartyAddressRef | null) => {
        if (!ref) return; // UnifiedAddressPicker currently doesn't support clearing a field claim here
        startSaveTransition(async () => {
            try {
                const res = await addExistingCCAddressReferenceToField(clientLEId, fieldNo, ref.ccAddressId, rowId);
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
                    <div className="pt-2 space-y-4">
                        <CCAddressSelector
                            clientLEId={clientLEId}
                            onSelect={handleSelectExisting}
                            disabled={isSaving}
                        />
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
