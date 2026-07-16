import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { CanonicalPartyEditor } from "./canonical-party-editor/CanonicalPartyEditor";
import { CanonicalPartyFormState, initialiseCanonicalPartyForm, buildCCPartyDataFromForm } from "./canonical-party-editor/state-mappers";
import { convertLegacyManualPartyToV2 } from "@/services/masterData/cc-party-legacy-adapter";
import { upsertCCPartyV2 } from "@/actions/cc-party-actions";
import { createCCPartyAndReferenceField } from "@/actions/kyc-manual-update";
import { CreateCCAddressDialog } from "./CreateCCAddressDialog";
import { PartyAddressRef } from "./CCAddressSelector";

interface CanonicalPartyEditDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    clientLEId: string;
    fieldNo: number;
    rowId?: string;
    /**
     * If editing an existing CCParty, provide ccPartyId.
     * If editing an EMBEDDED_PARTY to promote it, provide legacyPartyData.
     */
    ccPartyId?: string;
    legacyPartyData?: any; 
    onSuccess?: () => void;
}

export function CanonicalPartyEditDialog({
    open,
    onOpenChange,
    clientLEId,
    fieldNo,
    rowId,
    ccPartyId,
    legacyPartyData,
    onSuccess
}: CanonicalPartyEditDialogProps) {
    const [formState, setFormState] = useState<CanonicalPartyFormState | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [addressCreateContext, setAddressCreateContext] = useState<((ref: PartyAddressRef) => void) | null>(null);

    // Initialize form state when opened
    useEffect(() => {
        if (open) {
            // FieldDetailPanel typically passes the data directly
            const v2Data = ccPartyId 
                ? legacyPartyData // If it's a PARTY_REF, legacyPartyData might already be the fetched CCParty data or legacy adapter converted
                : convertLegacyManualPartyToV2(legacyPartyData || {});

            setFormState(initialiseCanonicalPartyForm({ party: { data: v2Data } as any } as any));
        } else {
            setFormState(null);
            setAddressCreateContext(null);
        }
    }, [open, legacyPartyData, ccPartyId]);

    const handleSave = async () => {
        if (!formState) return;

        const candidate = buildCCPartyDataFromForm(formState);
        if (!candidate.isValid) {
            toast.error("Please fill out all required fields.");
            return;
        }

        setIsSaving(true);
        try {
            let res;
            if (ccPartyId) {
                // Edit existing PARTY_REF
                res = await upsertCCPartyV2({
                    id: ccPartyId,
                    clientLEId,
                    data: candidate.data
                });
            } else {
                // Edit EMBEDDED_PARTY -> creates new CCParty and adds PARTY_REF
                res = await createCCPartyAndReferenceField(clientLEId, fieldNo, candidate.data, rowId);
            }

            if (res.success) {
                toast.success(ccPartyId ? "Saved party updated" : "Party created and linked");
                onOpenChange(false);
                onSuccess?.();
            } else {
                toast.error((res as any).message || "Failed to save party");
            }
        } catch (err: any) {
            console.error("Save party error:", err);
            toast.error(err.message || "An error occurred while saving");
        } finally {
            setIsSaving(false);
        }
    };

    if (!formState) return null;

    const isNew = !ccPartyId;
    const previewLabel = formState.partyType === "ORGANISATION" 
        ? formState.identity.legalName || "Unnamed Organisation" 
        : formState.partyType === "TEAM" 
            ? formState.identity.teamName || "Unnamed Team" 
            : `${formState.identity.forenames || ''} ${formState.identity.surname || ''}`.trim() || "Unnamed Individual";

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{ccPartyId ? "Edit Saved Party" : "Curate Party"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <CanonicalPartyEditor
                                clientLEId={clientLEId}
                                formState={formState}
                                onChange={setFormState}
                                disabled={isSaving}
                                isNew={isNew}
                                previewLabel={previewLabel}
                                onRequestCreateAddress={(onCreated) => setAddressCreateContext(() => onCreated)}
                            />
                        </div>
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 mt-4">
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
                                Save
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <CreateCCAddressDialog
                clientLEId={clientLEId}
                open={addressCreateContext !== null}
                onOpenChange={(open) => {
                    if (!open) setAddressCreateContext(null);
                }}
                onSuccess={(ref) => {
                    if (addressCreateContext) {
                        addressCreateContext(ref);
                    }
                }}
            />
        </>
    );
}
