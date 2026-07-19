import React, { useState } from "react";
import { Paperclip } from "lucide-react";
import { PartyAddressRef } from "../CCAddressSelector";
import { CanonicalPartyFormState } from "./state-mappers";
import { PartyIdentitySection } from "./PartyIdentitySection";
import { PartyContactSection } from "./PartyContactSection";
import { PartyRolesSection } from "./PartyRolesSection";
import { PartySourceIdentifiersSection } from "./PartySourceIdentifiersSection";
import { PartyDocumentsSection } from "./PartyDocumentsSection";
import { LegacyAddressWarning } from "./LegacyAddressWarning";
import { PartyAddressSection } from "./PartyAddressSection";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface CanonicalPartyEditorProps {
    clientLEId: string;
    partyId?: string;
    formState: CanonicalPartyFormState;
    onChange: (formState: CanonicalPartyFormState) => void;
    previewLabel?: string;
    disabled?: boolean;
    isNew?: boolean; // Determines if party type is editable
    onRequestCreateAddress?: (onCreated: (ref: PartyAddressRef) => void) => void;
}

export function CanonicalPartyEditor({ clientLEId, partyId, formState, onChange, previewLabel, disabled, isNew = false, onRequestCreateAddress }: CanonicalPartyEditorProps) {
    const [docCount, setDocCount] = useState<number>(0);

    const handlePartyTypeChange = (newType: CanonicalPartyFormState['partyType']) => {
        if (!isNew) return;
        
        // Confirmation if they have entered identity data
        const hasIdentityData = formState.identity.forenames || formState.identity.surname || formState.identity.legalName || formState.identity.teamName;
        if (hasIdentityData) {
            if (!window.confirm("Changing the Party Type will clear the current identity fields. Are you sure?")) {
                return;
            }
        }

        onChange({
            ...formState,
            partyType: newType,
            // Reset identity fields and top-level addresses
            identity: {
                title: null,
                forenames: null,
                surname: null,
                legalName: null,
                teamName: null,
                location: null,
                nationality: [],
                placeOfBirth: null,
                dateOfBirth: { year: "", month: "", day: "" }
            },
            homeAddressRef: null,
            registeredAddressRef: null,
            correspondenceAddressRef: null
        });
    };

    const setFormState = (updater: React.SetStateAction<CanonicalPartyFormState>) => {
        onChange(typeof updater === 'function' ? updater(formState) : updater);
    };

    return (
        <div className="space-y-8 max-w-3xl">
            {/* Header / Meta */}
            <div className="flex flex-col gap-4 p-4 bg-gray-50 border rounded-md">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">{previewLabel}</h2>
                    </div>
                    {docCount > 0 && (
                        <div 
                            className="flex items-center text-sm text-gray-600 bg-gray-100 px-3 py-1.5 rounded-md cursor-pointer hover:bg-gray-200 transition-colors"
                            onClick={() => {
                                document.getElementById('party-documents-section')?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            title="Scroll to documents"
                        >
                            <Paperclip className="w-4 h-4 mr-2 text-gray-500" />
                            {docCount} Document{docCount !== 1 ? 's' : ''} attached
                        </div>
                    )}
                </div>

                <div className="space-y-2">
                    <Label className="text-xs font-semibold text-gray-500 uppercase">Party Type</Label>
                    <RadioGroup 
                        disabled={disabled || !isNew}
                        value={formState.partyType} 
                        onValueChange={(val: any) => handlePartyTypeChange(val)}
                        className="flex gap-4"
                    >
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="INDIVIDUAL" id="type-indiv" />
                            <Label htmlFor="type-indiv" className={(!isNew && formState.partyType !== 'INDIVIDUAL') ? 'text-gray-400' : ''}>Individual</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="ORGANISATION" id="type-org" />
                            <Label htmlFor="type-org" className={(!isNew && formState.partyType !== 'ORGANISATION') ? 'text-gray-400' : ''}>Organisation</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="TEAM" id="type-team" />
                            <Label htmlFor="type-team" className={(!isNew && formState.partyType !== 'TEAM') ? 'text-gray-400' : ''}>Team</Label>
                        </div>
                    </RadioGroup>
                </div>

                <div className="space-y-1 mt-2">
                    <Label className="text-xs font-semibold text-gray-500 uppercase">Known As (Alias/Trading Name)</Label>
                    <Input
                        disabled={disabled}
                        value={formState.knownAs || ""}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormState(prev => ({ ...prev, knownAs: e.target.value }))}
                        placeholder="e.g. Acme trading"
                    />
                </div>
            </div>

            <LegacyAddressWarning state={formState} />
            
            <div className="border-t pt-6">
                <PartyIdentitySection 
                    state={formState} 
                    onChange={updates => setFormState(prev => ({ ...prev, identity: { ...prev.identity, ...updates } }))} 
                    disabled={disabled} 
                />
            </div>

            <div className="border-t pt-6 space-y-6">
                <PartyContactSection 
                    state={formState} 
                    onChange={updates => setFormState(prev => ({ ...prev, ...updates }))} 
                    disabled={disabled} 
                />

                {formState.partyType === 'INDIVIDUAL' && (
                    <PartyAddressSection
                        clientLEId={clientLEId}
                        label="Home Address"
                        currentRef={formState.homeAddressRef}
                        onChange={(ref) => setFormState(prev => ({ ...prev, homeAddressRef: ref }))}
                        disabled={disabled}
                        onCreateAddress={onRequestCreateAddress ? () => onRequestCreateAddress((ref) => setFormState(prev => ({ ...prev, homeAddressRef: ref }))) : undefined}
                    />
                )}
                {formState.partyType === 'ORGANISATION' && (
                    <PartyAddressSection
                        clientLEId={clientLEId}
                        label="Registered Address"
                        currentRef={formState.registeredAddressRef}
                        onChange={(ref) => setFormState(prev => ({ ...prev, registeredAddressRef: ref }))}
                        disabled={disabled}
                        onCreateAddress={onRequestCreateAddress ? () => onRequestCreateAddress((ref) => setFormState(prev => ({ ...prev, registeredAddressRef: ref }))) : undefined}
                    />
                )}
            </div>

            <div className="border-t pt-6">
                <PartyRolesSection 
                    clientLEId={clientLEId}
                    state={formState} 
                    onChange={updates => setFormState(prev => ({ ...prev, ...updates }))} 
                    disabled={disabled} 
                />
            </div>

            {formState.sourceIdentifiers.length > 0 && (
                <div className="border-t pt-6">
                    <PartySourceIdentifiersSection identifiers={formState.sourceIdentifiers} />
                </div>
            )}

            {partyId && (
                <div className="border-t pt-6" id="party-documents-section">
                    <PartyDocumentsSection
                        clientLEId={clientLEId}
                        partyId={partyId}
                        disabled={disabled}
                        onCountLoaded={setDocCount}
                    />
                </div>
            )}
        </div>
    );
}
