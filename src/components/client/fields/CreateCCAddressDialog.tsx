"use client";

import React, { useState, useTransition, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { AddressValueEditor } from "./AddressValueEditor";
import { AddressValue } from "./AddressValueViewer";
import { upsertCCAddress } from "@/actions/cc-address-actions";
import { toast } from "sonner";
import { PartyAddressRef } from "./CCAddressSelector";

interface CreateCCAddressDialogProps {
    clientLEId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: (ref: PartyAddressRef) => void;
}

const createBlankAddressValue = (): AddressValue => ({
    addressLines: [],
    locality: null,
    region: null,
    postalCode: null,
    countryCode: null,
});

export function CreateCCAddressDialog({ clientLEId, open, onOpenChange, onSuccess }: CreateCCAddressDialogProps) {
    const [isSaving, startSaveTransition] = useTransition();
    const [editorValue, setEditorValue] = useState<AddressValue>(createBlankAddressValue());

    // Reset state on open
    useEffect(() => {
        if (open) {
            setEditorValue(createBlankAddressValue());
        }
    }, [open]);

    const handleSave = () => {
        startSaveTransition(async () => {
            try {
                const res = await upsertCCAddress({
                    clientLEId,
                    data: editorValue,
                });

                if (res.success && res.ccAddress) {
                    toast.success("Address created successfully");
                    // Important: Fire callback exactly once, then close
                    onSuccess({ ccAddressId: res.ccAddress.id });
                    onOpenChange(false);
                } else {
                    toast.error(res.error || "Failed to create address");
                }
            } catch (err: any) {
                toast.error(err.message || "An error occurred while creating address");
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={(newOpen) => !isSaving && onOpenChange(newOpen)}>
            <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto z-[60]">
                <DialogHeader>
                    <DialogTitle>Create New Address</DialogTitle>
                    <DialogDescription>
                        Fill in the fields below to create a new reusable address record.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 pt-4">
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <AddressValueEditor
                            value={editorValue}
                            onChange={setEditorValue}
                            disabled={isSaving}
                        />
                    </div>
                </div>

                <DialogFooter className="mt-4 pt-4 border-t border-slate-100">
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        disabled={isSaving}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Save & Select
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
