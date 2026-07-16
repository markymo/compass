import React from "react";
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
}

export function PartyAddressSection({
    clientLEId,
    label,
    currentRef,
    onChange,
    disabled
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
        </div>
    );
}
