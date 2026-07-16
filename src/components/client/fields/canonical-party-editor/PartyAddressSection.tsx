import React from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { PartyAddressRef, CCAddressSelector } from "../CCAddressSelector";
import { Label } from "@/components/ui/label";

/**
 * A pure UI component that wraps CCAddressSelector.
 * It has NO knowledge of the Party form state beyond currentRef and onChange.
 * It does not trigger any server mutations or directly handle address creation.
 */
export interface PartyAddressSectionProps {
    clientLEId: string;
    label: string;
    currentRef: PartyAddressRef | null;
    onChange: (ref: PartyAddressRef | null) => void;
    disabled?: boolean;
    /** Optional callback to trigger creating a new address */
    onCreateAddress?: () => void;
}

export function PartyAddressSection({
    clientLEId,
    label,
    currentRef,
    onChange,
    disabled,
    onCreateAddress
}: PartyAddressSectionProps) {
    return (
        <div className="space-y-2">
            <Label className="text-xs font-semibold text-gray-500 uppercase">{label}</Label>
            <CCAddressSelector
                clientLEId={clientLEId}
                currentRef={currentRef}
                onSelect={(ref) => onChange(ref)}
                disabled={disabled}
            />
            {onCreateAddress && (
                <div className="pt-2">
                    <Button 
                        variant="outline" 
                        className="w-full bg-white shadow-sm border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                        onClick={onCreateAddress}
                        disabled={disabled}
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Create new address
                    </Button>
                </div>
            )}
        </div>
    );
}
